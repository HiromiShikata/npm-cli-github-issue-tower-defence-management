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
    expect(result.map(({ claudeSubagentCount, codexSubagentCount }) => ({ claudeSubagentCount, codexSubagentCount }))).toEqual([
      { claudeSubagentCount: 4, codexSubagentCount: 2 },
      { claudeSubagentCount: 0, codexSubagentCount: 0 },
    ]);
  });
});
