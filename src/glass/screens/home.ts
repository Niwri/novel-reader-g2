import { moveHighlight } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions } from '../shared'
import { RebuildPageContainer, ListContainerProperty, ListItemContainerProperty, TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { DISPLAY_W, DISPLAY_H } from 'even-toolkit/layout'

const MAX_BUTTON_LABEL_LENGTH = 60
const MAX_LIST_ITEMS = 20

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) {
    return label
  }

  return `${label.slice(0, Math.max(1, maxLength - 1))}…`
}

export const homeScreen: any = {
  display(snapshot: AppSnapshot, nav: any) {
    return buildHomeRebuildContainer(snapshot, nav)
  },

  action(action: any, nav: any, snapshot: AppSnapshot, ctx: AppActions) {
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

export function buildHomeRebuildContainer(snapshot: AppSnapshot, nav: any, containerID = 1) {
  const buttons = snapshot?.buttons ?? []
  const names = buttons
    .slice(0, MAX_LIST_ITEMS)
    .map((b) => truncateLabel(String(b.label ?? ''), MAX_BUTTON_LABEL_LENGTH))

  if (names.length === 0) {
    names.push('No novels')
  }

  const list = new ListContainerProperty({
    xPosition: 10,
    yPosition: 10,
    width: DISPLAY_W - 20,
    height: DISPLAY_H - 20,
    containerID,
    containerName: 'home-list',
    itemContainer: new ListItemContainerProperty({
      itemCount: names.length,
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: names,
    }),
    isEventCapture: 1,
  })

  return new RebuildPageContainer({
    containerTotalNum: 1,
    listObject: [list],
    textObject: [],
    imageObject: [],
  })
}
