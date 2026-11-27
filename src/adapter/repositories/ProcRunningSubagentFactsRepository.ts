import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProcessFact,
  ProcessKind,
} from '../../domain/usecases/dashboard/CountRunningSubagentsUseCase';

type ReadText = (filePath: string) => string;
type ListFiles = (directoryPath: string) => string[];

const basename = (value: string): string => path.basename(value);

const environmentOf = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const entry of raw.split('\0')) {
    const separator = entry.indexOf('=');
    if (separator > 0)
      result[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return result;
};

const parentPidOf = (stat: string): number => {
  const close = stat.lastIndexOf(')');
  const fields = stat.slice(close + 2).split(' ');
  const parentPid = Number(fields[1]);
  if (!Number.isInteger(parentPid)) throw new Error('invalid process stat');
  return parentPid;
};

export class ProcRunningSubagentFactsRepository {
  constructor(
    private readonly procDirectory = '/proc',
    private readonly readText: ReadText = (filePath) =>
      fs.readFileSync(filePath, 'utf8'),
    private readonly listFiles: ListFiles = (directoryPath) =>
      fs.readdirSync(directoryPath),
  ) {}

  private listEntriesOrEmpty = (directory: string): string[] => {
    try {
      return this.listFiles(directory);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')
      ) {
        return [];
      }
      throw error;
    }
  };

  listFacts = (): ProcessFact[] => {
    let processIds: string[];
    try {
      processIds = fs
        .readdirSync(this.procDirectory)
        .filter((value) => /^\d+$/.test(value));
    } catch {
      return [];
    }
    const facts: ProcessFact[] = [];
    for (const processId of processIds) {
      const pid = Number(processId);
      try {
        const directory = path.join(this.procDirectory, processId);
        const ppid = parentPidOf(this.readText(path.join(directory, 'stat')));
        const argv = this.readText(path.join(directory, 'cmdline'))
          .split('\0')
          .filter(Boolean);
        const environment = environmentOf(
          this.readText(path.join(directory, 'environ')),
        );
        const worker =
          basename(argv[0] ?? '') === 'claude' &&
          argv.some(
            (value, index) =>
              value === '-p' &&
              (argv[index + 1] ?? '').startsWith('Take ownership of'),
          ) &&
          environment.CLAUDE_CODE_OAUTH_TOKEN !== undefined;
        const codex =
          basename(argv[0] ?? '') === 'node' &&
          (argv[1] ?? '').endsWith('/codex') &&
          argv[2] === 'exec';
        const kind: ProcessKind = worker
          ? 'claude-worker'
          : codex
            ? 'codex-launcher'
            : 'other';
        const tokenKey = worker
          ? crypto
              .createHash('sha256')
              .update(environment.CLAUDE_CODE_OAUTH_TOKEN)
              .digest('hex')
          : null;
        let unfinishedClaudeSubagentCount: number | null = null;
        if (worker) {
          try {
            const configDirectory =
              environment.CLAUDE_CONFIG_DIR ??
              path.join(environment.HOME ?? '', '.claude');
            let count = 0;
            for (const project of this.listFiles(
              path.join(configDirectory, 'projects'),
            )) {
              const projectDirectory = path.join(
                configDirectory,
                'projects',
                project,
              );
              const sessions =
                environment.CLAUDE_CODE_SESSION_ID === undefined
                  ? this.listEntriesOrEmpty(projectDirectory)
                  : [environment.CLAUDE_CODE_SESSION_ID];
              for (const session of sessions) {
                const subagentsDirectory = path.join(
                  projectDirectory,
                  session,
                  'subagents',
                );
                for (const file of this.listEntriesOrEmpty(
                  subagentsDirectory,
                )) {
                  if (!file.endsWith('.meta.json')) continue;
                  const parsed: unknown = JSON.parse(
                    this.readText(path.join(subagentsDirectory, file)),
                  );
                  if (!(
                    parsed !== null &&
                    typeof parsed === 'object' &&
                    'finished' in parsed &&
                    parsed.finished === true
                  ))
                    count += 1;
                }
              }
            }
            unfinishedClaudeSubagentCount = count;
          } catch {
            unfinishedClaudeSubagentCount = null;
          }
        }
        facts.push({
          pid,
          ppid,
          kind,
          tokenKey,
          unfinishedClaudeSubagentCount,
        });
      } catch {
        continue;
      }
    }
    return facts;
  };
}
