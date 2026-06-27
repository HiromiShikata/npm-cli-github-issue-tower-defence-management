import * as path from 'path';
import { FileSystemSubAgentTranscriptDirectoryResolver } from './FileSystemSubAgentTranscriptDirectoryResolver';

describe('FileSystemSubAgentTranscriptDirectoryResolver', () => {
  it('builds the subagents directory under the session-specific directory', () => {
    const resolver = new FileSystemSubAgentTranscriptDirectoryResolver(
      '/var/transcripts',
    );

    const result = resolver.resolveSubAgentsDirectory(
      'https_//github_com/owner/repo/issues/9',
    );

    expect(result).toBe(
      path.join(
        '/var/transcripts',
        'https_//github_com_owner_repo_issues_9'.replace(/\//g, '_'),
        'subagents',
      ),
    );
  });

  it('returns null when the root directory is null', () => {
    const resolver = new FileSystemSubAgentTranscriptDirectoryResolver(null);

    const result = resolver.resolveSubAgentsDirectory(
      'https_//github_com/owner/repo/issues/9',
    );

    expect(result).toBeNull();
  });
});
