import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { buildScrollableList } from 'even-toolkit/glass-display-builders'
import { moveHighlight } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions } from '../shared'

const MAX_BUTTON_LABEL_LENGTH = 60

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) {
    return label
  }

  return `${label.slice(0, Math.max(1, maxLength - 1))}…`
}

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    return {
      lines: buildScrollableList({
        items: snapshot?.buttons ?? [],
        highlightedIndex: nav.highlightedIndex,
        maxVisible: 5,
        formatter: (item) => truncateLabel(item.label, MAX_BUTTON_LABEL_LENGTH),
      }),
    }
  },

  action(action, nav, snapshot, ctx) {
    if (action.type === 'HIGHLIGHT_MOVE') {
      const maxHighlightIndex = Math.max((snapshot?.buttons?.length ?? 0) - 1, 0)

      return {
        ...nav,
        highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, maxHighlightIndex),
      }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      const selected = snapshot?.buttons?.[nav.highlightedIndex]
      if (!selected) {
        return nav
      }
      void ctx.selectNovel(selected.index).then(() => {
        ctx.navigate(selected.target)
      })
    }

    return nav
  },
}
