export type ProcessKind = 'claude-worker' | 'codex-launcher' | 'other';

export type ProcessFact = {
  pid: number;
  ppid: number;
  kind: ProcessKind;
  workerKey: string | null;
  unfinishedClaudeSubagentCount: number | null;
};

export type RunningSubagentCounts = {
  claudeByWorkerKey: Map<string, number>;
  codexByWorkerKey: Map<string, number>;
  unreadableWorkerPids: number[];
  unmeasuredWorkerKeys: string[];
};

export const countRunningSubagentsByWorkerKey = (
  facts: ProcessFact[],
): RunningSubagentCounts => {
  const byPid = new Map(facts.map((fact) => [fact.pid, fact]));
  const claudeByWorkerKey = new Map<string, number>();
  const codexByWorkerKey = new Map<string, number>();
  const unreadableWorkerPids: number[] = [];
  const unmeasuredWorkerKeys = new Set<string>();
  for (const fact of facts) {
    if (fact.kind === 'claude-worker') {
      if (fact.unfinishedClaudeSubagentCount === null) {
        unreadableWorkerPids.push(fact.pid);
        if (fact.workerKey !== null) unmeasuredWorkerKeys.add(fact.workerKey);
      } else if (fact.workerKey !== null) {
        claudeByWorkerKey.set(
          fact.workerKey,
          (claudeByWorkerKey.get(fact.workerKey) ?? 0) +
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
      if (parent.kind === 'claude-worker' && parent.workerKey !== null) {
        codexByWorkerKey.set(
          parent.workerKey,
          (codexByWorkerKey.get(parent.workerKey) ?? 0) + 1,
        );
        break;
      }
      parentPid = parent.ppid;
    }
  }
  return {
    claudeByWorkerKey,
    codexByWorkerKey,
    unreadableWorkerPids,
    unmeasuredWorkerKeys: [...unmeasuredWorkerKeys].sort(),
  };
};
