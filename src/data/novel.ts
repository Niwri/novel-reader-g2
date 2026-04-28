import { storageGet, storageSet } from 'even-toolkit/storage'
import type { Novel } from '../types/novelTypes.ts'

const STORAGE_KEY_NOVELS = 'novel-reader:novels'

export async function loadNovels(): Promise<Novel[]> {
    const novels = await storageGet<Novel[] | null>(STORAGE_KEY_NOVELS, null)
    return novels ?? []
}

export async function saveNovels(novels: Novel[]): Promise<void> {
    await storageSet(STORAGE_KEY_NOVELS, novels)
}