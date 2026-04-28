import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import type { AppSnapshot, AppActions } from '../shared'

export const testScreen: GlassScreen<AppSnapshot, AppActions> = {
  display() {
    return {
      lines: [
        { text: 'text', inverted: false, style: 'normal' },
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
    }

    return nav
  },
}
