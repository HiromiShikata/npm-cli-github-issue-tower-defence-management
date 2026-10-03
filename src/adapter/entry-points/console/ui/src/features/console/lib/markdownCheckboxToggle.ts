const FENCE_OPEN_PATTERN = /^(`{3,}|~{3,})/;
const CHECKBOX_LINE_PATTERN = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](.*)$/;

const forEachCheckboxLineOutsideFences = (
  lines: string[],
  visitCheckboxLine: (
    lineIndex: number,
    checkboxMatch: RegExpExecArray,
  ) => void,
): void => {
  let insideFence = false;
  let fenceMarker = '';

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (insideFence) {
      if (trimmedLine.startsWith(fenceMarker)) {
        insideFence = false;
        fenceMarker = '';
      }
      continue;
    }

    const fenceMatch = FENCE_OPEN_PATTERN.exec(trimmedLine);
    if (fenceMatch !== null) {
      insideFence = true;
      fenceMarker = fenceMatch[1];
      continue;
    }

    const checkboxMatch = CHECKBOX_LINE_PATTERN.exec(line);
    if (checkboxMatch === null) {
      continue;
    }

    visitCheckboxLine(lineIndex, checkboxMatch);
  }
};

export const countMarkdownCheckboxes = (source: string): number => {
  let checkboxCount = 0;
  forEachCheckboxLineOutsideFences(source.split('\n'), () => {
    checkboxCount += 1;
  });
  return checkboxCount;
};

export const isMarkdownCheckboxCheckedAtIndex = (
  source: string,
  checkboxIndex: number,
): boolean => {
  if (!Number.isInteger(checkboxIndex) || checkboxIndex < 0) {
    throw new Error(
      `checkboxIndex must be a non-negative integer: ${checkboxIndex}`,
    );
  }
  let checkboxesSeen = 0;
  let checked: boolean | undefined;

  forEachCheckboxLineOutsideFences(
    source.split('\n'),
    (_lineIndex, checkboxMatch) => {
      if (checkboxesSeen === checkboxIndex) {
        checked = checkboxMatch[2].toLowerCase() === 'x';
      }
      checkboxesSeen += 1;
    },
  );

  if (checked === undefined) {
    throw new Error(
      `checkboxIndex ${checkboxIndex} is out of range: found ${checkboxesSeen} checkbox(es)`,
    );
  }
  return checked;
};

export const toggleMarkdownCheckboxAtIndex = (
  source: string,
  checkboxIndex: number,
): string => {
  if (!Number.isInteger(checkboxIndex) || checkboxIndex < 0) {
    throw new Error(
      `checkboxIndex must be a non-negative integer: ${checkboxIndex}`,
    );
  }
  const lines = source.split('\n');
  let checkboxesSeen = 0;
  let toggledLineIndex: number | undefined;
  let toggledLineText: string | undefined;

  forEachCheckboxLineOutsideFences(lines, (lineIndex, checkboxMatch) => {
    if (checkboxesSeen === checkboxIndex) {
      const [, marker, checkedMarker, rest] = checkboxMatch;
      const toggledMarker = checkedMarker.toLowerCase() === 'x' ? ' ' : 'x';
      toggledLineIndex = lineIndex;
      toggledLineText = `${marker}[${toggledMarker}]${rest}`;
    }
    checkboxesSeen += 1;
  });

  if (toggledLineIndex === undefined || toggledLineText === undefined) {
    throw new Error(
      `checkboxIndex ${checkboxIndex} is out of range: found ${checkboxesSeen} checkbox(es)`,
    );
  }

  lines[toggledLineIndex] = toggledLineText;
  return lines.join('\n');
};
