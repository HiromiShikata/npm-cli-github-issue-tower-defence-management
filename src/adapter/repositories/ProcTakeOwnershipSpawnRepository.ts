import * as fs from 'fs';
import * as path from 'path';
import {
  TakeOwnershipSpawn,
  TakeOwnershipSpawnRepository,
} from '../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';
import { ProcTakeOwnershipWorkerSessionReader } from './ProcTakeOwnershipWorkerSessionReader';

const DEFAULT_PROC_DIRECTORY = '/proc';
const LOG_PATH_PATTERN = /\/logs-aw\/[^\0"]+\.log/;
const ISSUE_URL_PATTERN = /Take ownership of (https:\/\/github\.com\/[^ \0"]+)/;

const extractLogPath = (cmdline: string): string | null => {
  const match = cmdline.match(LOG_PATH_PATTERN);
  return match === null ? null : match[0];
};

export class ProcTakeOwnershipSpawnRepository implements TakeOwnershipSpawnRepository {
  private readonly workerSessionReader: ProcTakeOwnershipWorkerSessionReader;

  constructor(private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY) {
    this.workerSessionReader = new ProcTakeOwnershipWorkerSessionReader(
      procDirectory,
    );
  }

  listSpawns = (): TakeOwnershipSpawn[] =>
    this.workerSessionReader.listWorkerSessions().flatMap((session) =>
      session.workerProcesses.flatMap((workerProcess) => {
        const logPath = extractLogPath(workerProcess.rawCommandLine);
        return logPath === null
          ? []
          : [{ token: session.sessionToken, logPath }];
      }),
    );

  listRunningIssueUrls = (): string[] => {
    const urls: string[] = [];
    for (const pidDirectory of this.listProcessIdDirectories()) {
      const rawCmdline = this.readRawCmdline(pidDirectory);
      if (rawCmdline === null) {
        continue;
      }
      const match = rawCmdline.match(ISSUE_URL_PATTERN);
      if (match !== null) {
        urls.push(match[1]);
      }
    }
    return urls;
  };

  private listProcessIdDirectories = (): string[] => {
    let entries: string[];
    try {
      entries = fs.readdirSync(this.procDirectory);
    } catch {
      return [];
    }
    return entries.filter((entry) => /^\d+$/.test(entry));
  };

  private readRawCmdline = (processIdDirectory: string): string | null => {
    const cmdlinePath = path.join(
      this.procDirectory,
      processIdDirectory,
      'cmdline',
    );
    try {
      return fs.readFileSync(cmdlinePath, 'utf8');
    } catch {
      return null;
    }
  };
}
