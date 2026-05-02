import { moveHighlight } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions } from '../shared'
import { RebuildPageContainer, ListContainerProperty, ListItemContainerProperty, TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { DISPLAY_W, DISPLAY_H } from 'even-toolkit/layout'
import { GLASSES_SEPARATOR_WIDTH } from 'even-toolkit'
import { truncateLabel } from '../shared'

const MAX_BUTTON_LABEL_LENGTH = 60
const MAX_LIST_ITEMS = 20

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
      void ctx.selectNovel(selected.index).then(async () => {
        await ctx.checkLoadedChapters()
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
  
  const header = 'Pick Your Novel'
  const noNovel = 'Add a novel on the phone to get started!'

  let text = [
    new TextContainerProperty({
      xPosition: DISPLAY_W/2 - header.length*5,
      yPosition: 0,
      width: header.length*10,
      height: 30,
      containerID: 5,
      containerName: 'home-title',

      content: header,
      isEventCapture: 0
    })
  ]

  if(names.length === 0)
    text.push(
      new TextContainerProperty({
        xPosition: DISPLAY_W/2 - noNovel.length*5,
        yPosition: 70,
        width: noNovel.length*10,
        height: 30,
        containerID: 7,
        containerName: 'home-no-novel',
        content: noNovel,
        isEventCapture: 0
      })
    )


  const list = new ListContainerProperty({
    xPosition: 10,
    yPosition: 70,
    width: DISPLAY_W - 20,
    height: Math.min(DISPLAY_H - 70, names.length * 40),
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
    containerTotalNum: 3,
    listObject: names.length === 0 ? [] : [list],
    textObject: text,
    imageObject: [],
  })
}
