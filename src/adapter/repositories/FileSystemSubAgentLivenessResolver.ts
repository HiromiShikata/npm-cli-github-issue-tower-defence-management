import * as fs from 'fs';
import * as path from 'path';
import { SubAgentLivenessResolver } from '../../domain/usecases/adapter-interfaces/SubAgentLivenessResolver';

const RUNNING_SUBAGENTS_FILE_NAME = 'running-subagents.txt';

const isMissingFileError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT';

export class FileSystemSubAgentLivenessResolver implements SubAgentLivenessResolver {
  constructor(private readonly runtimeRootDirectory: string | null) {}

  resolveLiveSubAgentIds = async (params: {
    sessionName: string;
    mainTranscriptPath: string | null;
  }): Promise<Set<string> | null> => {
    const runningFilePath = this.resolveRunningSubAgentsFilePath(
      params.mainTranscriptPath,
    );
    if (runningFilePath === null) {
      return null;
    }
    let content: string;
    try {
      content = fs.readFileSync(runningFilePath, 'utf8');
    } catch (error) {
      if (isMissingFileError(error) && this.hasReadableRuntimeRootDirectory()) {
        return new Set();
      }
      return null;
    }
    const liveIds = new Set<string>();
    for (const line of content.split('\n')) {
      const agentId = line.trim().split(/\s+/)[0];
      if (agentId.length > 0) {
        liveIds.add(agentId);
      }
    }
    return liveIds;
  };

  private hasReadableRuntimeRootDirectory = (): boolean => {
    if (this.runtimeRootDirectory === null) {
      return false;
    }
    try {
      return fs.statSync(this.runtimeRootDirectory).isDirectory();
    } catch {
      return false;
    }
  };

  private resolveRunningSubAgentsFilePath = (
    mainTranscriptPath: string | null,
  ): string | null => {
    if (this.runtimeRootDirectory === null || mainTranscriptPath === null) {
      return null;
    }
    const sessionUuid = path.basename(mainTranscriptPath, '.jsonl');
    if (sessionUuid.length === 0 || sessionUuid.endsWith('.jsonl')) {
      return null;
    }
    const cwdSlug = path.basename(path.dirname(mainTranscriptPath));
    if (cwdSlug.length === 0 || cwdSlug === '.') {
      return null;
    }
    return path.join(
      this.runtimeRootDirectory,
      cwdSlug,
      sessionUuid,
      RUNNING_SUBAGENTS_FILE_NAME,
    );
  };
}
