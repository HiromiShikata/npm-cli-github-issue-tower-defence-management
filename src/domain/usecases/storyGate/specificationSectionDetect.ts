export const REQUIREMENT_SECTION_HEADINGS = [
  'requirements',
  'functional requirements',
  '要件',
  '機能要件',
];

export const CRITERIA_SECTION_HEADINGS = [
  'success criteria',
  'acceptance criteria',
  '受入基準',
  '完了条件',
];

export type SpecificationSectionDetection = {
  hasNumberedRequirements: boolean;
  hasNumberedCriteria: boolean;
};

const HIGHER_LEVEL_HEADING_PATTERN = /^#{1,2}\s/;
const NUMBERED_ITEM_PATTERN =
  /^\s*(?:[-*+]\s+)?(?:\d+[.)]\s+\S|[A-Z]{2,}-\d+:)/;
const WHITESPACE_CHARACTER_PATTERN = /\s/;
const LINE_TERMINATOR_CHARACTER_PATTERN = /[\n\r\u2028\u2029]/;

const isWhitespaceCharacter = (character: string): boolean =>
  WHITESPACE_CHARACTER_PATTERN.test(character);

const isLineTerminatorCharacter = (character: string): boolean =>
  LINE_TERMINATOR_CHARACTER_PATTERN.test(character);

const levelTwoHeadingText = (line: string): string | null => {
  if (!line.startsWith('##')) {
    return null;
  }
  const text = line.slice(2);
  const length = text.length;

  let whitespaceRunEnd = 0;
  while (
    whitespaceRunEnd < length &&
    isWhitespaceCharacter(text.charAt(whitespaceRunEnd))
  ) {
    whitespaceRunEnd += 1;
  }

  let tailStart = length;
  while (tailStart > 0 && isWhitespaceCharacter(text.charAt(tailStart - 1))) {
    tailStart -= 1;
  }
  while (tailStart > 0 && text.charAt(tailStart - 1) === '#') {
    tailStart -= 1;
  }
  while (tailStart > 0 && isWhitespaceCharacter(text.charAt(tailStart - 1))) {
    tailStart -= 1;
  }

  const nextTerminatorIndex: number[] = new Array<number>(length + 1);
  nextTerminatorIndex[length] = length;
  for (let index = length - 1; index >= 0; index -= 1) {
    nextTerminatorIndex[index] = isLineTerminatorCharacter(text.charAt(index))
      ? index
      : nextTerminatorIndex[index + 1];
  }

  for (
    let start = Math.min(whitespaceRunEnd, length - 1);
    start >= 1;
    start -= 1
  ) {
    const end = Math.max(tailStart, start + 1);
    if (nextTerminatorIndex[start] >= end) {
      return text.slice(start, end);
    }
  }
  return null;
};

const sectionLinesByHeading = (body: string): Map<string, string[][]> => {
  const sections = new Map<string, string[][]>();
  let currentLines: string[] | null = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const headingText = levelTwoHeadingText(line);
    if (headingText !== null) {
      const heading = headingText.trim().toLowerCase();
      currentLines = [];
      sections.set(heading, [...(sections.get(heading) ?? []), currentLines]);
      continue;
    }
    if (HIGHER_LEVEL_HEADING_PATTERN.test(line)) {
      currentLines = null;
      continue;
    }
    if (currentLines !== null) {
      currentLines.push(line);
    }
  }
  return sections;
};

const hasNumberedItemUnder = (
  sections: Map<string, string[][]>,
  headings: string[],
): boolean =>
  headings.some((heading) =>
    (sections.get(heading) ?? []).some((lines) =>
      lines.some((line) => NUMBERED_ITEM_PATTERN.test(line)),
    ),
  );

export const specificationSectionsDetect = (
  body: string,
): SpecificationSectionDetection => {
  const sections = sectionLinesByHeading(body);
  return {
    hasNumberedRequirements: hasNumberedItemUnder(
      sections,
      REQUIREMENT_SECTION_HEADINGS,
    ),
    hasNumberedCriteria: hasNumberedItemUnder(
      sections,
      CRITERIA_SECTION_HEADINGS,
    ),
  };
};
