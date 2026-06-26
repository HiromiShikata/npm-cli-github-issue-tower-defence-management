import * as fs from 'fs';
import * as path from 'path';
import {
  TakeOwnershipSpawn,
  TakeOwnershipSpawnRepository,
} from '../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';

const DEFAULT_PROC_DIRECTORY = '/proc';
const OAUTH_TOKEN_ENVIRON_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const TAKE_OWNERSHIP_MARKER = 'Take ownership';
const LOG_PATH_PATTERN = /\/logs-aw\/[^\0"]+\.log/;

const parseCommandLineArguments = (cmdline: string): string[] =>
  cmdline.split('\0').filter((argument) => argument.length > 0);

const isTakeOwnershipSpawn = (commandArguments: string[]): boolean =>
  commandArguments.some((argument) => argument.includes(TAKE_OWNERSHIP_MARKER));

const extractLogPath = (cmdline: string): string | null => {
  const match = cmdline.match(LOG_PATH_PATTERN);
  return match === null ? null : match[0];
};

export class ProcTakeOwnershipSpawnRepository implements TakeOwnershipSpawnRepository {
  constructor(
    private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY,
  ) {}

  listSpawns = (): TakeOwnershipSpawn[] => {
    const spawns: TakeOwnershipSpawn[] = [];
    for (const pidDirectory of this.listProcessIdDirectories()) {
      const spawn = this.readSpawn(pidDirectory);
      if (spawn !== null) {
        spawns.push(spawn);
      }
    }
    return spawns;
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

  private readSpawn = (
    processIdDirectory: string,
  ): TakeOwnershipSpawn | null => {
    const rawCmdline = this.readRawCmdline(processIdDirectory);
    if (rawCmdline === null) {
      return null;
    }
    const commandArguments = parseCommandLineArguments(rawCmdline);
    if (!isTakeOwnershipSpawn(commandArguments)) {
      return null;
    }
    const logPath = extractLogPath(rawCmdline);
    if (logPath === null) {
      return null;
    }
    const environ = this.readEnviron(processIdDirectory);
    if (environ === null) {
      return null;
    }
    const token = environ.get(OAUTH_TOKEN_ENVIRON_KEY);
    if (token === undefined || token.length === 0) {
      return null;
    }
    return { token, logPath };
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

  private readEnviron = (
    processIdDirectory: string,
  ): Map<string, string> | null => {
    const environPath = path.join(
      this.procDirectory,
      processIdDirectory,
      'environ',
    );
    let raw: string;
    try {
      raw = fs.readFileSync(environPath, 'utf8');
    } catch {
      return null;
    }
    const environ = new Map<string, string>();
    for (const entry of raw.split('\0')) {
      if (entry.length === 0) {
        continue;
      }
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const key = entry.slice(0, separatorIndex);
      const value = entry.slice(separatorIndex + 1);
      environ.set(key, value);
    }
    return environ;
  };
}
