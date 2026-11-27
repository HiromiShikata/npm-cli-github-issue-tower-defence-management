export type ProcessKind = 'claude-worker' | 'codex-launcher' | 'other';

export type ProcessFact = {
  pid: number;
  ppid: number;
  kind: ProcessKind;
  tokenKey: string | null;
  unfinishedClaudeSubagentCount: number | null;
};

export type RunningSubagentCounts = {
  claudeByTokenKey: Map<string, number>;
  codexByTokenKey: Map<string, number>;
  unreadableWorkerPids: number[];
};

export const countRunningSubagentsByTokenKey = (
  facts: ProcessFact[],
): RunningSubagentCounts => {
  const byPid = new Map(facts.map((fact) => [fact.pid, fact]));
  const claudeByTokenKey = new Map<string, number>();
  const codexByTokenKey = new Map<string, number>();
  const unreadableWorkerPids: number[] = [];
  for (const fact of facts) {
    if (fact.kind === 'claude-worker') {
      if (fact.unfinishedClaudeSubagentCount === null) {
        unreadableWorkerPids.push(fact.pid);
      } else if (fact.tokenKey !== null) {
        claudeByTokenKey.set(
          fact.tokenKey,
          (claudeByTokenKey.get(fact.tokenKey) ?? 0) +
            fact.unfinishedClaudeSubagentCount,
        );
      }
    }
    if (fact.kind !== 'codex-launcher') continue;
    const visited = new Set<number>();
    let parentPid = fact.ppid;
    while (!visited.has(parentPid)) {
      visited.add(parentPid);
      const parent = byPid.get(parentPid);
      if (parent === undefined) break;
      if (parent.kind === 'claude-worker' && parent.tokenKey !== null) {
        codexByTokenKey.set(
          parent.tokenKey,
          (codexByTokenKey.get(parent.tokenKey) ?? 0) + 1,
        );
        break;
      }
      parentPid = parent.ppid;
    }
  }
  return { claudeByTokenKey, codexByTokenKey, unreadableWorkerPids };
};
