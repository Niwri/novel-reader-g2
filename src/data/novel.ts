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