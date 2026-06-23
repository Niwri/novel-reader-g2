export interface Novel {
    id: string;             // UUID
    title: string; 
    author: string;
    coverImage: string | null;     // Base64 or Object URL 
    epubBlob?: Blob;         // Raw EPUB file (loaded lazily on glasses)
    lastPosition?: ChapterPosition | null;  // Where the reader last read
    lastReadAt?: string;
    archived?: boolean
}

export interface ChapterContent {
    name: string
    chapterIndex: number
    chapterPath: string
}

export interface ChapterPosition {
    chapterIndex: number
    charOffset: number
}