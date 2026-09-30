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
