import * as fs from 'fs';
import * as path from 'path';
import { modelRuntimeOf } from '../../domain/entities/ModelRuntime';
import {
  CodexRunningWorkerListResult,
  CodexRunningWorkerRepository,
} from '../../domain/usecases/adapter-interfaces/CodexRunningWorkerRepository';

const DEFAULT_PROC_DIRECTORY = '/proc';
const TAKE_OWNERSHIP_ISSUE_URL_PATTERN =
  /Take ownership of (https:\/\/github\.com\/[^\s"']+)/g;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripSurroundingQuotes = (value: string): string => {
  const match = value.match(/^(["'])(.*)\1$/);
  return match === null ? value : match[2];
};

const isProcessEndedError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'ENOENT' || error.code === 'ESRCH');

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isCodexAwWorkerOf = (cmdline: string, issueUrl: string): boolean => {
  const awInvocation = new RegExp(
    `/aw"? ${escapeRegExp(issueUrl)} (\\S+) (\\S+)`,
  ).exec(cmdline);
  if (awInvocation === null) {
    return false;
  }
  const model = stripSurroundingQuotes(awInvocation[2]);
  return model.length > 0 && modelRuntimeOf(model) === 'codex';
};

export class ProcCodexRunningWorkerRepository implements CodexRunningWorkerRepository {
  constructor(
    private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY,
  ) {}

  listRunningCodexWorkerIssueUrls = (): CodexRunningWorkerListResult => {
    let processIdDirectories: string[];
    try {
      processIdDirectories = fs
        .readdirSync(this.procDirectory)
        .filter((entry) => /^\d+$/.test(entry));
    } catch (error) {
      return {
        issueUrls: [],
        errorMessages: [
          `Failed to list proc directory ${this.procDirectory}: ${errorMessageOf(error)}`,
        ],
      };
    }
    const issueUrls = new Set<string>();
    const errorMessages: string[] = [];
    for (const processId of processIdDirectories) {
      let cmdline: string;
      try {
        cmdline = fs
          .readFileSync(
            path.join(this.procDirectory, processId, 'cmdline'),
            'utf8',
          )
          .replace(/\0/g, ' ');
      } catch (error) {
        if (!isProcessEndedError(error)) {
          errorMessages.push(`pid ${processId}: ${errorMessageOf(error)}`);
        }
        continue;
      }
      for (const match of cmdline.matchAll(TAKE_OWNERSHIP_ISSUE_URL_PATTERN)) {
        const issueUrl = match[1];
        if (isCodexAwWorkerOf(cmdline, issueUrl)) {
          issueUrls.add(issueUrl);
        }
      }
    }
    return { issueUrls: [...issueUrls], errorMessages };
  };
}
