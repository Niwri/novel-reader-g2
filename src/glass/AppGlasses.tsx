import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { waitForEvenAppBridge, CreateStartUpPageContainer, type EvenAppBridge, TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { mapGlassEvent } from 'even-toolkit/action-map'
import { createScreenMapper } from 'even-toolkit/glass-router'
import { notifyTextUpdate } from 'even-toolkit/gestures'
import { bindKeyboard } from 'even-toolkit/keyboard'
import { activateKeepAlive, deactivateKeepAlive } from 'even-toolkit/keep-alive'
import { type GlassAction, type GlassNavState } from 'even-toolkit/types'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'

import { getChapterList, extractChapterContentsFromBlob } from '@/data/novel'
import { useNovelContext } from '@/contexts/novelContext'
import { onGlassAction, type AppSnapshot } from './selectors'
import type { AppActions } from './shared'

import { homeScreen } from './screens/home'
import { chapterListScreen } from './screens/chapterList'
import { chapterScreen, buildChapterTextUpgrade } from './screens/chapter'

const DISPLAY_W = 576
const DISPLAY_H = 288

type ChapterGlassNavState = GlassNavState & {
  chapterScrollOffset?: number
  chapterEndAttempts?: number
}

function buildRebuildContainerForScreen(screen: string, snapshot: AppSnapshot, nav: GlassNavState) {
  if (screen === 'chapter') return (chapterScreen.display as any)(snapshot, nav)
  if (screen === 'chapter-list') return (chapterListScreen.display as any)(snapshot, nav)
  return (homeScreen.display as any)(snapshot, nav)
}

function getRebuildSignature(rebuild: any): string {
  const textSig = (rebuild?.textObject ?? [])
    .map((t: any) => String(t?.content ?? ''))
    .join('\n')

  const listSig = (rebuild?.listObject ?? [])
    .map((l: any) => {
      const names = l?.itemContainer?.itemName
      const namesSig = Array.isArray(names) ? names.join('|') : String(names ?? '')
      return `${String(l?.containerName ?? '')}:${namesSig}`
    })
    .join('\n')

  return `${textSig}\n--\n${listSig}`
}

const deriveScreen = createScreenMapper(
  [
    { pattern: '/chapter-list', screen: 'chapter-list' },
    { pattern: '/chapter', screen: 'chapter' },
    { pattern: '/', screen: 'home' },
  ],
  'home',
)

export function AppGlasses() {
  const navigate = useNavigate()
  const location = useLocation()
  const screen = deriveScreen(location.pathname)
  const flashPhase = useFlashPhase(screen === 'home' || screen === 'chapter-list')
  const { novels, loaded, selectedNovel, selectedChapterList, selectedChapterIndex, setChapterList, setSelectedNovel, setChapter } = useNovelContext()

  const [chapterTexts, setChapterTexts] = useState<string[]>([])

  useEffect(() => {
    let mounted = true

    if (screen !== 'chapter') {
      setChapterTexts([])
      return
    }

    const chapter = selectedChapterList[selectedChapterIndex]
    if (!chapter || !selectedNovel?.epubBlob) {
      setChapterTexts([])
      return
    }

    ;(async () => {
      const lines = await extractChapterContentsFromBlob(selectedNovel.epubBlob as Blob, chapter.chapterPath, [chapter.name])
      if (!mounted) return
      setChapterTexts(lines)
    })()

    return () => {
      mounted = false
    }
  }, [screen, selectedChapterIndex, selectedChapterList, selectedNovel])

  const getSnapshotForScreen = useCallback(
    (s: string): AppSnapshot => {
      if (s === 'chapter-list') {
        return {
          buttons: selectedChapterList.map((chapter, index) => {
            return {
              label: chapter.name,
              index,
              target: '/chapter',
            }
          }),
          flashPhase,
        }
      }

      if (s === 'chapter') {
        chapterRef.current = selectedChapterIndex
        return {
          texts: chapterTexts,
          title: selectedChapterList[selectedChapterIndex]?.name ?? '',
          chapterIndex: selectedChapterIndex,
          chapterCount: selectedChapterList.length,
          flashPhase,
        }
      }

      return {
        buttons: novels.map((novel, index) => {
          return {
            label: novel.title,
            index,
            target: '/chapter-list',
          }
        }),
        flashPhase,
      }
    },
    [chapterTexts, flashPhase, novels, selectedChapterIndex, selectedChapterList],
  )

  const ctxRef = useRef<AppActions>({
    navigate,
    selectNovel: async () => {},
    checkLoadedChapters: async () => {return false},
    selectChapter: async () => {},
  })

  ctxRef.current = {
    navigate,
    selectNovel: async (index: number) => {
      const novel = novels[index]
      if (!novel) return
      const resolved = await setSelectedNovel(novel)
      if (!resolved.epubBlob) {
        throw new Error('Selected novel is missing epubBlob')
      }
      const chapters = await getChapterList(resolved.epubBlob)
      await setChapterList(chapters)
    },
    checkLoadedChapters: async () => {
      const disposed = false
      await waitForLoadedChapters(0, 50, () => disposed)
      return disposed
    },
    selectChapter: async (index: number) => {
      await setChapter(index)
    },
  }

  const handleGlassAction = useCallback(
    (action: Parameters<typeof onGlassAction>[0], nav: Parameters<typeof onGlassAction>[1], snap: AppSnapshot) =>
      onGlassAction(action, nav, snap, ctxRef.current),
    [],
  )

  const bridgeRef = useRef<EvenAppBridge | null>(null)
  const navRef = useRef<ChapterGlassNavState>({ highlightedIndex: 0, screen: 'home' })
  const screenRef = useRef<string>(screen)
  const getSnapshotForScreenRef = useRef(getSnapshotForScreen)

  const lastRenderedRef = useRef<{ screen: string; content: string }>({ screen: '', content: '' })
  const lastChapterRef = useRef<number>(-1)
  const chapterRef = useRef<number>(selectedChapterIndex)
  const renderInProgressRef = useRef(false)
  const renderQueuedRef = useRef(false)

  screenRef.current = screen
  getSnapshotForScreenRef.current = getSnapshotForScreen

  const loadedRef = useRef(loaded)
  useEffect(() => { loadedRef.current = loaded }, [loaded])

  const loadedChapterRef = useRef(selectedChapterList)
  useEffect(() => { loadedChapterRef.current = selectedChapterList}, [selectedChapterList])

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  async function waitForLoaded(timeoutMs = 0, interval = 50, shouldAbort?: () => boolean): Promise<boolean> {
    const start = Date.now()
    while (!loadedRef.current) {
      if (shouldAbort?.()) return false
      if (timeoutMs > 0 && Date.now() - start > timeoutMs) return false
      await sleep(interval)
    }

    return true
  }

  async function waitForLoadedChapters(timeoutMs = 0, interval = 50, shouldAbort?: () => boolean): Promise<boolean> {
    const start = Date.now()
    while (!loadedChapterRef.current) {
      if (shouldAbort?.()) return false
      if (timeoutMs > 0 && Date.now() - start > timeoutMs) return false
      await sleep(interval)
    }

    return true
  }

  const scheduleRender = useCallback(() => {
    if (!bridgeRef.current) return

    if (renderInProgressRef.current) {
      renderQueuedRef.current = true
      return
    }

    renderInProgressRef.current = true

    void (async () => {
      try {
        const bridge = bridgeRef.current
        if (!bridge) return

        const currentScreen = screenRef.current
        const nav: GlassNavState = { ...navRef.current, screen: currentScreen }
        const snap = getSnapshotForScreenRef.current(currentScreen)

        // Clamp highlight for list screens.
        if (currentScreen === 'home' || currentScreen === 'chapter-list') {
          const maxHighlightIndex = Math.max((snap.buttons?.length ?? 0) - 1, 0)
          nav.highlightedIndex = Math.max(0, Math.min(nav.highlightedIndex, maxHighlightIndex))
          navRef.current = nav
        }

        const rebuild = buildRebuildContainerForScreen(currentScreen, snap, nav)
        if (!rebuild) return

        const sig = getRebuildSignature(rebuild)
        if (lastRenderedRef.current.screen !== currentScreen || lastRenderedRef.current.content !== sig) {
          if (currentScreen === 'chapter' && lastRenderedRef.current.screen === 'chapter') {
            if(chapterRef !== lastChapterRef)
              navRef.current = {
                ...navRef.current,
                chapterScrollOffset: 0,
                chapterEndAttempts: 0
              }

            const upgrade = buildChapterTextUpgrade(snap as any, nav as any, 3)
            const ok = await bridge.textContainerUpgrade(upgrade as any)
            if (!ok) {
              await bridge.rebuildPageContainer(rebuild)
            }
            notifyTextUpdate()
          } else {
            await bridge.rebuildPageContainer(rebuild)
            if (currentScreen === 'chapter') notifyTextUpdate()
          }

          lastRenderedRef.current = { screen: currentScreen, content: sig }
          lastChapterRef.current = chapterRef.current
        }
      } finally {
        renderInProgressRef.current = false
        if (renderQueuedRef.current) {
          renderQueuedRef.current = false
          scheduleRender()
        }
      }
    })()
  }, [])

  const dispatchAction = useCallback(
    (action: GlassAction) => {
      const currentScreen = screenRef.current
      const snap = getSnapshotForScreenRef.current(currentScreen)
      const nav: any = { ...navRef.current, screen: currentScreen }

      const newNav = handleGlassAction(action, nav, snap)
      navRef.current = { ...newNav, screen: currentScreen }

      scheduleRender()
    },
    [handleGlassAction, scheduleRender],
  )

  useEffect(() => {
    let disposed = false
    let unsubscribe: null | (() => void) = null
    let unbindKeyboard: null | (() => void) = null

    ;(async () => {
      try {
        const bridge = await waitForEvenAppBridge()
        if (disposed) return
        bridgeRef.current = bridge

        // Startup must begin with the home page (using the same data model as rebuild).
        // Loading page
        await bridge.createStartUpPageContainer(
          new CreateStartUpPageContainer({
            containerTotalNum: 1,
            listObject: [],
            textObject: [
              new TextContainerProperty({
                xPosition: DISPLAY_W/2 - 5*10,
                yPosition: DISPLAY_H/2-25,
                width: 100,
                height: 50,
                containerID: 1,
                containerName: 'loading',
                content: 'Loading...',
                isEventCapture: 0
              })
            ],
            imageObject: [],
          }),
        )

        // Create a polling function waiting for 'loaded' to be true, then continue
        await waitForLoaded(0, 50, () => disposed)
        if (disposed) return

        const startupNav: GlassNavState = { highlightedIndex: 0, screen: 'home' }
        navRef.current = startupNav
        const startupSnap = getSnapshotForScreenRef.current('home')
        const startupRebuild = buildRebuildContainerForScreen('home', startupSnap, startupNav)
        
        lastRenderedRef.current = {
          screen: 'home',
          content: startupRebuild ? getRebuildSignature(startupRebuild) : '',
        }

        if (startupRebuild) {
          await bridge.rebuildPageContainer(startupRebuild)
        }

        unsubscribe = bridge.onEvenHubEvent((event) => {
          const tappedIndex = event?.listEvent?.currentSelectItemIndex
          if (typeof tappedIndex === 'number' && Number.isFinite(tappedIndex)) {
            navRef.current = { ...navRef.current, highlightedIndex: tappedIndex }
          }

          const mapped = mapGlassEvent(event)
          if (mapped) dispatchAction(mapped)
        })

        unbindKeyboard = bindKeyboard(dispatchAction)
        activateKeepAlive('Novel Reader_direct_bridge')

        scheduleRender()
      } catch (err) {
        console.error('AppGlasses EvenAppBridge init error:', err)
      }
    })()

    return () => {
      disposed = true
      unsubscribe?.()
      unbindKeyboard?.()
      bridgeRef.current = null
      deactivateKeepAlive()
    }
  }, [])

  useEffect(() => {
    // On route change, reset highlight and rebuild the page container for that screen.
    navRef.current = { highlightedIndex: 0, screen }
    scheduleRender()
  }, [screen, scheduleRender])

  useEffect(() => {
    if (screen === 'chapter') {
      scheduleRender()
    }
  }, [chapterTexts, screen, scheduleRender])

  return null
}
