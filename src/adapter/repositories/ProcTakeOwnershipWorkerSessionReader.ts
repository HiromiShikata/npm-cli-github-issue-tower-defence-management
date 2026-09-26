import * as fs from 'fs';
import * as path from 'path';

const OAUTH_TOKEN_ENVIRON_PREFIX = 'CLAUDE_CODE_OAUTH_TOKEN=';
const TAKE_OWNERSHIP_MARKER = 'Take ownership';
const CLAUDE_COMMAND_NAME = 'claude';

export type TakeOwnershipWorkerProcess = {
  processId: number;
  rawCommandLine: string;
};

export type TakeOwnershipWorkerSession = {
  rootProcessId: number;
  sessionToken: string;
  workerProcesses: TakeOwnershipWorkerProcess[];
};

type ProcessStat = {
  commandName: string;
  parentProcessId: number;
};

type ProcessSnapshot = {
  processId: number;
  stat: ProcessStat | null;
  oauthToken: string | null;
};

type TokenHoldingWorkerProcess = TakeOwnershipWorkerProcess & {
  oauthToken: string;
};

const parseProcessStat = (rawStat: string): ProcessStat | null => {
  const commandNameStart = rawStat.indexOf('(');
  const commandNameEnd = rawStat.lastIndexOf(')');
  if (commandNameStart < 0 || commandNameEnd < commandNameStart) {
    return null;
  }
  const fieldsAfterCommandName = rawStat
    .slice(commandNameEnd + 1)
    .trim()
    .split(/\s+/);
  const parentProcessId = Number(fieldsAfterCommandName[1]);
  if (!Number.isInteger(parentProcessId)) {
    return null;
  }
  return {
    commandName: rawStat.slice(commandNameStart + 1, commandNameEnd),
    parentProcessId,
  };
};

const parseOauthToken = (rawEnviron: string): string | null => {
  const tokenEntry = rawEnviron
    .split('\0')
    .find((entry) => entry.startsWith(OAUTH_TOKEN_ENVIRON_PREFIX));
  if (tokenEntry === undefined) {
    return null;
  }
  const token = tokenEntry.slice(OAUTH_TOKEN_ENVIRON_PREFIX.length);
  return token.length === 0 ? null : token;
};

export class ProcTakeOwnershipWorkerSessionReader {
  constructor(private readonly procDirectory: string) {}

  listWorkerSessions = (): TakeOwnershipWorkerSession[] => {
    const snapshotsByProcessId = this.readProcessSnapshots();
    const childProcessIdsByParent =
      this.groupChildProcessIdsByParent(snapshotsByProcessId);
    const workerProcessesById =
      this.readTokenHoldingWorkerProcesses(snapshotsByProcessId);
    const sessions: TakeOwnershipWorkerSession[] = [];
    for (const rootProcess of workerProcessesById.values()) {
      const parentProcessId =
        snapshotsByProcessId.get(rootProcess.processId)?.stat
          ?.parentProcessId ?? null;
      if (
        parentProcessId !== null &&
        workerProcessesById.has(parentProcessId)
      ) {
        continue;
      }
      const descendantSnapshots = this.listDescendantsShallowestFirst(
        rootProcess.processId,
        childProcessIdsByParent,
      ).flatMap((processId) => {
        const snapshot = snapshotsByProcessId.get(processId);
        return snapshot === undefined ? [] : [snapshot];
      });
      const claudeDescendant = descendantSnapshots.find(
        (snapshot) =>
          snapshot.stat?.commandName === CLAUDE_COMMAND_NAME &&
          snapshot.oauthToken !== null,
      );
      sessions.push({
        rootProcessId: rootProcess.processId,
        sessionToken: claudeDescendant?.oauthToken ?? rootProcess.oauthToken,
        workerProcesses: this.listWorkerProcessesOfSession(
          rootProcess.processId,
          childProcessIdsByParent,
          workerProcessesById,
        ),
      });
    }
    return sessions.sort(
      (left, right) => left.rootProcessId - right.rootProcessId,
    );
  };

  private readProcessSnapshots = (): Map<number, ProcessSnapshot> => {
    const snapshotsByProcessId = new Map<number, ProcessSnapshot>();
    let entries: string[];
    try {
      entries = fs.readdirSync(this.procDirectory);
    } catch {
      return snapshotsByProcessId;
    }
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) {
        continue;
      }
      const rawStat = this.readProcessFile(entry, 'stat');
      const rawEnviron = this.readProcessFile(entry, 'environ');
      snapshotsByProcessId.set(Number(entry), {
        processId: Number(entry),
        stat: rawStat === null ? null : parseProcessStat(rawStat),
        oauthToken: rawEnviron === null ? null : parseOauthToken(rawEnviron),
      });
    }
    return snapshotsByProcessId;
  };

  private groupChildProcessIdsByParent = (
    snapshotsByProcessId: Map<number, ProcessSnapshot>,
  ): Map<number, number[]> => {
    const childProcessIdsByParent = new Map<number, number[]>();
    for (const snapshot of snapshotsByProcessId.values()) {
      if (snapshot.stat === null) {
        continue;
      }
      const childProcessIds =
        childProcessIdsByParent.get(snapshot.stat.parentProcessId) ?? [];
      childProcessIds.push(snapshot.processId);
      childProcessIdsByParent.set(
        snapshot.stat.parentProcessId,
        childProcessIds,
      );
    }
    for (const childProcessIds of childProcessIdsByParent.values()) {
      childProcessIds.sort((left, right) => left - right);
    }
    return childProcessIdsByParent;
  };

  private readTokenHoldingWorkerProcesses = (
    snapshotsByProcessId: Map<number, ProcessSnapshot>,
  ): Map<number, TokenHoldingWorkerProcess> => {
    const workerProcessesById = new Map<number, TokenHoldingWorkerProcess>();
    for (const snapshot of snapshotsByProcessId.values()) {
      if (snapshot.oauthToken === null) {
        continue;
      }
      const rawCommandLine = this.readProcessFile(
        String(snapshot.processId),
        'cmdline',
      );
      if (
        rawCommandLine === null ||
        !rawCommandLine.includes(TAKE_OWNERSHIP_MARKER)
      ) {
        continue;
      }
      workerProcessesById.set(snapshot.processId, {
        processId: snapshot.processId,
        rawCommandLine,
        oauthToken: snapshot.oauthToken,
      });
    }
    return workerProcessesById;
  };

  private listDescendantsShallowestFirst = (
    rootProcessId: number,
    childProcessIdsByParent: Map<number, number[]>,
  ): number[] => {
    const descendants: number[] = [];
    const visitedProcessIds = new Set<number>([rootProcessId]);
    const pendingProcessIds = [rootProcessId];
    for (
      let pendingProcessId = pendingProcessIds.shift();
      pendingProcessId !== undefined;
      pendingProcessId = pendingProcessIds.shift()
    ) {
      for (const childProcessId of childProcessIdsByParent.get(
        pendingProcessId,
      ) ?? []) {
        if (visitedProcessIds.has(childProcessId)) {
          continue;
        }
        visitedProcessIds.add(childProcessId);
        descendants.push(childProcessId);
        pendingProcessIds.push(childProcessId);
      }
    }
    return descendants;
  };

  private listWorkerProcessesOfSession = (
    rootProcessId: number,
    childProcessIdsByParent: Map<number, number[]>,
    workerProcessesById: Map<number, TokenHoldingWorkerProcess>,
  ): TakeOwnershipWorkerProcess[] => {
    const sessionProcessIds = new Set<number>([rootProcessId]);
    const pendingProcessIds = [rootProcessId];
    for (
      let pendingProcessId = pendingProcessIds.shift();
      pendingProcessId !== undefined;
      pendingProcessId = pendingProcessIds.shift()
    ) {
      for (const childProcessId of childProcessIdsByParent.get(
        pendingProcessId,
      ) ?? []) {
        if (
          sessionProcessIds.has(childProcessId) ||
          !workerProcessesById.has(childProcessId)
        ) {
          continue;
        }
        sessionProcessIds.add(childProcessId);
        pendingProcessIds.push(childProcessId);
      }
    }
    return [...sessionProcessIds]
      .sort((left, right) => left - right)
      .flatMap((processId) => {
        const workerProcess = workerProcessesById.get(processId);
        return workerProcess === undefined
          ? []
          : [
              {
                processId: workerProcess.processId,
                rawCommandLine: workerProcess.rawCommandLine,
              },
            ];
      });
  };

  private readProcessFile = (
    processIdDirectory: string,
    fileName: 'stat' | 'environ' | 'cmdline',
  ): string | null => {
    try {
      return fs.readFileSync(
        path.join(this.procDirectory, processIdDirectory, fileName),
        'utf8',
      );
    } catch {
      return null;
    }
  };
}
