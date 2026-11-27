import { GenerateTokenStatusUseCase } from './GenerateTokenStatusUseCase';

describe('GenerateTokenStatusUseCase subagent counts', () => {
  it('maps counts by token value and defaults missing entries to zero', () => {
    const result = new GenerateTokenStatusUseCase().run({
      tokens: [
        { name: 'alpha', token: 'token-alpha', snapshot: null },
        { name: 'beta', token: 'token-beta', snapshot: null },
      ],
      prepCountByToken: new Map(),
      humCountByToken: new Map(),
      claudeSubagentCountByToken: new Map([['token-alpha', 4]]),
      codexSubagentCountByToken: new Map([['token-alpha', 2]]),
      nowEpochSeconds: 1_000_000,
    });
    expect(
      result.map(({ claudeSubagentCount, codexSubagentCount }) => ({
        claudeSubagentCount,
        codexSubagentCount,
      })),
    ).toEqual([
      { claudeSubagentCount: 4, codexSubagentCount: 2 },
      { claudeSubagentCount: 0, codexSubagentCount: 0 },
    ]);
  });

  it.each([
    {
      name: 'reports unavailable counts for every token when a remote host could not be measured',
      subagentCountsMeasured: false,
      expected: [
        { claudeSubagentCount: null, codexSubagentCount: null },
        { claudeSubagentCount: null, codexSubagentCount: null },
      ],
    },
    {
      name: 'reports measured counts, zero included, when every host was measured',
      subagentCountsMeasured: true,
      expected: [
        { claudeSubagentCount: 4, codexSubagentCount: 2 },
        { claudeSubagentCount: 0, codexSubagentCount: 0 },
      ],
    },
  ])('$name', ({ subagentCountsMeasured, expected }) => {
    const result = new GenerateTokenStatusUseCase().run({
      tokens: [
        { name: 'alpha', token: 'token-alpha', snapshot: null },
        { name: 'beta', token: 'token-beta', snapshot: null },
      ],
      prepCountByToken: new Map(),
      humCountByToken: new Map(),
      claudeSubagentCountByToken: new Map([['token-alpha', 4]]),
      codexSubagentCountByToken: new Map([['token-alpha', 2]]),
      subagentCountsMeasured,
      nowEpochSeconds: 1_000_000,
    });
    expect(
      result.map(({ claudeSubagentCount, codexSubagentCount }) => ({
        claudeSubagentCount,
        codexSubagentCount,
      })),
    ).toEqual(expected);
  });
});
