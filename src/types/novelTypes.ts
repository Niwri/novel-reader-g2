export interface Novel {
    id: string;             // UUID
    title: string; 
    author: string;
    coverImage: string | null;     // Base64 or Object URL 
    epubBlob: Blob;         // Raw EPUB file
    cfi?: string;           // EPUB CFI location
    lastReadAt?: Date;
    archived?: boolean
}

export interface ChapterContent {
    name: string
    chapterIndex: number
    chapterPath: string
}