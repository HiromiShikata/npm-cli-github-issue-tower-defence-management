import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { specificationSectionsDetect } from './specificationSectionDetect';

describe('specificationSectionsDetect', () => {
  it.each([
    {
      name: 'English sections with numbered items',
      body: '## Requirements\n1. Show the list\n\n## Acceptance Criteria\n1. The list is shown',
      expected: { hasNumberedRequirements: true, hasNumberedCriteria: true },
    },
    {
      name: 'FR and SC list items',
      body: '## Functional Requirements\n- FR-001: The list MUST be sortable\n\n## Success Criteria\n- SC-001: Sorting finishes within one second',
      expected: { hasNumberedRequirements: true, hasNumberedCriteria: true },
    },
    {
      name: 'Japanese requirement and acceptance sections',
      body: '## 要件\n1. 一覧を表示する\n\n## 受入基準\n1. 一覧が表示される',
      expected: { hasNumberedRequirements: true, hasNumberedCriteria: true },
    },
    {
      name: 'Japanese functional requirement and completion sections',
      body: '## 機能要件\n1. 一覧を表示する\n\n## 完了条件\n1. 一覧が表示される',
      expected: { hasNumberedRequirements: true, hasNumberedCriteria: true },
    },
    {
      name: 'completion section holding only prose',
      body: '## 要件\n1. 一覧を表示する\n\n## 完了条件\n一覧が表示されること。',
      expected: { hasNumberedRequirements: true, hasNumberedCriteria: false },
    },
    {
      name: 'requirement section holding only prose',
      body: '## Requirements\nThe list should be shown.\n\n## Acceptance Criteria\n1. The list is shown',
      expected: { hasNumberedRequirements: false, hasNumberedCriteria: true },
    },
    {
      name: 'numbered items outside any specification section',
      body: '1. Show the list\n\n## Notes\n1. The list is shown',
      expected: { hasNumberedRequirements: false, hasNumberedCriteria: false },
    },
    {
      name: 'numbered items under a later unrelated heading',
      body: '## Requirements\nProse only.\n\n## Tasks\n1. Implement\n\n## Acceptance Criteria\nProse only.\n\n## Notes\n1. Remember',
      expected: { hasNumberedRequirements: false, hasNumberedCriteria: false },
    },
    {
      name: 'empty body',
      body: '',
      expected: { hasNumberedRequirements: false, hasNumberedCriteria: false },
    },
  ])('detects $name', ({ body, expected }) => {
    expect(specificationSectionsDetect(body)).toEqual(expected);
  });
});

describe('specificationSectionsDetect heading line recognition (current behaviour)', () => {
  const requirementsItem = '1. Show the list';
  const criteriaItem = '1. The list is shown';
  const noMatch = {
    hasNumberedRequirements: false,
    hasNumberedCriteria: false,
  };
  const requirementsOnly = {
    hasNumberedRequirements: true,
    hasNumberedCriteria: false,
  };
  const criteriaOnly = {
    hasNumberedRequirements: false,
    hasNumberedCriteria: true,
  };
  const both = { hasNumberedRequirements: true, hasNumberedCriteria: true };

  it.each([
    {
      name: 'plain level-two heading',
      body: `## Requirements\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'heading with trailing spaces',
      body: `## Requirements   \n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'heading with trailing tab',
      body: `## Requirements\t\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'heading with extra spaces after the hashes',
      body: `##   Requirements\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'heading with a closing hash sequence',
      body: `## Requirements ##\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'heading with a closing hash directly after the text',
      body: `## Requirements#\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'heading in upper case',
      body: `## REQUIREMENTS\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'heading with CRLF line endings',
      body: `## Requirements\r\n${requirementsItem}\r\n`,
      expected: requirementsOnly,
    },
    {
      name: 'heading with an internal double space does not match the known name',
      body: `## Acceptance   Criteria\n${criteriaItem}`,
      expected: noMatch,
    },
    {
      name: 'heading with text after a closing-looking hash sequence',
      body: `## Requirements ## extra\n${requirementsItem}`,
      expected: noMatch,
    },
    {
      name: 'level-two marker with no heading text ends the section',
      body: `## Requirements\n## \n${requirementsItem}`,
      expected: noMatch,
    },
    {
      name: 'bare hash line is content of the section',
      body: `## Requirements\n#\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'level-one heading ends the section',
      body: `## Requirements\n# Title\n${requirementsItem}`,
      expected: noMatch,
    },
    {
      name: 'level-three heading is content of the section',
      body: `## Requirements\n### Sub\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'hash line without a space is content of the section',
      body: `## Requirements\n#Title\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'indented level-two marker is content of the section',
      body: `## Requirements\n  ## Acceptance Criteria\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'indented level-two heading is not a heading',
      body: `  ## Requirements\n${requirementsItem}`,
      expected: noMatch,
    },
    {
      name: 'level-two marker without a space is not a heading',
      body: `##Requirements\n${requirementsItem}`,
      expected: noMatch,
    },
    {
      name: 'Japanese requirement heading',
      body: `## 要件\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'Japanese functional requirement heading',
      body: `## 機能要件\n${requirementsItem}`,
      expected: requirementsOnly,
    },
    {
      name: 'Japanese acceptance criteria heading',
      body: `## 受入基準\n${criteriaItem}`,
      expected: criteriaOnly,
    },
    {
      name: 'Japanese completion criteria heading',
      body: `## 完了条件\n${criteriaItem}`,
      expected: criteriaOnly,
    },
    {
      name: 'success criteria heading with closing hashes and bullet item',
      body: '## Success Criteria ##\n- SC-001: Sorting finishes within one second',
      expected: criteriaOnly,
    },
    {
      name: 'numbered item with a closing parenthesis',
      body: `## Requirements\n1) Show the list`,
      expected: requirementsOnly,
    },
    {
      name: 'two-digit numbered item',
      body: `## Requirements\n10. Show the list`,
      expected: requirementsOnly,
    },
    {
      name: 'numbered marker without a following space is not an item',
      body: `## Requirements\n1.Show the list`,
      expected: noMatch,
    },
    {
      name: 'numbered marker with no item text is not an item',
      body: `## Requirements\n1.`,
      expected: noMatch,
    },
    {
      name: 'heading with no items under it',
      body: '## Requirements\nProse only.',
      expected: noMatch,
    },
    {
      name: 'requirement and criteria sections in one body',
      body: `## Requirements\n${requirementsItem}\n\n## Notes\n1. Remember\n\n## Acceptance Criteria\n${criteriaItem}`,
      expected: both,
    },
    {
      name: 'same heading repeated, item under the second occurrence',
      body: `## Requirements\nProse only.\n\n## Requirements\n${requirementsItem}`,
      expected: requirementsOnly,
    },
  ])('$name', ({ body, expected }) => {
    expect(specificationSectionsDetect(body)).toEqual(expected);
  });
});

describe('specificationSectionsDetect heading line performance', () => {
  const HEADING_TIME_BOUND_MS = 1000;
  const CHILD_KILL_TIMEOUT_MS = 4000;

  // A synchronous regex cannot be interrupted by the Jest timeout, so the
  // function runs in a child Node process that the parent kills after
  // CHILD_KILL_TIMEOUT_MS. A catastrophic backtrack then fails the test
  // instead of hanging the whole suite. The child imports the TypeScript
  // source directly through Node's built-in type stripping.
  const childScript = `
    import { pathToFileURL } from 'node:url';
    const sourceModule = await import(pathToFileURL(process.argv[1]).href);
    const body = process.argv[2];
    const started = Date.now();
    const result = sourceModule.specificationSectionsDetect(body);
    process.stdout.write(JSON.stringify({ elapsedMs: Date.now() - started, result }));
  `;

  const sourcePath = path.join(__dirname, 'specificationSectionDetect.ts');

  type ChildReport = { elapsedMs: number; result: unknown };

  const isChildReport = (value: unknown): value is ChildReport =>
    typeof value === 'object' &&
    value !== null &&
    'elapsedMs' in value &&
    typeof value.elapsedMs === 'number' &&
    'result' in value;

  it('returns a level-two heading line followed by a long run of spaces and a letter within the time bound', () => {
    const body = `## a${' '.repeat(10000)}x`;
    const run = spawnSync(
      process.execPath,
      [
        '--no-warnings',
        '--input-type=module',
        '-e',
        childScript,
        sourcePath,
        body,
      ],
      { encoding: 'utf8', timeout: CHILD_KILL_TIMEOUT_MS },
    );

    expect({ signal: run.signal, error: run.error?.message ?? null }).toEqual({
      signal: null,
      error: null,
    });
    expect(run.status).toBe(0);
    const report: unknown = JSON.parse(run.stdout);
    if (!isChildReport(report)) {
      throw new Error(`unexpected child output: ${run.stdout}`);
    }
    const { elapsedMs, result } = report;
    expect(elapsedMs).toBeLessThan(HEADING_TIME_BOUND_MS);
    expect(result).toEqual({
      hasNumberedRequirements: false,
      hasNumberedCriteria: false,
    });
  }, 5000);
});
