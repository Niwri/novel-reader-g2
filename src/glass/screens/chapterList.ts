import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import type { AppSnapshot, AppActions } from '../shared'
import { buildScrollableList } from 'even-toolkit'
import { moveHighlight } from 'even-toolkit/glass-nav'

const MAX_BUTTON_LABEL_LENGTH = 60

function normalizeLabel(label: string) {
  return label.replace(/\s*\r?\n+\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncateLabel(label: string, maxLength: number) {
  const normalized = normalizeLabel(label)
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`
}

export const chapterListScreen: GlassScreen<AppSnapshot, AppActions> = {

    display(snapshot, nav) {
        const buttons = snapshot?.buttons ?? []

        return {
              lines: buildScrollableList({
                items: buttons,
                highlightedIndex: nav.highlightedIndex,
                maxVisible: 10,
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
            void ctx.selectChapter(selected.index).then(() => {
                ctx.navigate(selected.target)
            })
        }
    
        if (action.type === 'GO_BACK') {
            ctx.navigate('/')
        }

        return nav
    },
}
