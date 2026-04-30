import { createGlassScreenRouter } from 'even-toolkit/glass-screen-router'
import type { AppSnapshot, AppActions } from './shared'
import { homeScreen } from './screens/home'
import { testScreen } from './screens/test'
import { chapterListScreen } from './screens/chapterList'
import { chapterScreen } from './screens/chapter'

export type { AppSnapshot, AppActions }

export const { toDisplayData, onGlassAction } = createGlassScreenRouter<AppSnapshot, AppActions>({
  'home': homeScreen,
  'test': testScreen,
  'chapter-list': chapterListScreen,
  'chapter': chapterScreen
}, 'home')
