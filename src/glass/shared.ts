export interface AppButton {
  label: string
  target: string
}

export interface AppSnapshot {
  buttons: AppButton[]
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
}
