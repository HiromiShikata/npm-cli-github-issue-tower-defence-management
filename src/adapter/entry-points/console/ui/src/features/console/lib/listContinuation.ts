export type ListContinuationResult =
  | { handled: false }
  | { handled: true; value: string; cursorPosition: number };

const TASK_LIST_LINE_PATTERN = /^([ \t]*)([-*+]) \[([ xX])\] (?! )/;
const UNORDERED_LIST_LINE_PATTERN = /^([ \t]*)([-*+]) (?! )/;
const ORDERED_LIST_LINE_PATTERN = /^([ \t]*)(\d+)([.)]) (?! )/;

export const computeListContinuation = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
): ListContinuationResult => {
  const effectiveValue =
    selectionStart !== selectionEnd
      ? value.slice(0, selectionStart) + value.slice(selectionEnd)
      : value;
  const cursorPos = selectionStart;

  const searchEndForLineStart = cursorPos - 1;
  const lastNewlineBeforeCursor =
    searchEndForLineStart < 0
      ? -1
      : effectiveValue.lastIndexOf('\n', searchEndForLineStart);
  const lineStart = lastNewlineBeforeCursor + 1;
  const nextNewlineIndex = effectiveValue.indexOf('\n', cursorPos);
  const lineEnd =
    nextNewlineIndex === -1 ? effectiveValue.length : nextNewlineIndex;
  const line = effectiveValue.slice(lineStart, lineEnd);
  const cursorIndexInLine = cursorPos - lineStart;

  const taskListMatch = TASK_LIST_LINE_PATTERN.exec(line);
  const unorderedMatch =
    taskListMatch === null ? UNORDERED_LIST_LINE_PATTERN.exec(line) : null;
  const orderedMatch =
    taskListMatch === null && unorderedMatch === null
      ? ORDERED_LIST_LINE_PATTERN.exec(line)
      : null;
  const match = taskListMatch ?? unorderedMatch ?? orderedMatch;

  if (match === null) {
    return { handled: false };
  }

  const prefixEnd = match[0].length;
  if (cursorIndexInLine < prefixEnd) {
    return { handled: false };
  }

  const remainderAfterPrefix = line.slice(prefixEnd);
  if (remainderAfterPrefix.trim() === '') {
    return {
      handled: true,
      value: effectiveValue.slice(0, lineStart) + effectiveValue.slice(lineEnd),
      cursorPosition: lineStart,
    };
  }

  const beforeCursorOnLine = line.slice(0, cursorIndexInLine);
  const afterCursorOnLine = line.slice(cursorIndexInLine);
  const indent = match[1];

  const newMarkerPrefix = ((): string => {
    if (taskListMatch !== null) {
      return `${taskListMatch[2]} [ ] `;
    }
    if (unorderedMatch !== null) {
      return `${unorderedMatch[2]} `;
    }
    const orderedNumber = Number((orderedMatch as RegExpExecArray)[2]);
    const orderedSeparator = (orderedMatch as RegExpExecArray)[3];
    return `${orderedNumber + 1}${orderedSeparator} `;
  })();

  const newLineContent = indent + newMarkerPrefix + afterCursorOnLine;

  return {
    handled: true,
    value:
      effectiveValue.slice(0, lineStart) +
      beforeCursorOnLine +
      '\n' +
      newLineContent +
      effectiveValue.slice(lineEnd),
    cursorPosition:
      lineStart +
      beforeCursorOnLine.length +
      1 +
      indent.length +
      newMarkerPrefix.length,
  };
};

export type ListContinuationKeyInfo = {
  key: string;
  isComposing: boolean;
  keyCode: number;
  which: number;
};

export type ListContinuationKeyDownOutcome =
  | { shouldApply: false }
  | { shouldApply: true; value: string; cursorPosition: number };

export const resolveListContinuationOnKeyDown = (
  keyInfo: ListContinuationKeyInfo,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): ListContinuationKeyDownOutcome => {
  const isUnmodifiedEnterKeystroke =
    keyInfo.key === 'Enter' &&
    !keyInfo.isComposing &&
    keyInfo.keyCode !== 229 &&
    keyInfo.which !== 229;
  if (!isUnmodifiedEnterKeystroke) {
    return { shouldApply: false };
  }

  const result = computeListContinuation(value, selectionStart, selectionEnd);
  if (!result.handled) {
    return { shouldApply: false };
  }

  return {
    shouldApply: true,
    value: result.value,
    cursorPosition: result.cursorPosition,
  };
};
