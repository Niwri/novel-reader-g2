import { AppShell, Button, Page, SectionHeader} from 'even-toolkit/web'
import { IcEditNew, IcGuideBack } from 'even-toolkit/web/icons/svg-icons'
import { useRef, useState, useEffect, type ChangeEvent } from 'react'
import { useNovelContext } from '../contexts/novelContext'
import { useNavigate } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import type { Novel } from '../types/novelTypes'
import { Toast } from 'even-toolkit/web'
import JSZip from "jszip";
import { Popup } from '@/components/popup'

// --- EPUB Information Interface --
interface EpubInfo {
    loaded: boolean
    data: Novel | null
    numOfChapters: number
}

// --- Cover Image Parser ---
async function getCoverImage(
  zip: JSZip,
  opfDoc: Document,
  opfPath: string
): Promise<string | null> {
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);

    // EPUBs declare the cover in one of two ways — check both:

    // Method 1: <meta name="cover" content="cover-image-id" />
    const metaCover = opfDoc.querySelector('meta[name="cover"]');
    const coverId = metaCover?.getAttribute("content");
    
    let coverHref: string | null = null;

    if (coverId) {
        const item = opfDoc.querySelector(`manifest > item[id="${coverId}"]`);
        coverHref = item?.getAttribute("href") ?? null;
    }

    // Method 2: <item properties="cover-image" /> (EPUB3)
    if (!coverHref) {
        const item = opfDoc.querySelector('manifest > item[properties="cover-image"]');
        coverHref = item?.getAttribute("href") ?? null;
    }

    if (!coverHref) return null;

    // Resolve path relative to OPF file location
    const coverPath = opfDir + coverHref;
    const coverFile = zip.file(coverPath);
    if (!coverFile) return null;

    const bytes = await coverFile.async("base64");
    const ext = coverHref.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
    };
    const mime = mimeMap[ext ?? ""] ?? "image/jpeg";

    return `data:${mime};base64,${bytes}`;
}

// --- EPUB Title and NumChapters Parser ---
async function getEPUBInfo(file: File): Promise<EpubInfo> {
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

    const titleEl = opfDoc.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "title")[0];
    const title = titleEl?.textContent ?? "Unknown Title";

    const authorEl = opfDoc.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "creator")[0];
    const author = authorEl?.textContent ?? "Unknown Author";

    const chapterCount = opfDoc.querySelectorAll("spine > itemref").length;
    const coverImage = await getCoverImage(zip, opfDoc, opfPath)
    return { 
        loaded: true,
        data: {
            id: uuidv4(),
            title: title,
            author: author,
            coverImage: coverImage ?? "",
            epubBlob: file
        },
        numOfChapters: chapterCount,
    }
}

export function AddNovel() {
    const navigate = useNavigate()
    const { addNovel } = useNovelContext()

    const ref = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false)
    const [toastMessage, setToastMessage] = useState("")
    const [showToast, setShowToast] = useState(false)
    const [novelInfo, setNovelInfo] = useState<EpubInfo>({
        loaded: false,
        data: null,
        numOfChapters: -1
    })

    const handleFileClick = () => {
        ref.current?.click()
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const nextFile = e.target.files?.[0] ?? null
        setFile(nextFile)
    }

    // State-based component that renders based on if a file was selected
    const SelectFileComponent = ({ novelInfo }: {novelInfo: EpubInfo}) => {
        if(!novelInfo.loaded)
            return (
                <div className="!h-auto flex flex-col items-center py-10">
                    <h3>Select An EPUB File</h3>
                    <IcEditNew width={40} height={40} className=""/>
                </div>
            )
    
        return (
            <div className="!h-auto flex flex-col items-center py-10">
                {novelInfo?.data?.coverImage !== null && <img src={novelInfo.data?.coverImage} width={80} height={80} className="rounded-xl"/>}
                <h3>{novelInfo.data?.title}</h3>
            </div>
        )
    }
    
    // Upon selecting a file, load the file information 
    useEffect(() => {
        const loadEPUBInfo = async () => {
            if(file) {
                const newNovelInfo = await getEPUBInfo(file)
                setNovelInfo(newNovelInfo)
            }
        } 
        loadEPUBInfo();
    }, [file])

    // onClick for adding a novel 
    const handleAddClick = async () => {
        if (!novelInfo.loaded || !novelInfo.data) return
        const novel = novelInfo.data
        setSaving(true)
        try {
            await addNovel(novel)
            navigate("/")
        } catch (err) {
            setToastMessage("Failed to add!")
            setSaving(false)
            setShowToast(true)
            setTimeout(() => {setShowToast(false)}, 2000)
        } finally {
        }
    }

    return (
        <AppShell header={<></>}>
            <div className="px-3 pt-4 pb-8 space-y-3">
                <Button variant="highlight" className="mt-3" size="sm" onClick={() => navigate('/')}>
                    <IcGuideBack width={20} height={20}/>
                    Back
                </Button>
                <SectionHeader title="Add A Novel"/>

                <Page className="flex flex-col gap-y-4 mt-4">
                    <Button variant="default" className="h-50" onClick={handleFileClick}>
                        <SelectFileComponent novelInfo={novelInfo}/>
                    </Button>

                    <Button variant="highlight" onClick={handleAddClick} disabled={!novelInfo.loaded || saving}>
                        {saving ? 'Saving…' : 'Add Novel'}
                    </Button>
                    
                    <input
                        ref={ref}
                        type="file"
                        accept=".epub"
                        className="hidden"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={handleFileChange}
                    />
                </Page> 
            </div>
            <Popup toastMessage={toastMessage} showToast={showToast}/>
        </AppShell>
    )
}