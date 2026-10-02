import { isHumanAuthoredInvestigationTaskCloseOverride } from './isHumanAuthoredInvestigationTaskCloseOverride';

describe('isHumanAuthoredInvestigationTaskCloseOverride', () => {
  it.each([
    {
      name: 'table row 1: human-typed body with the investigate keyword (調査) is eligible',
      title: 'Login failure investigation',
      body: 'Please investigate 調査 why users cannot log in since yesterday.',
      expected: true,
    },
    {
      name: 'table row 2: human-typed body with the report keyword (報告) is eligible',
      title: 'Outage report',
      body: 'A report 報告 on the recent outage is needed before closing this.',
      expected: true,
    },
    {
      name: 'table row 3: human-typed body with the analyze keyword (分析) is eligible',
      title: 'Traffic spike',
      body: 'Please analyze 分析 the traffic spike occurring overnight.',
      expected: true,
    },
    {
      name: 'table row 4: human-typed body with the evaluate keyword (評価) is eligible',
      title: 'Pricing model',
      body: 'We need to evaluate 評価 the new pricing model carefully.',
      expected: true,
    },
    {
      name: 'table row 5: human-typed body with the confirm keyword (確認) is eligible',
      title: 'Migration status',
      body: 'Could you confirm 確認 the current status of the migration?',
      expected: true,
    },
    {
      name: 'table row 6: a body whose first line carries the From: :robot: prefix is not eligible even with a keyword present',
      title: 'Investigation 調査 report',
      body: 'From: :robot: developer (claude-sonnet-4)\n\nInvestigate 調査 occurred, report attached.',
      expected: false,
    },
    {
      name: 'table row 7: a body whose first line is plain human text but a later line quotes a prior From: :robot: report is still eligible, proving only the first line is checked',
      title: 'Follow-up needed',
      body: 'Need to investigate 調査 this further.\nFrom: :robot: developer (claude-sonnet-4)\n\nPrior report content quoted here.',
      expected: true,
    },
    {
      name: 'table row 8: human-typed body with no investigation keyword is not eligible',
      title: 'Update button color',
      body: 'Please change the button color to blue on the settings page.',
      expected: false,
    },
    {
      name: 'extra case: keyword present only in the title, not the body, is still eligible',
      title: 'Please 確認 the deployment settings',
      body: 'This is just additional context with no trigger word in it.',
      expected: true,
    },
    {
      name: 'extra case: keyword present only in the body, not the title, is still eligible',
      title: 'Dashboard update',
      body: 'ダッシュボードのメトリクスを教えてください。',
      expected: true,
    },
  ])('$name', ({ title, body, expected }) => {
    expect(isHumanAuthoredInvestigationTaskCloseOverride({ title, body })).toBe(
      expected,
    );
  });
});
