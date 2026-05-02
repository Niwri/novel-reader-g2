import type { AppSnapshot, AppActions } from '../shared'
import { RebuildPageContainer, TextContainerProperty, TextContainerUpgrade, ListContainerProperty, ListItemContainerProperty } from '@evenrealities/even_hub_sdk'
import { DISPLAY_H, DISPLAY_W } from 'even-toolkit/layout'
import { moveHighlight } from 'even-toolkit'
import { truncateLabel, LINE_WIDTH } from '../shared'

const MAX_CONTENT_CHARS = 940
const WINDOW_OVERLAP_LINES = 10
const END_PADDING = '\n'

type ChapterNavState = {
  toggleMenu?: Boolean
  chapterScrollOffset?: number
  chapterEndAttempts?: number
}

type WindowInfo = {
  content: string
  offset: number
  maxOffset: number
  startLineIndex: number
  lineCount: number
  contentLength: number
}

function getChapterParts(snapshot: AppSnapshot) {
  const title = '── ' + truncateLabel((snapshot.title ?? '').trim(), 50) + ' ──'
  const text = (snapshot.texts ?? []).join('\n')
  const rawBody = title.length > 0 ? `${title}\n\n${text}` : text
  const body = formatToFixedLines(rawBody, LINE_WIDTH)
  const availableBodyChars = Math.max(0, MAX_CONTENT_CHARS)

  return { body, availableBodyChars }
}

function getScrollState(nav: any): ChapterNavState {
  return {
    toggleMenu: nav?.toggleMenu ?? false,
    chapterScrollOffset: Math.max(0, Number(nav?.chapterScrollOffset ?? 0)),
    chapterEndAttempts: Math.max(0, Number(nav?.chapterEndAttempts ?? 0)),
  }
}

function formatToFixedLines(input: string, width: number): string {
  if (!input) return ''

  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const maxWidth = Math.max(1, Math.floor(width))

  let out = ''
  let line = ''
  let col = 0
  let pendingSpace = false

  function flushLine(withNewline: boolean) {
    out += line
    if (withNewline) out += '\n'
    line = ''
    col = 0
    pendingSpace = false
  }

  // Tokenize into: newline | whitespace (excluding newline) | word
  const matcher = /\n|[^\S\n]+|\S+/g
  let match: RegExpExecArray | null

  while ((match = matcher.exec(normalized)) !== null) {
    const token = match[0] ?? ''
    if (token.length === 0) continue

    if (token === '\n') {
      flushLine(true)
      continue
    }

    // Any non-newline whitespace becomes a single pending space.
    if (/^[^\S\n]+$/.test(token)) {
      if (col > 0) pendingSpace = true
      continue
    }

    // Word token.
    let word = token

    // If the word is longer than a full line, hard-split it.
    while (word.length > maxWidth) {
      if (col > 0) flushLine(true)
      out += word.slice(0, maxWidth) + '\n'
      word = word.slice(maxWidth)
    }

    const needed = (pendingSpace ? 1 : 0) + word.length

    if (col > 0 && col + needed > maxWidth) {
      flushLine(true)
    }

    if (pendingSpace && col > 0) {
      line += ' '
      col += 1
    }

    line += word
    col += word.length
    pendingSpace = false
  }

  flushLine(false)
  return out
}

function buildLineStartOffsets(lines: string[]): number[] {
  const offsets: number[] = new Array(lines.length)
  let acc = 0
  for (let i = 0; i < lines.length; i += 1) {
    offsets[i] = acc
    acc += lines[i]!.length
    if (i < lines.length - 1) acc += 1 // newline
  }
  return offsets
}

function findLineIndexAtOrBeforeOffset(lineStarts: number[], offset: number): number {
  if (lineStarts.length === 0) return 0
  if (offset <= 0) return 0

  let lo = 0
  let hi = lineStarts.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = lineStarts[mid]!
    if (v === offset) return mid
    if (v < offset) lo = mid + 1
    else hi = mid - 1
  }

  return Math.max(0, Math.min(lineStarts.length - 1, hi))
}

function buildWindowInfo(body: string, offset: number, maxLength: number): WindowInfo {
  const paddedBody = body
  const lines = [...paddedBody.split('\n'), ...END_PADDING.split('')]
  const lineStarts = buildLineStartOffsets(lines)
  const contentLength = paddedBody.length + END_PADDING.length

  if (lines.length === 0) {
    return {
      content: '',
      offset: 0,
      maxOffset: 0,
      startLineIndex: 0,
      lineCount: 0,
      contentLength: 0,
    }
  }

  const rawMaxOffset = Math.max(0, paddedBody.length-1 + END_PADDING.length)
  const maxStartLineIndex = findLineIndexAtOrBeforeOffset(lineStarts, rawMaxOffset)

  // GET NEXT CHAPTER OFFSET
  const refNextOffset = Math.max(0, paddedBody.length-maxLength + END_PADDING.length)
  const refMaxStartLineIndex = findLineIndexAtOrBeforeOffset(lineStarts, refNextOffset)
  const refMaxOffset = lineStarts[refMaxStartLineIndex] ?? 0

  const requestedLineIndex = findLineIndexAtOrBeforeOffset(lineStarts, offset)
  const startLineIndex = Math.max(0, Math.min(requestedLineIndex, maxStartLineIndex))
  const safeOffset = lineStarts[startLineIndex] ?? 0

  let content = ''
  let lineCount = 0

  for (let i = startLineIndex; i < lines.length; i += 1) {
    const prefix = lineCount === 0 ? '' : '\n'
    const nextChunk = prefix + (lines[i] ?? '')

    if (content.length > 0 && content.length + nextChunk.length > maxLength) {
      break
    }

    if (content.length === 0 && nextChunk.length > maxLength) {
      content = nextChunk.slice(0, Math.max(0, maxLength))
      lineCount = 1
      break
    }

    content += nextChunk
    lineCount += 1
  }

  return {
    content,
    offset: safeOffset,
    maxOffset: refMaxOffset,
    startLineIndex,
    lineCount,
    contentLength,
  }
}

function shiftWindowOffset(body: string, current: WindowInfo, direction: 'up' | 'down', maxLength: number): number {
  const paddedBody = body
  const lines = [...paddedBody.split('\n'), ...END_PADDING.split('')]
  const lineStarts = buildLineStartOffsets(lines)

  const rawMaxOffset = Math.max(0, paddedBody.length-1 + END_PADDING.length)
  const maxStartLineIndex = findLineIndexAtOrBeforeOffset(lineStarts, rawMaxOffset)

  const stepLines = Math.max(1, (current.lineCount || 1) - WINDOW_OVERLAP_LINES)

  if (direction === 'down') {
    const nextStartLine = Math.min(maxStartLineIndex, current.startLineIndex + stepLines)
    return lineStarts[nextStartLine]
  }

  const nextStartLine = Math.max(0, current.startLineIndex - stepLines)
  return Math.max(0, lineStarts[nextStartLine] ?? 0)
}

function advanceToNextChapter(snapshot: AppSnapshot, ctx: AppActions) {
  const chapterIndex = Number(snapshot.chapterIndex ?? -1)
  const chapterCount = Number(snapshot.chapterCount ?? 0)

  if (chapterIndex < 0 || chapterCount <= 0) return false
  if (chapterIndex >= chapterCount - 1) return false

  const next = chapterIndex + 1

  void ctx.selectChapter(next).then(() => {
    ctx.navigate('/chapter')
  })

  return true
}
function advanceToPreviousChapter(snapshot: AppSnapshot, ctx: AppActions) {
  const chapterIndex = Number(snapshot.chapterIndex ?? -1)
  const chapterCount = Number(snapshot.chapterCount ?? 0)

  if (chapterIndex < 0 || chapterCount <= 0) return false
  if (chapterIndex <= 0) return false

  const prev = chapterIndex - 1

  void ctx.selectChapter(prev).then(() => {
    ctx.navigate('/chapter')
  })

  return true
}

function updateChapterScroll(nav: any, snapshot: AppSnapshot, direction: 'up' | 'down', ctx: AppActions) {
  const { body, availableBodyChars } = getChapterParts(snapshot)
  const scrollState = getScrollState(nav)
  const current = buildWindowInfo(body, scrollState.chapterScrollOffset ?? 0, availableBodyChars)
  const atStart = current.offset <= 0
  const atEnd = current.offset >= current.maxOffset
  console.log(current.offset, current.maxOffset)

  if (direction === 'up') {
    if (atStart) {
      if (advanceToPreviousChapter(snapshot, ctx)) {
        return {
          ...nav,
          chapterScrollOffset: 0,
          chapterEndAttempts: 0,
        }
      }

      return {
        ...nav,
        chapterScrollOffset: 0,
        chapterEndAttempts: 0,
      }
    }

    const nextOffset = shiftWindowOffset(body, current, 'up', availableBodyChars)
    return {
      ...nav,
      chapterScrollOffset: nextOffset,
      chapterEndAttempts: 0,
    }
  }

  if (!atEnd) {
    const nextOffset = shiftWindowOffset(body, current, 'down', availableBodyChars)
    return {
      ...nav,
      chapterScrollOffset: nextOffset,
      chapterEndAttempts: 0,
    }
  }

  const nextAttempts = (scrollState.chapterEndAttempts ?? 0) + 1

  // Require two additional scroll attempts beyond the last window before advancing.
  if (nextAttempts >= 2) {
    if (advanceToNextChapter(snapshot, ctx)) {
      return {
        ...nav,
        chapterScrollOffset: 0,
        chapterEndAttempts: 0,
      }
    }
  }

  return {
    ...nav,
    chapterScrollOffset: current.offset,
    chapterEndAttempts: nextAttempts,
  }
}

export const chapterScreen: any = {
  display(snapshot: AppSnapshot, nav: any) {
    return buildChapterRebuildContainer(snapshot, nav)
  },

  action(action: any, nav: any, snapshot: AppSnapshot, ctx: AppActions) {
    if (action.type === 'HIGHLIGHT_MOVE') { // Triggers when scrolling at the bottom or top of the text container! 
      if(nav.toggleMenu) {
        const maxHighlightIndex = Math.max((snapshot?.buttons?.length ?? 0) - 1, 0)
  
        return {
          ...nav,
          highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, maxHighlightIndex),
        }
      } else return updateChapterScroll(nav, snapshot, action.direction, ctx)
    }

    if (action.type === 'SELECT_HIGHLIGHTED') { // Only relevant for the menu
      if(nav.toggleMenu) {
        const hi = Number(nav.highlightedIndex ?? 0)
        switch(hi) {
          case 0:
            return {
              ...nav,
              highlightedIndex: 0,
              toggleMenu: false
            }
          case 1:  
            if(advanceToNextChapter(snapshot, ctx))
              return {
                ...nav,
                toggleMenu: false,
                highlightedIndex: 0,
                chapterScrollOffset: 0,
                chapterEndAttempts: 0,
              }
            break
          case 2:
            ctx.navigate("/chapter-list")
            return {
              ...nav,
              toggleMenu: false,
              highlightedIndex: 0,
              chapterScrollOffset: 0,
              chapterEndAttempts: 0,
            }
        }

      }
    }

    if (action.type === 'GO_BACK') { // Toggles the menu 
      return {
        ...nav,
        toggleMenu: true
      }
    }

    return nav
  },
}

export function buildChapterRebuildContainer(snapshot: AppSnapshot, nav: any, containerID = 3) {
  const { body, availableBodyChars } = getChapterParts(snapshot)
  const scrollState = getScrollState(nav)
  const windowedBody = buildWindowInfo(body, scrollState.chapterScrollOffset ?? 0, availableBodyChars).content

  const menu = new ListContainerProperty({
    xPosition: DISPLAY_W/2 - 10*10,
    yPosition: DISPLAY_H/2 - 20*4,
    width: 20*10,
    height: 20*8,
    borderColor: 8,
    borderRadius: 5,
    borderWidth: 1,
    paddingLength: 5,
    containerID: 4,
    containerName: 'menu',
    itemContainer: new ListItemContainerProperty({
      itemCount: 3,
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: [
        "Continue",
        "Next Chapter",
        "Back"
      ],
    }),
    isEventCapture: 1,
  })

  const text = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderColor: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingLength: 30,
    containerID,
    containerName: 'chapter',
    content: windowedBody,
    isEventCapture: 1,
  })

  return new RebuildPageContainer({
    containerTotalNum: 1,
    listObject: scrollState.toggleMenu ? [menu] : [],
    textObject: scrollState.toggleMenu ? [] : [text],
    imageObject: [],
  })
}

export function buildChapterTextUpgrade(snapshot: AppSnapshot, nav: any, containerID = 3) {
  const { body, availableBodyChars } = getChapterParts(snapshot)
  const scrollState = getScrollState(nav)
  const window = buildWindowInfo(body, scrollState.chapterScrollOffset ?? 0, availableBodyChars)
  const contentLength = window.contentLength

  if(scrollState.toggleMenu)
    return false

  return new TextContainerUpgrade({
    containerID,
    containerName: 'chapter',
    contentOffset: window.offset,
    contentLength,
    content: window.content,
  })
}
