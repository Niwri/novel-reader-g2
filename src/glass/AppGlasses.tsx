import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { waitForEvenAppBridge, CreateStartUpPageContainer, type EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { mapGlassEvent } from 'even-toolkit/action-map'
import { createScreenMapper } from 'even-toolkit/glass-router'
import { notifyTextUpdate } from 'even-toolkit/gestures'
import { bindKeyboard } from 'even-toolkit/keyboard'
import { activateKeepAlive, deactivateKeepAlive } from 'even-toolkit/keep-alive'
import { type GlassAction, type GlassNavState } from 'even-toolkit/types'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import JSZip from 'jszip'

import { getChapterList } from '@/data/novel'
import { useNovelContext } from '@/contexts/novelContext'
import { onGlassAction, type AppSnapshot } from './selectors'
import type { AppActions } from './shared'

import { homeScreen } from './screens/home'
import { chapterListScreen } from './screens/chapterList'
import { chapterScreen, buildChapterTextUpgrade } from './screens/chapter'

const DISPLAY_W = 576
const DISPLAY_H = 288

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

async function extractChapterContentsFromBlob(epubBlob: Blob, filePath: string, blacklist: string[]): Promise<string[]> {
  try {
    const zip = await JSZip.loadAsync(epubBlob)

    // Try exact path first, then fallback to matching by suffix
    let candidate: any = zip.file(filePath as any)
    if (Array.isArray(candidate)) candidate = candidate[0]
    if (!candidate) {
      candidate = (zip.file(new RegExp(filePath.replace(/^[./]+/, '') + '$') as any) as any)
      if (Array.isArray(candidate)) candidate = candidate[0]
    }

    if (!candidate) {
      const basename = filePath.split('/').pop() || filePath
      const bySuffix: any = zip.file(new RegExp(basename + '$') as any)
      candidate = Array.isArray(bySuffix) ? bySuffix[0] : bySuffix
    }

    if (!candidate) return []

    const content = await candidate.async('string')

    // Parse XHTML and extract block-level text nodes
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'application/xhtml+xml')

    const blocks = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div'))

    if (blocks.length > 0) {
      return blocks
        .map((el) => el.textContent || '')
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter((t) => t.replaceAll('\n', '').length > 0)
        .filter((t) => !blacklist.includes(t))
        .map((t) => t + '\n')
    }

    // Fallback: use body innerText split by newlines
    const bodyText = doc.body?.textContent ?? ''
    return bodyText
      .split(/\r?\n/)
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  } catch (err) {
    console.error('extractChapterContentsFromBlob error', err)
    return []
  }
}

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
    selectChapter: async () => {},
  })

  ctxRef.current = {
    navigate,
    selectNovel: async (index: number) => {
      const novel = novels[index]
      if (!novel) return
      await setSelectedNovel(novel)
      const chapters = await getChapterList(novel.epubBlob as Blob)
      await setChapterList(chapters)
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
  const navRef = useRef<GlassNavState>({ highlightedIndex: 0, screen: 'home' })
  const screenRef = useRef<string>(screen)
  const getSnapshotForScreenRef = useRef(getSnapshotForScreen)

  const lastRenderedRef = useRef<{ screen: string; content: string }>({ screen: '', content: '' })
  const renderInProgressRef = useRef(false)
  const renderQueuedRef = useRef(false)

  screenRef.current = screen
  getSnapshotForScreenRef.current = getSnapshotForScreen

  const loadedRef = useRef(loaded)
  useEffect(() => { loadedRef.current = loaded }, [loaded])

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  async function waitForLoaded(timeoutMs = 1000, interval = 50): Promise<boolean> {
    const start = Date.now()
    while (!loadedRef.current) {
      if (Date.now() - start > timeoutMs) return false
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
      const nav: GlassNavState = { ...navRef.current, screen: currentScreen }

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
        const startupNav: GlassNavState = { highlightedIndex: 0, screen: 'home' }
        navRef.current = startupNav
        const startupSnap = getSnapshotForScreenRef.current('home')
        const startupRebuild = buildRebuildContainerForScreen('home', startupSnap, startupNav)

        await bridge.createStartUpPageContainer(
          new CreateStartUpPageContainer({
            containerTotalNum: startupRebuild?.containerTotalNum ?? 1,
            listObject: startupRebuild?.listObject ?? [],
            textObject: startupRebuild?.textObject ?? [],
            imageObject: startupRebuild?.imageObject ?? [],
          }),
        )

        lastRenderedRef.current = {
          screen: 'home',
          content: startupRebuild ? getRebuildSignature(startupRebuild) : '',
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

        // Switch to the actual current route screen.
        await waitForLoaded(1000)
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
