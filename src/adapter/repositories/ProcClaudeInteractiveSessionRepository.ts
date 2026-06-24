import * as fs from 'fs';
import * as path from 'path';
import {
  ClaudeInteractiveSession,
  ClaudeInteractiveSessionRepository,
} from '../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';

const DEFAULT_PROC_DIRECTORY = '/proc';
const OAUTH_TOKEN_ENVIRON_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const SESSION_ID_ENVIRON_KEY = 'CLAUDE_CODE_SESSION_ID';
const NAME_ARGUMENT = '--name';
const TAKE_OWNERSHIP_MARKER = 'Take ownership';

const isIssueUrl = (value: string): boolean =>
  value.startsWith('http://') || value.startsWith('https://');

const parseCommandLineArguments = (cmdline: string): string[] =>
  cmdline.split('\0').filter((argument) => argument.length > 0);

const extractIssueUrl = (commandArguments: string[]): string | null => {
  for (let index = 0; index < commandArguments.length - 1; index += 1) {
    if (commandArguments[index] === NAME_ARGUMENT) {
      const value = commandArguments[index + 1] ?? '';
      if (isIssueUrl(value)) {
        return value;
      }
    }
  }
  return null;
};

const isTakeOwnershipSpawn = (commandArguments: string[]): boolean =>
  commandArguments.some((argument) => argument.includes(TAKE_OWNERSHIP_MARKER));

export class ProcClaudeInteractiveSessionRepository implements ClaudeInteractiveSessionRepository {
  constructor(
    private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY,
  ) {}

  listInteractiveSessions = (): ClaudeInteractiveSession[] => {
    const interactiveSessions: ClaudeInteractiveSession[] = [];
    for (const pidDirectory of this.listProcessIdDirectories()) {
      const interactiveSession = this.readInteractiveSession(pidDirectory);
      if (interactiveSession !== null) {
        interactiveSessions.push(interactiveSession);
      }
    }
    return interactiveSessions;
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

  private readInteractiveSession = (
    processIdDirectory: string,
  ): ClaudeInteractiveSession | null => {
    const commandArguments = this.readCommandArguments(processIdDirectory);
    if (commandArguments === null) {
      return null;
    }
    if (isTakeOwnershipSpawn(commandArguments)) {
      return null;
    }
    const issueUrl = extractIssueUrl(commandArguments);
    if (issueUrl === null) {
      return null;
    }
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
    return { token, sessionId, issueUrl };
  };

  private readCommandArguments = (
    processIdDirectory: string,
  ): string[] | null => {
    const cmdlinePath = path.join(
      this.procDirectory,
      processIdDirectory,
      'cmdline',
    );
    let raw: string;
    try {
      raw = fs.readFileSync(cmdlinePath, 'utf8');
    } catch {
      return null;
    }
    return parseCommandLineArguments(raw);
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
