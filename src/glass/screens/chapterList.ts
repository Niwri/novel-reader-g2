import type { AppSnapshot, AppActions } from "../shared";
import { moveHighlight } from "even-toolkit/glass-nav";
import {
  RebuildPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
} from "@evenrealities/even_hub_sdk";
import { DISPLAY_H, DISPLAY_W } from "even-toolkit/layout";
import {
  truncateLabel,
  LINE_WIDTH,
  GLASSES_CHAPTER_LIST_MAX_ITEMS,
} from "../shared";

export const chapterListScreen: any = {
  display(snapshot: AppSnapshot, nav: any) {
    return buildChapterListRebuildContainer(snapshot, nav);
  },

  action(action: any, nav: any, snapshot: AppSnapshot, ctx: AppActions) {
    const entries = getChapterListEntries(snapshot, nav);
    const maxHighlightIndex = Math.max(entries.length - 1, 0);
    const safeHighlight = Math.max(
      0,
      Math.min(Number(nav?.highlightedIndex ?? 0), maxHighlightIndex),
    );

    if (action.type === "HIGHLIGHT_MOVE") {
      return {
        ...nav,
        highlightedIndex: moveHighlight(
          safeHighlight,
          action.direction,
          maxHighlightIndex,
        ),
      };
    }

    if (action.type === "SELECT_HIGHLIGHTED") {
      const selected = entries[safeHighlight];
      if (!selected) return { ...nav, highlightedIndex: safeHighlight };

      const stack = getStack(nav, snapshot);
      const continueChapterIndex = Number(snapshot?.continueChapterIndex ?? -1);
      const continueCharOffset = Math.max(
        0,
        Number(snapshot?.continueCharOffset ?? 0),
      );

      if (selected.kind === "chapter") {
        if (selected.chapterIndex === -1) {
          if (continueChapterIndex >= 0) {
            void ctx.setPosition(continueCharOffset);
            void ctx.selectChapter(continueChapterIndex).then(() => {
              ctx.navigate("/chapter");
            });
          }
        } else {
          void ctx.setPosition(0);
          void ctx.updatePosition({
            chapterIndex: selected.chapterIndex,
            charOffset: 0,
          });
          void ctx.selectChapter(selected.chapterIndex).then(() => {
            ctx.navigate("/chapter");
          });
        }

        return { ...nav, highlightedIndex: safeHighlight };
      }

      // Drill down into the selected range.
      const nextStack = [
        ...stack,
        { start: selected.start, count: selected.count },
      ];
      return { ...nav, highlightedIndex: 0, chapterListStack: nextStack };
    }

    if (action.type === "GO_BACK") {
      const stack = getStack(nav, snapshot);
      if (stack.length > 1) {
        const nextStack = stack.slice(0, -1);
        return { ...nav, highlightedIndex: 0, chapterListStack: nextStack };
      }
      ctx.navigate("/");
      return nav;
    }

    return { ...nav, highlightedIndex: safeHighlight };
  },
};

type ChapterListStackFrame = { start: number; count: number };

type ChapterListEntry =
  | { kind: "range"; label: string; start: number; count: number }
  | { kind: "chapter"; label: string; chapterIndex: number };

function getStack(nav: any, snapshot: AppSnapshot): ChapterListStackFrame[] {
  const total = snapshot?.buttons?.length ?? 0;
  const raw = nav?.chapterListStack;

  if (!Array.isArray(raw) || raw.length === 0)
    return [{ start: 0, count: total }];

  return raw.slice();
}

function computeChunkSize(count: number): number {
  if (count <= GLASSES_CHAPTER_LIST_MAX_ITEMS) return 1;
  const raw = count / GLASSES_CHAPTER_LIST_MAX_ITEMS;
  const exp = Math.ceil(Math.log10(raw));
  return Math.pow(10, Math.max(1, exp));
}

function getChapterListEntries(
  snapshot: AppSnapshot,
  nav: any,
): ChapterListEntry[] {
  const buttons = snapshot?.buttons ?? [];
  const total = buttons.length;
  if (total === 0) return [];

  const stack = getStack(nav, snapshot);
  const { start, count } = stack[stack.length - 1];
  const safeStart = Math.max(0, Math.min(start, Math.max(total - 1, 0)));
  const safeEndExclusive = Math.min(total, safeStart + Math.max(0, count));
  const safeCount = Math.max(0, safeEndExclusive - safeStart);
  const isRootRange =
    stack.length <= 1 && safeStart === 0 && safeEndExclusive === total;
  const continueChapterIndex = Number(snapshot?.continueChapterIndex ?? -1);
  const hasContinueAtRoot = isRootRange && continueChapterIndex >= 0;
  const continueLabel = hasContinueAtRoot
    ? truncateLabel(
        `Continue at: ${String(buttons[continueChapterIndex]?.label ?? "Saved position")}`,
        LINE_WIDTH,
      )
    : "";

  if (safeCount <= GLASSES_CHAPTER_LIST_MAX_ITEMS) {
    const slice = buttons.slice(safeStart, safeEndExclusive);
    const chapterEntries: ChapterListEntry[] = slice.map((b) => ({
      kind: "chapter",
      label: truncateLabel(String(b.label ?? ""), LINE_WIDTH),
      chapterIndex: Number(b.index ?? -1),
    }));

    if (hasContinueAtRoot) {
      return [
        {
          kind: "chapter",
          label: continueLabel,
          chapterIndex: -1,
        },
        ...chapterEntries,
      ];
    }

    return chapterEntries;
  }

  const chunkSize = computeChunkSize(safeCount);
  const groups: ChapterListEntry[] = [];
  let firstGroupStart = safeStart;
  let maxGroups = GLASSES_CHAPTER_LIST_MAX_ITEMS;

  if (hasContinueAtRoot) {
    groups.push({
      kind: "chapter",
      label: continueLabel,
      chapterIndex: -1,
    });
    firstGroupStart = safeStart;
    maxGroups = GLASSES_CHAPTER_LIST_MAX_ITEMS - 1;
  }

  for (
    let groupStart = firstGroupStart;
    groupStart < safeEndExclusive;
    groupStart += chunkSize
  ) {
    const groupEndExclusive = Math.min(
      safeEndExclusive,
      groupStart + chunkSize,
    );
    const groupCount = groupEndExclusive - groupStart;
    if (groupCount <= 0) continue;

    const label = `Sections ${groupStart}-${groupEndExclusive - 1}`;
    groups.push({ kind: "range", label, start: groupStart, count: groupCount });
    if (groups.length >= maxGroups) break;
  }

  return groups;
}

export function buildChapterListRebuildContainer(
  snapshot: AppSnapshot,
  nav: any,
  containerID = 2,
) {
  const entries = getChapterListEntries(snapshot, nav);
  const names = entries.map((e) => e.label);

  if (names.length === 0) {
    names.push("No chapters");
  }

  const list = new ListContainerProperty({
    xPosition: 10,
    yPosition: 10,
    width: DISPLAY_W - 20,
    height: DISPLAY_H - 20,
    containerID,
    containerName: "chapter-list",
    itemContainer: new ListItemContainerProperty({
      itemCount: names.length,
      itemWidth: DISPLAY_W - 40,
      isItemSelectBorderEn: 1,
      itemName: names,
    }),
    isEventCapture: 1,
  });

  return new RebuildPageContainer({
    containerTotalNum: 1,
    listObject: [list],
    textObject: [],
    imageObject: [],
  });
}
