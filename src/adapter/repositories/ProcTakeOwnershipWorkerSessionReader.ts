import * as fs from 'fs';
import * as path from 'path';
import { claudePrintModeFlagOf } from '../../domain/entities/ClaudePrintModeFlag';

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
      if (
        this.hasWorkerAncestor(
          rootProcess.processId,
          snapshotsByProcessId,
          workerProcessesById,
        )
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

  private hasWorkerAncestor = (
    processId: number,
    snapshotsByProcessId: Map<number, ProcessSnapshot>,
    workerProcessesById: Map<number, TokenHoldingWorkerProcess>,
  ): boolean => {
    let currentProcessId = processId;
    const visitedProcessIds = new Set<number>();
    while (!visitedProcessIds.has(currentProcessId)) {
      visitedProcessIds.add(currentProcessId);
      const parentProcessId =
        snapshotsByProcessId.get(currentProcessId)?.stat?.parentProcessId;
      if (parentProcessId === undefined) {
        return false;
      }
      if (visitedProcessIds.has(parentProcessId)) {
        return false;
      }
      if (workerProcessesById.has(parentProcessId)) {
        return true;
      }
      currentProcessId = parentProcessId;
    }
    return false;
  };

  private wrapperProcessIsAncestorOfAnyPrintFlagWorker = (
    wrapperProcessId: number,
    snapshotsByProcessId: Map<number, ProcessSnapshot>,
    printFlagWorkerProcessIds: Set<number>,
  ): boolean => {
    for (const printFlagWorkerProcessId of printFlagWorkerProcessIds) {
      let currentProcessId = printFlagWorkerProcessId;
      const visitedProcessIds = new Set<number>();
      while (!visitedProcessIds.has(currentProcessId)) {
        visitedProcessIds.add(currentProcessId);
        const parentProcessId =
          snapshotsByProcessId.get(currentProcessId)?.stat?.parentProcessId;
        if (parentProcessId === undefined) {
          break;
        }
        if (parentProcessId === wrapperProcessId) {
          return true;
        }
        currentProcessId = parentProcessId;
      }
    }
    return false;
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
    const printFlagWorkerProcessIds = new Set<number>();
    const printFlagWorkerProcessesById = new Map<
      number,
      TokenHoldingWorkerProcess
    >();
    const markerWrapperProcesses = new Map<number, TokenHoldingWorkerProcess>();
    for (const snapshot of snapshotsByProcessId.values()) {
      const rawCommandLine = this.readProcessFile(
        String(snapshot.processId),
        'cmdline',
      );
      if (rawCommandLine === null) {
        continue;
      }
      const commandArguments = rawCommandLine
        .split('\0')
        .filter((argument) => argument.length > 0);
      const isClaudeProcess =
        snapshot.stat?.commandName === CLAUDE_COMMAND_NAME;
      const hasPrintFlag = claudePrintModeFlagOf(commandArguments);
      const hasTakeOwnershipMarker = rawCommandLine.includes(
        TAKE_OWNERSHIP_MARKER,
      );
      const isPrintFlagWorker =
        hasPrintFlag && (isClaudeProcess || hasTakeOwnershipMarker);
      if (isPrintFlagWorker) {
        printFlagWorkerProcessIds.add(snapshot.processId);
      }
      if (snapshot.oauthToken === null) {
        continue;
      }
      const workerProcess = {
        processId: snapshot.processId,
        rawCommandLine,
        oauthToken: snapshot.oauthToken,
      };
      if (isPrintFlagWorker) {
        printFlagWorkerProcessesById.set(snapshot.processId, workerProcess);
        continue;
      }
      if (!isClaudeProcess && hasTakeOwnershipMarker) {
        markerWrapperProcesses.set(snapshot.processId, workerProcess);
      }
    }
    const workerProcessesById = new Map(printFlagWorkerProcessesById);
    for (const [processId, markerWrapperProcess] of markerWrapperProcesses) {
      if (
        this.wrapperProcessIsAncestorOfAnyPrintFlagWorker(
          processId,
          snapshotsByProcessId,
          printFlagWorkerProcessIds,
        )
      ) {
        workerProcessesById.set(processId, markerWrapperProcess);
      }
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
