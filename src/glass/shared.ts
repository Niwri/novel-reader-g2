export interface AppButton {
  label: string
  index: number
  target: string
}

export interface AppSnapshot {
  buttons?: AppButton[]
  title?: string
  texts?: string[]
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
  selectNovel: (index: number) => Promise<void>
  selectChapter: (index: number) => Promise<void>
}
