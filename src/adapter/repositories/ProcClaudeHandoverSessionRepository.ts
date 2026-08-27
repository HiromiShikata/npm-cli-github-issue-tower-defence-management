import * as fs from 'fs';
import * as path from 'path';
import {
  ClaudeHandoverSession,
  ClaudeHandoverSessionKind,
} from '../../domain/entities/ClaudeHandoverSession';
import { ClaudeHandoverSessionRepository } from '../../domain/usecases/adapter-interfaces/ClaudeHandoverSessionRepository';

const DEFAULT_PROC_DIRECTORY = '/proc';
const OAUTH_TOKEN_ENVIRON_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const NAME_ARGUMENT = '--name';
const NAME_ARGUMENT_PREFIX = '--name=';
const PRINT_ARGUMENTS = ['-p', '--print'];
const PRINT_ARGUMENT_PREFIXES = ['-p=', '--print='];
const CLAUDE_COMM_PATTERN = /^claude(-agent)?$/;
const ISSUE_OR_PR_URL_PATTERN =
  /https:\/\/github\.com\/[^\s\0]+?\/(?:issues|pull)\/\d+/;

const normalizeName = (value: string): string => value.replace(/[.:]/g, '_');

const isIssueUrl = (value: string): boolean =>
  value.startsWith('http://') || value.startsWith('https://');

const extractIssueUrlFromText = (text: string): string | null => {
  const match = text.match(ISSUE_OR_PR_URL_PATTERN);
  return match ? match[0] : null;
};

const parseName = (commandArguments: string[]): string | null => {
  for (let index = 0; index < commandArguments.length; index += 1) {
    const argument = commandArguments[index];
    if (argument === NAME_ARGUMENT && index + 1 < commandArguments.length) {
      const value = commandArguments[index + 1];
      return value.length > 0 ? value : null;
    }
    if (argument.startsWith(NAME_ARGUMENT_PREFIX)) {
      const value = argument.slice(NAME_ARGUMENT_PREFIX.length);
      return value.length > 0 ? value : null;
    }
  }
  return null;
};

const parseIssueUrlFromPrint = (commandArguments: string[]): string | null => {
  for (let index = 0; index < commandArguments.length; index += 1) {
    const argument = commandArguments[index];
    if (
      PRINT_ARGUMENTS.includes(argument) &&
      index + 1 < commandArguments.length
    ) {
      const url = extractIssueUrlFromText(commandArguments[index + 1]);
      if (url !== null) {
        return url;
      }
    }
    for (const prefix of PRINT_ARGUMENT_PREFIXES) {
      if (argument.startsWith(prefix)) {
        const url = extractIssueUrlFromText(argument.slice(prefix.length));
        if (url !== null) {
          return url;
        }
      }
    }
  }
  return extractIssueUrlFromText(commandArguments.join(' '));
};

const classifySession = (
  pid: number,
  commandArguments: string[],
  token: string | null,
): ClaudeHandoverSession | null => {
  if (token === null || token.length === 0) {
    return null;
  }
  const name = parseName(commandArguments);
  if (name !== null) {
    const sessionName = normalizeName(name);
    if (isIssueUrl(name)) {
      const kind: ClaudeHandoverSessionKind = 'issueUrlLeader';
      return {
        kind,
        pid,
        token,
        sessionName,
        name,
        issueUrl: extractIssueUrlFromText(name),
        runsUnderWorkspacePreparationScript: false,
      };
    }
    const kind: ClaudeHandoverSessionKind = 'bareNameLeader';
    return {
      kind,
      pid,
      token,
      sessionName,
      name,
      issueUrl: null,
      runsUnderWorkspacePreparationScript: false,
    };
  }
  const issueUrl = parseIssueUrlFromPrint(commandArguments);
  if (issueUrl === null) {
    return null;
  }
  return {
    kind: 'implSubagent',
    pid,
    token,
    sessionName: null,
    name: null,
    issueUrl,
    runsUnderWorkspacePreparationScript: false,
  };
};

export class ProcClaudeHandoverSessionRepository implements ClaudeHandoverSessionRepository {
  constructor(
    private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY,
  ) {}

  listHandoverSessions = (): ClaudeHandoverSession[] => {
    const sessions: ClaudeHandoverSession[] = [];
    for (const processIdDirectory of this.listProcessIdDirectories()) {
      const session = this.readHandoverSession(processIdDirectory);
      if (session !== null) {
        sessions.push(session);
      }
    }
    return sessions;
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

  private readHandoverSession = (
    processIdDirectory: string,
  ): ClaudeHandoverSession | null => {
    const comm = this.readComm(processIdDirectory);
    if (comm === null || !CLAUDE_COMM_PATTERN.test(comm)) {
      return null;
    }
    const commandArguments = this.readCommandArguments(processIdDirectory);
    if (commandArguments === null) {
      return null;
    }
    const environ = this.readEnviron(processIdDirectory);
    if (environ === null) {
      return null;
    }
    const token = environ.get(OAUTH_TOKEN_ENVIRON_KEY) ?? null;
    return classifySession(Number(processIdDirectory), commandArguments, token);
  };

  private readComm = (processIdDirectory: string): string | null => {
    const commPath = path.join(this.procDirectory, processIdDirectory, 'comm');
    try {
      return fs.readFileSync(commPath, 'utf8').trim();
    } catch {
      return null;
    }
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
    return raw.split('\0').filter((argument) => argument.length > 0);
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
      environ.set(
        entry.slice(0, separatorIndex),
        entry.slice(separatorIndex + 1),
      );
    }
    return environ;
  };
}
