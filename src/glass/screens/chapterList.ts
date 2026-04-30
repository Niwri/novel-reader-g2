import type { AppSnapshot, AppActions } from '../shared'
import { moveHighlight } from 'even-toolkit/glass-nav'
import { RebuildPageContainer, ListContainerProperty, ListItemContainerProperty } from '@evenrealities/even_hub_sdk'
import { DISPLAY_H, DISPLAY_W } from 'even-toolkit/layout'

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

export const chapterListScreen: any = {
  display(snapshot: AppSnapshot, nav: any) {
    return buildChapterListRebuildContainer(snapshot, nav)
  },

  action(action: any, nav: any, snapshot: AppSnapshot, ctx: AppActions) {
    const entries = getChapterListEntries(snapshot, nav)
    const maxHighlightIndex = Math.max(entries.length - 1, 0)
    const safeHighlight = Math.max(0, Math.min(Number(nav?.highlightedIndex ?? 0), maxHighlightIndex))

    if (action.type === 'HIGHLIGHT_MOVE') {
      return {
        ...nav,
        highlightedIndex: moveHighlight(safeHighlight, action.direction, maxHighlightIndex),
      }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      const selected = entries[safeHighlight]
      if (!selected) return { ...nav, highlightedIndex: safeHighlight }

      if (selected.kind === 'chapter') {
        void ctx.selectChapter(selected.chapterIndex).then(() => {
          ctx.navigate('/chapter')
        })

        return { ...nav, highlightedIndex: safeHighlight }
      }

      // Drill down into the selected range.
      const stack = normalizeStack(nav, snapshot)
      stack.push({ start: selected.start, count: selected.count })
      return { ...nav, highlightedIndex: 0, chapterListStack: stack }
    }

    if (action.type === 'GO_BACK') {
      const stack = normalizeStack(nav, snapshot)
      if (stack.length > 1) {
        stack.pop()
        return { ...nav, highlightedIndex: 0, chapterListStack: stack }
      }
      ctx.navigate('/')
      return nav
    }

    return { ...nav, highlightedIndex: safeHighlight }
  },
}

type ChapterListStackFrame = { start: number; count: number }

type ChapterListEntry =
  | { kind: 'range'; label: string; start: number; count: number }
  | { kind: 'chapter'; label: string; chapterIndex: number }

function normalizeStack(nav: any, snapshot: AppSnapshot): ChapterListStackFrame[] {
  const total = snapshot?.buttons?.length ?? 0
  const raw = nav?.chapterListStack

  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ start: 0, count: total }]
  }

  const cleaned: ChapterListStackFrame[] = []
  for (const frame of raw) {
    const start = Number(frame?.start ?? 0)
    const count = Number(frame?.count ?? 0)
    if (!Number.isFinite(start) || !Number.isFinite(count)) continue
    if (count <= 0) continue
    cleaned.push({ start: Math.max(0, start), count })
  }

  if (cleaned.length === 0) cleaned.push({ start: 0, count: total })
  return cleaned
}

function computeChunkSize(count: number): number {
  // Goal: <= 10 entries per level, drilling down by powers of 10.
  if (count <= 10) return 1
  const raw = count / 10
  const exp = Math.ceil(Math.log10(raw))
  return Math.pow(10, Math.max(1, exp))
}

function getChapterListEntries(snapshot: AppSnapshot, nav: any): ChapterListEntry[] {
  const buttons = snapshot?.buttons ?? []
  const total = buttons.length
  if (total === 0) return []

  const stack = normalizeStack(nav, snapshot)
  const { start, count } = stack[stack.length - 1]
  const safeStart = Math.max(0, Math.min(start, Math.max(total - 1, 0)))
  const safeEndExclusive = Math.min(total, safeStart + Math.max(0, count))
  const safeCount = Math.max(0, safeEndExclusive - safeStart)

  if (safeCount <= 10) {
    const slice = buttons.slice(safeStart, safeEndExclusive)
    return slice.map((b, i) => ({
      kind: 'chapter',
      label: truncateLabel(String(b.label ?? ''), MAX_BUTTON_LABEL_LENGTH),
      chapterIndex: safeStart + i,
    }))
  }

  const chunkSize = computeChunkSize(safeCount)
  const groups: ChapterListEntry[] = []
  for (let groupStart = safeStart; groupStart < safeEndExclusive; groupStart += chunkSize) {
    const groupEndExclusive = Math.min(safeEndExclusive, groupStart + chunkSize)
    const groupCount = groupEndExclusive - groupStart
    if (groupCount <= 0) continue

    const label = `${groupStart}-${groupEndExclusive - 1}`
    groups.push({ kind: 'range', label, start: groupStart, count: groupCount })
    if (groups.length >= 10) break
  }

  return groups
}

export function buildChapterListRebuildContainer(snapshot: AppSnapshot, nav: any, containerID = 2) {
  const entries = getChapterListEntries(snapshot, nav)
  const names = entries.map((e) => e.label)

  if (names.length === 0) {
    names.push('No chapters')
  }

  const list = new ListContainerProperty({
    xPosition: 10,
    yPosition: 10,
    width: DISPLAY_W - 20,
    height: DISPLAY_H - 20,
    containerID,
    containerName: 'chapter-list',
    itemContainer: new ListItemContainerProperty({
      itemCount: names.length,
      itemWidth: DISPLAY_W - 40,
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
