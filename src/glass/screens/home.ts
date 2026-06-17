import { moveHighlight } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions } from '../shared'
import { RebuildPageContainer, ListContainerProperty, ListItemContainerProperty, TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { DISPLAY_W, DISPLAY_H } from 'even-toolkit/layout'
import { GLASSES_SEPARATOR_WIDTH } from 'even-toolkit'
import { truncateLabel } from '../shared'

const MAX_BUTTON_LABEL_LENGTH = 60
const MAX_LIST_ITEMS = 1

export const homeScreen: any = {
  display(snapshot: AppSnapshot, nav: any) {
    return buildHomeRebuildContainer(snapshot, nav)
  },

  action(action: any, nav: any, snapshot: AppSnapshot, ctx: AppActions) {
    let padding = 0
    if(snapshot?.buttons && snapshot?.buttons?.length > MAX_LIST_ITEMS) {
      padding = 1
      if(nav.startIndex && nav.startIndex > 0)
        padding = 2
    }
    
    if (action.type === 'HIGHLIGHT_MOVE') {
      const maxHighlightIndex = Math.max(MAX_LIST_ITEMS - 1 + padding, 0)

      return {
        ...nav,
        highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, maxHighlightIndex),
      }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') { 
      if(padding == 2 && nav.highlightedIndex == 0)
        return {
          ...nav,
          startIndex: nav.startIndex - 1
        }

      if(padding == 2 && nav.highlightedIndex == MAX_LIST_ITEMS + 1)
        return {
          ...nav,
          startIndex: nav.startIndex + 1
        }
      
      if(padding == 1 && nav.highlightedIndex == MAX_LIST_ITEMS)
        return {
          ...nav,
          startIndex: nav.startIndex + 1
        }

      const selected = snapshot?.buttons?.[(nav.startIndex && nav.startIndex * MAX_LIST_ITEMS) + nav.highlightedIndex - (padding == 2 ? 1 : 0)]
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
  
  const exceedFlag = buttons.length > MAX_LIST_ITEMS
  const navIndex = nav.startIndex ?? 0

  let names = buttons
    .slice(MAX_LIST_ITEMS*navIndex, MAX_LIST_ITEMS*(navIndex+1))
    .map((b) => truncateLabel(String(b.label ?? ''), MAX_BUTTON_LABEL_LENGTH))

  if(exceedFlag) {
    names = [...names, "Next Chapter"]
  }
  
  
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
