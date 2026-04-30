import { useCallback, useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { appSplash } from './splash'
import { toDisplayData, onGlassAction, type AppSnapshot } from './selectors'
import type { AppActions } from './shared'
import { useNovelContext } from '@/contexts/novelContext'
import { getChapterList } from '@/data/novel'
import JSZip from 'jszip'



const deriveScreen = createScreenMapper([
  { pattern: '/chapter-list', screen: 'chapter-list' },
  { pattern: '/chapter', screen: 'chapter' },
  { pattern: '/', screen: 'home' },
], 'home')

const homeTiles = getHomeTiles(appSplash)

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

    const blocks = Array.from(
      doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div')
    )

    if (blocks.length > 0) {
      return blocks
        .map((el) => el.textContent || '')
        .map((t) => (t.replace(/\s+/g, ' ').trim()))
        .filter(Boolean)
        .filter((t) => {return t.replaceAll('\n', '').length > 0})
        .filter((t) => {return (!blacklist.includes(t))})
        .map((t) => (t + '\n'))
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
  const { novels, selectedNovel, selectedChapterList, selectedChapterIndex, setChapterList, setSelectedNovel, setChapter } = useNovelContext()

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

  const snapshot: AppSnapshot = screen === 'chapter-list'
    ? {
        buttons: selectedChapterList.map((chapter, index) => {
          return {
            label: chapter.name,
            index,
            target: '/chapter',
          }
        }),
        flashPhase,
      }
    : screen === 'chapter'
    ? {
        texts: chapterTexts,
        title: selectedChapterList[selectedChapterIndex]?.name ?? '',
        flashPhase,
      }
    : {
        buttons: novels.map((novel, index) => {
          return {
            label: novel.title,
            index,
            target: '/chapter-list',
          }
        }),
        flashPhase,
      }

  const getSnapshot = useCallback(() => snapshot, [snapshot])

  const ctxRef = useRef<AppActions>({
    navigate,
    selectNovel: async () => {},
    selectChapter: async () => {}
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
    }
  }

  const handleGlassAction = useCallback(
    (action: Parameters<typeof onGlassAction>[0], nav: Parameters<typeof onGlassAction>[1], snap: AppSnapshot) =>
      onGlassAction(action, nav, snap, ctxRef.current),
    [],
  )

  useGlasses({
    getSnapshot,
    toDisplayData,
    onGlassAction: handleGlassAction,
    deriveScreen,
    appName: 'Novel Reader',
    getPageMode: (screen) => screen === 'home' ? 'home' : 'text',
    homeImageTiles: homeTiles,
  })

  return null
}
