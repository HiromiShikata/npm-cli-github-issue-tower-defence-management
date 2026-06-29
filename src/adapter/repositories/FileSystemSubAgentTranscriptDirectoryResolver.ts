import * as path from 'path';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';

export class FileSystemSubAgentTranscriptDirectoryResolver implements SubAgentTranscriptDirectoryResolver {
  constructor(private readonly rootDirectory: string | null) {}

  resolveSubAgentsDirectory = (
    _sessionName: string,
    mainTranscriptPath: string | null,
  ): string | null => {
    if (this.rootDirectory === null) {
      return null;
    }
    if (mainTranscriptPath === null) {
      return null;
    }
    const sessionDirectory = mainTranscriptPath.replace(/\.jsonl$/, '');
    if (sessionDirectory === mainTranscriptPath) {
      return null;
    }
    return path.join(sessionDirectory, 'subagents');
  };
}
