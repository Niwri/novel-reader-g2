import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { buildScrollableList } from 'even-toolkit/glass-display-builders'
import { moveHighlight } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions } from '../shared'

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    return {
      lines: buildScrollableList({
        items: snapshot.buttons,
        highlightedIndex: nav.highlightedIndex,
        maxVisible: 5,
        formatter: (item) => item.label,
      }),
    }
  },

  action(action, nav, snapshot, ctx) {
    if (action.type === 'HIGHLIGHT_MOVE') {
      return { ...nav, highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, snapshot.buttons.length - 1) }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      const selected = snapshot.buttons[nav.highlightedIndex]
      if (!selected) {
        return nav
      }

      ctx.navigate(selected.target)
    }

    return nav
  },
}
