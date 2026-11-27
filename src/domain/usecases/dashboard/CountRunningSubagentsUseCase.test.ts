import {
  ProcessFact,
  countRunningSubagentsByTokenKey,
} from './CountRunningSubagentsUseCase';

const worker = (
  pid: number,
  ppid: number,
  tokenKey: string,
  count: number | null,
): ProcessFact => ({
  pid,
  ppid,
  kind: 'claude-worker',
  tokenKey,
  unfinishedClaudeSubagentCount: count,
});

const codex = (pid: number, ppid: number): ProcessFact => ({
  pid,
  ppid,
  kind: 'codex-launcher',
  tokenKey: null,
  unfinishedClaudeSubagentCount: null,
});

const other = (pid: number, ppid: number): ProcessFact => ({
  pid,
  ppid,
  kind: 'other',
  tokenKey: null,
  unfinishedClaudeSubagentCount: null,
});

describe('countRunningSubagentsByTokenKey', () => {
  it.each([
    {
      name: 'sums unfinished Claude subagents per worker token',
      facts: [worker(10, 1, 'claude-key', 2), worker(20, 1, 'claude-key', 3)],
      expected: { claude: [['claude-key', 5]], codex: [], unreadable: [] },
    },
    {
      name: 'attributes Codex launchers to the nearest worker ancestor',
      facts: [worker(10, 1, 'claude-key', 1), other(11, 10), codex(12, 11)],
      expected: {
        claude: [['claude-key', 1]],
        codex: [['claude-key', 1]],
        unreadable: [],
      },
    },
    {
      name: 'drops Codex launchers without a worker ancestor',
      facts: [codex(12, 99)],
      expected: { claude: [], codex: [], unreadable: [] },
    },
    {
      name: 'does not count timeout wrappers or native Codex processes',
      facts: [worker(10, 1, 'claude-key', 0), other(11, 10), other(12, 10)],
      expected: { claude: [['claude-key', 0]], codex: [], unreadable: [] },
    },
    {
      name: 'ignores dead workers because they are absent from facts',
      facts: [codex(12, 10)],
      expected: { claude: [], codex: [], unreadable: [] },
    },
    {
      name: 'reports unreadable worker counts without counting them',
      facts: [worker(10, 1, 'claude-key', null), codex(12, 10)],
      expected: { claude: [], codex: [['claude-key', 1]], unreadable: [10] },
    },
    {
      name: 'terminates on a parent cycle or missing parent',
      facts: [codex(12, 13), other(13, 12), codex(14, 99)],
      expected: { claude: [], codex: [], unreadable: [] },
    },
  ])('$name', ({ facts, expected }) => {
    const result = countRunningSubagentsByTokenKey(facts);
    expect([...result.claudeByTokenKey]).toEqual(expected.claude);
    expect([...result.codexByTokenKey]).toEqual(expected.codex);
    expect(result.unreadableWorkerPids).toEqual(expected.unreadable);
  });
});
