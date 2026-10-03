const FENCE_OPEN_PATTERN = /^(`{3,}|~{3,})/;
const CHECKBOX_LINE_PATTERN = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](.*)$/;

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
  let insideFence = false;
  let fenceMarker = '';
  let checkboxesSeen = 0;

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

    if (checkboxesSeen === checkboxIndex) {
      const [, marker, checkedMarker, rest] = checkboxMatch;
      const toggledMarker = checkedMarker.toLowerCase() === 'x' ? ' ' : 'x';
      lines[lineIndex] = `${marker}[${toggledMarker}]${rest}`;
      return lines.join('\n');
    }
    checkboxesSeen += 1;
  }

  throw new Error(
    `checkboxIndex ${checkboxIndex} is out of range: found ${checkboxesSeen} checkbox(es)`,
  );
};
