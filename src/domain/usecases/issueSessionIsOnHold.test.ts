import { issueSessionIsOnHold } from './issueSessionIsOnHold';

describe('issueSessionIsOnHold', () => {
  it('classifies every populated hold field as held', () => {
    const empty = {
      dependedIssueUrls: [],
      nextActionDate: null,
      nextActionHour: null,
    };
    const cases = [
      { issue: empty, held: false },
      {
        issue: {
          ...empty,
          dependedIssueUrls: ['https://github.com/demo/repo/issues/9'],
        },
        held: true,
      },
      {
        issue: { ...empty, nextActionDate: new Date('2000-01-01T00:00:00Z') },
        held: true,
      },
      {
        issue: { ...empty, nextActionDate: new Date('2030-01-01T00:00:00Z') },
        held: true,
      },
      { issue: { ...empty, nextActionHour: 0 }, held: true },
      { issue: { ...empty, nextActionHour: 23 }, held: true },
    ];
    for (const { issue, held } of cases)
      expect(issueSessionIsOnHold(issue)).toBe(held);
  });
});
