import { isHumanAuthoredInvestigationTaskCloseOverride } from './isHumanAuthoredInvestigationTaskCloseOverride';

describe('isHumanAuthoredInvestigationTaskCloseOverride', () => {
  it.each([
    {
      name: 'returns false for an automated report even when the title contains an investigation keyword',
      title: 'ログイン障害の調査',
      body: 'From: :robot: chore (model)\n\nInvestigated and nothing found.',
      expected: false,
    },
    {
      name: 'returns true for a human-authored issue whose title contains the newly added "research" keyword',
      title: 'Please do deep research on this subject',
      body: 'No automated prefix here, just a plain description.',
      expected: true,
    },
    {
      name: 'returns true for a human-authored issue whose body contains an existing Japanese keyword',
      title: 'Something happened',
      body: 'Please prepare a 報告 (report) on this incident.',
      expected: true,
    },
    {
      name: 'returns false when the body contains the calendar edit-template link even though it also contains a keyword',
      title: 'Weekly check-in',
      body: 'Produce the performance evaluation 報告 (report). [edit this template](https://calendar.google.com/calendar/event?eid=abc123)',
      expected: false,
    },
    {
      name: 'returns false when the title contains the "research" keyword but the body carries the calendar edit-template link',
      title: 'Please research this before tomorrow',
      body: 'Routine recurring task. [edit this template](https://calendar.google.com/calendar/event?eid=def456)',
      expected: false,
    },
    {
      name: 'returns false for a human-authored issue whose title and body contain no keyword',
      title: 'Update the dependency versions',
      body: 'Bump the npm packages to the latest minor version.',
      expected: false,
    },
    {
      name: 'returns false when both the automated-report prefix and the edit-template link are present alongside a keyword',
      title: 'Status update',
      body: 'From: :robot: chore (model)\n\nFiled the monthly 報告 (report). [edit this template](https://calendar.google.com/calendar/event?eid=ghi789)',
      expected: false,
    },
    {
      name: 'returns false when the body contains the calendar "template edit" link label with a keyword (the Zapier template variant)',
      title: 'Attachment check',
      body: '- [ ] 添付ファイルを確認：\n\n[template edit](https://calendar.google.com/calendar/event?eid=jkl012)',
      expected: false,
    },
    {
      name: 'returns true when a non-calendar link label contains "template" and the body has a keyword',
      title: 'Attachment check',
      body: 'Please 確認 the attachment. [template guide](https://example.com/template-guide)',
      expected: true,
    },
    {
      name: 'returns true when only the first line is human-authored even though a later line quotes a past automated report',
      title: 'Please 確認 this',
      body: 'Can you 確認 the deployment went well?\n\nQuoting an earlier update:\n> From: :robot: chore (model)\n> Completed.',
      expected: true,
    },
    {
      name: 'returns true when only the title contains the "research" keyword and the body has none',
      title: 'Market research needed',
      body: 'We need this for the upcoming planning session.',
      expected: true,
    },
    {
      name: 'returns false for an empty title and body',
      title: '',
      body: '',
      expected: false,
    },
    {
      name: 'returns true when the keyword is capitalized',
      title: 'Research the login failure impact',
      body: 'Please look into this.',
      expected: true,
    },
  ])('$name', ({ title, body, expected }) => {
    expect(isHumanAuthoredInvestigationTaskCloseOverride({ title, body })).toBe(
      expected,
    );
  });
});
