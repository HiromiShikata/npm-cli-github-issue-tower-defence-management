import * as fs from 'fs';
import * as path from 'path';
import {
  ClaudeLiveSession,
  ClaudeLiveSessionRepository,
} from '../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';

const DEFAULT_PROC_DIRECTORY = '/proc';
const OAUTH_TOKEN_ENVIRON_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const SESSION_ID_ENVIRON_KEY = 'CLAUDE_CODE_SESSION_ID';

const isClaudeProcessCommand = (command: string): boolean => {
  if (command.length === 0) {
    return false;
  }
  if (command.includes('.local/share/claude')) {
    return true;
  }
  const executableName = path.basename(command.split('\0')[0] ?? '');
  return executableName === 'claude';
};

export class ProcClaudeLiveSessionRepository implements ClaudeLiveSessionRepository {
  constructor(
    private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY,
  ) {}

  listLiveSessions = (): ClaudeLiveSession[] => {
    const liveSessions: ClaudeLiveSession[] = [];
    for (const pidDirectory of this.listProcessIdDirectories()) {
      const liveSession = this.readLiveSession(pidDirectory);
      if (liveSession !== null) {
        liveSessions.push(liveSession);
      }
    }
    return liveSessions;
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

  private readLiveSession = (
    processIdDirectory: string,
  ): ClaudeLiveSession | null => {
    const environ = this.readEnviron(processIdDirectory);
    if (environ === null) {
      return null;
    }
    const token = environ.get(OAUTH_TOKEN_ENVIRON_KEY);
    const sessionId = environ.get(SESSION_ID_ENVIRON_KEY);
    if (
      token === undefined ||
      token.length === 0 ||
      sessionId === undefined ||
      sessionId.length === 0
    ) {
      return null;
    }
    if (!this.isClaudeProcess(processIdDirectory)) {
      return null;
    }
    return { token, sessionId };
  };

  private isClaudeProcess = (processIdDirectory: string): boolean => {
    const basePath = path.join(this.procDirectory, processIdDirectory);
    try {
      const cmdline = fs.readFileSync(path.join(basePath, 'cmdline'), 'utf8');
      if (isClaudeProcessCommand(cmdline)) {
        return true;
      }
    } catch {
      return false;
    }
    try {
      const exe = fs.readlinkSync(path.join(basePath, 'exe'));
      return isClaudeProcessCommand(exe);
    } catch {
      return false;
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
