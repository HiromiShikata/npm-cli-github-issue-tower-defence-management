import { Issue } from '../entities/Issue';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';

export const isOrphanedWorkerProcess = async (
  issue: Pick<Issue, 'url' | 'org' | 'repo' | 'number'>,
  localCommandRunner: LocalCommandRunner,
  params: {
    preparationProcessCheckCommand: string;
    awLogDirectoryPath?: string;
    awLogStaleThresholdMinutes?: number;
  },
): Promise<boolean> => {
  const commandTemplate = params.preparationProcessCheckCommand.replace(
    '{URL}',
    '$1',
  );
  const { exitCode } = await localCommandRunner.runCommand('sh', [
    '-c',
    commandTemplate,
    '--',
    issue.url,
  ]);
  if (exitCode !== 0) return true;
  const { awLogDirectoryPath, awLogStaleThresholdMinutes } = params;
  if (!awLogDirectoryPath || !awLogStaleThresholdMinutes) return false;
  return isAwLogStale(
    issue,
    localCommandRunner,
    awLogDirectoryPath,
    awLogStaleThresholdMinutes,
  );
};

const isAwLogStale = async (
  issue: Pick<Issue, 'org' | 'repo' | 'number'>,
  localCommandRunner: LocalCommandRunner,
  awLogDirectoryPath: string,
  awLogStaleThresholdMinutes: number,
): Promise<boolean> => {
  const logPattern = `${issue.org}_${issue.repo}_${issue.number}_*`;

  const { stdout: anyFilesOutput, exitCode: anyFilesExitCode } =
    await localCommandRunner.runCommand('sh', [
      '-c',
      'find "$1" -name "$2"',
      '--',
      awLogDirectoryPath,
      logPattern,
    ]);

  if (anyFilesExitCode !== 0 || !anyFilesOutput.trim()) return false;

  const { stdout: recentFilesOutput, exitCode: recentFilesExitCode } =
    await localCommandRunner.runCommand('sh', [
      '-c',
      'find "$1" -name "$2" -mmin -$3',
      '--',
      awLogDirectoryPath,
      logPattern,
      String(awLogStaleThresholdMinutes),
    ]);

  if (recentFilesExitCode !== 0) return false;

  return !recentFilesOutput.trim();
};
