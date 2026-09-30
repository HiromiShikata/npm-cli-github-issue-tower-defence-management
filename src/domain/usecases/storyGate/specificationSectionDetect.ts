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

const LEVEL_TWO_HEADING_PATTERN = /^##\s+(.+?)\s*#*\s*$/;
const HIGHER_LEVEL_HEADING_PATTERN = /^#{1,2}\s/;
const NUMBERED_ITEM_PATTERN =
  /^\s*(?:[-*+]\s+)?(?:\d+[.)]\s+\S|[A-Z]{2,}-\d+:)/;

const sectionLinesByHeading = (body: string): Map<string, string[][]> => {
  const sections = new Map<string, string[][]>();
  let currentLines: string[] | null = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const headingMatch = line.match(LEVEL_TWO_HEADING_PATTERN);
    if (headingMatch) {
      const heading = headingMatch[1].trim().toLowerCase();
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
