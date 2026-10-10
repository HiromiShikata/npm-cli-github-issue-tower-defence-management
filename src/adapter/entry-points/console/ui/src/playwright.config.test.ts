/**
 * @jest-environment node
 */
import config from '../e2e/playwright.config';

describe('playwright.config', () => {
  it('retains a trace on every failure, not only a retried one (UAT 3183 criterion 2)', () => {
    expect(config.use?.trace).toBe('retain-on-failure');
  });

  it('retains a video on every failure (UAT 3183 criterion 2)', () => {
    expect(config.use?.video).toBe('retain-on-failure');
  });

  describe('leaves retry count, time budgets and wait times unchanged (UAT 3183 criterion 3)', () => {
    const unchangedValueCases: {
      field: string;
      actual: unknown;
      expected: unknown;
    }[] = [
      { field: 'retries', actual: config.retries, expected: 0 },
      { field: 'timeout', actual: config.timeout, expected: 60_000 },
      {
        field: 'expect.timeout',
        actual: config.expect?.timeout,
        expected: 3_000,
      },
      {
        field: 'use.actionTimeout',
        actual: config.use?.actionTimeout,
        expected: 3_000,
      },
      {
        field: 'use.navigationTimeout',
        actual: config.use?.navigationTimeout,
        expected: 3_000,
      },
    ];

    it.each(unchangedValueCases)(
      '$field stays $expected',
      ({ actual, expected }) => {
        expect(actual).toBe(expected);
      },
    );
  });
});
