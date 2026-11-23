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
const ISSUE_URL_PATTERN =
  /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(issues|pull)\/\d+$/;
const LOCAL_AW_SCRIPT_SUFFIX = '/machine/sk/aw';

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

const splitArgv = (cmdline: string): string[] => {
  const argv = cmdline.split('\0');
  return argv[argv.length - 1] === '' ? argv.slice(0, -1) : argv;
};

const isCodexModel = (model: string): boolean =>
  model.length > 0 && modelRuntimeOf(model) === 'codex';

const localCodexAwLaunchIssueUrls = (argv: string[]): string[] =>
  argv.length >= 5 &&
  path.basename(argv[0]) === 'bash' &&
  argv[1].endsWith(LOCAL_AW_SCRIPT_SUFFIX) &&
  ISSUE_URL_PATTERN.test(argv[2]) &&
  argv[3].length > 0 &&
  isCodexModel(argv[4])
    ? [argv[2]]
    : [];

const delegatedScriptOf = (argv: string[]): string | null => {
  if (path.basename(argv[0]) === 'ssh') {
    return argv[argv.length - 1];
  }
  if (
    path.basename(argv[0]) === 'bash' &&
    argv.length >= 3 &&
    argv[1] === '-ic'
  ) {
    return argv[2];
  }
  return null;
};

const isCodexAwWorkerOf = (script: string, issueUrl: string): boolean => {
  const awInvocation = new RegExp(
    `/aw"? ${escapeRegExp(issueUrl)} (\\S+) (\\S+)`,
  ).exec(script);
  if (awInvocation === null) {
    return false;
  }
  return isCodexModel(stripSurroundingQuotes(awInvocation[2]));
};

const delegatedCodexWorkerIssueUrls = (script: string): string[] =>
  [...script.matchAll(TAKE_OWNERSHIP_ISSUE_URL_PATTERN)]
    .map((match) => match[1])
    .filter((issueUrl) => isCodexAwWorkerOf(script, issueUrl));

const codexWorkerIssueUrlsOf = (argv: string[]): string[] => {
  if (argv.length === 0) {
    return [];
  }
  const script = delegatedScriptOf(argv);
  return [
    ...localCodexAwLaunchIssueUrls(argv),
    ...(script === null ? [] : delegatedCodexWorkerIssueUrls(script)),
  ];
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
        cmdline = fs.readFileSync(
          path.join(this.procDirectory, processId, 'cmdline'),
          'utf8',
        );
      } catch (error) {
        if (!isProcessEndedError(error)) {
          errorMessages.push(`pid ${processId}: ${errorMessageOf(error)}`);
        }
        continue;
      }
      for (const issueUrl of codexWorkerIssueUrlsOf(splitArgv(cmdline))) {
        issueUrls.add(issueUrl);
      }
    }
    return { issueUrls: [...issueUrls], errorMessages };
  };
}
