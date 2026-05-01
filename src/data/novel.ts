import { storageGet, storageSet } from 'even-toolkit/storage'
import type { Novel, ChapterContent } from '../types/novelTypes.ts'
import JSZip from 'jszip'

const STORAGE_KEY_NOVELS = 'novel-reader:novels'

export async function loadNovels(): Promise<Novel[]> {
    const novels = await storageGet<Novel[] | null>(STORAGE_KEY_NOVELS, null)
    return novels ?? []
}

export async function saveNovels(novels: Novel[]): Promise<void> {
    await storageSet(STORAGE_KEY_NOVELS, novels)
}

export async function getChapterList(file: Blob | File): Promise<ChapterContent[]> {
    const zip = await JSZip.loadAsync(file);

    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("Invalid EPUB: missing container.xml");
    
    const container = await containerFile.async("string");
    const containerDoc = new DOMParser().parseFromString(container, "text/xml");
    const opfPath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
    if (!opfPath) throw new Error("Invalid EPUB: missing rootfile path");

    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);

    const opf = await opfFile.async("string");
    const opfDoc = new DOMParser().parseFromString(opf, "text/xml");

    let tocEl = opfDoc.querySelector('manifest > item[properties~="nav"]') ||
                opfDoc.querySelector('manifest > item[media-type="application/x-dtbncx+xml"]');
    const tocPath = tocEl?.getAttribute("href") ?? null

    let chapterList: ChapterContent[] = []
    
    if(tocPath != null) {
        
        const opfDir = opfPath.includes("/")
            ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
            : ""
        const tocFile = zip.file(opfDir + tocPath);
        if (!tocFile) throw new Error("Invalid EPUB: missing container.xml");

        const toc = await tocFile.async("string");
        const tocDoc = new DOMParser().parseFromString(toc, "text/xml");
        const chapterPointsEl = tocDoc.getElementsByTagName("navPoint");

        let index = 0
        for (const chapterNavPoint of Array.from(chapterPointsEl)) {
            const title = chapterNavPoint.querySelector('navLabel > text')?.textContent?.trim()
            const chapterPath = opfDir + chapterNavPoint.querySelector('content')?.getAttribute('src')
            chapterList.push({
                name: title ?? "Chapter " + index,
                chapterIndex: index,
                chapterPath: chapterPath
            })
            index += 1
        }   
    }

    return chapterList
}

export async function extractChapterContentsFromBlob(epubBlob: Blob, filePath: string, blacklist: string[]): Promise<string[]> {
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
