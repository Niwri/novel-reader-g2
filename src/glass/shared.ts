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
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
  selectNovel: (index: number) => Promise<void>
  checkLoadedChapters: () => Promise<Boolean>
  selectChapter: (index: number) => Promise<void>
}

export const LINE_WIDTH = 58

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