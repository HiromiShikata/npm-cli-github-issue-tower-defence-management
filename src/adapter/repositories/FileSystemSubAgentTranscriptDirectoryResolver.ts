import * as path from 'path';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';

export class FileSystemSubAgentTranscriptDirectoryResolver implements SubAgentTranscriptDirectoryResolver {
  constructor(private readonly rootDirectory: string | null) {}

  resolveSubAgentsDirectory = (sessionName: string): string | null => {
    if (this.rootDirectory === null) {
      return null;
    }
    return path.join(
      this.rootDirectory,
      sessionName.replace(/\//g, '_'),
      'subagents',
    );
  };
}
