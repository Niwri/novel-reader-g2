import { ChapterPosition } from "@/types/novelTypes"

export const GLASSES_CHAPTER_LIST_MAX_ITEMS = 10

export interface AppButton {
  label: string
  index: number
  target: string
}

export interface AppSnapshot {
  buttons?: AppButton[]
  title?: string
  texts?: string[]
  chapterIndex?: number
  chapterCount?: number
  continueChapterIndex?: number
  continueCharOffset?: number
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
  selectNovel: (index: number) => Promise<void>
  checkLoadedChapters: () => Promise<Boolean>
  selectChapter: (index: number) => Promise<void>
  setPosition: (charOffset: number) => Promise<void>
  updatePosition: (chapterPos: ChapterPosition) => Promise<void>
}

export const LINE_WIDTH = 56

export function normalizeLabel(label: string) {
  return label.replace(/\s*\r?\n+\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

export function truncateLabel(label: string, maxLength: number) {
  const normalized = normalizeLabel(label)
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`
}