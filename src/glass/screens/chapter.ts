import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import type { AppSnapshot, AppActions } from '../shared'
import { buildScrollableContent, buildScrollableList } from 'even-toolkit'
import { moveHighlight } from 'even-toolkit/glass-nav'
import { DisplayData, DisplayLine, LineStyle, line } from 'even-toolkit'

// --- Interface ---
interface ScrollableContentChapterOptions {
  title: string,
  contentLines: string[]
}

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

function buildScrollableChapter(opts: ScrollableContentChapterOptions): DisplayData {
  const {
    title,
    contentLines
  } = opts;

  const lines = [{ text: title, inverted: false, style: 'normal' as LineStyle },
    { text: '', inverted: false, style: 'separator' as LineStyle }];


  const contentDisplayLines: DisplayLine[] = [];
  for (const text of contentLines) {
    contentDisplayLines.push(line(text, 'meta', false));
  }

  lines.push(...contentDisplayLines);

  return { lines };
}

export const chapterScreen: GlassScreen<AppSnapshot, AppActions> = {

    display(snapshot, nav) {
      return buildScrollableChapter({
        title: snapshot.title ? truncateLabel(snapshot.title, 60) : "",
        contentLines: snapshot.texts?.slice(0, 5) ?? []
      })
    },

    action(action, nav, snapshot, ctx) {
      if (action.type === 'GO_BACK') {
        ctx.navigate('/chapter-list')
      }

      return nav
    },
}
