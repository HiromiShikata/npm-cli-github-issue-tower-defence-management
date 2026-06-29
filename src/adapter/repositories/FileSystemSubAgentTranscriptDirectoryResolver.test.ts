import * as path from 'path';
import { FileSystemSubAgentTranscriptDirectoryResolver } from './FileSystemSubAgentTranscriptDirectoryResolver';

describe('FileSystemSubAgentTranscriptDirectoryResolver', () => {
  const rootDirectory = '/home/user/.claude/projects';
  const mainTranscriptPath = path.join(
    rootDirectory,
    '-home-user-0-workspaces-workspace1-oss-some-repo-worktrees-i123',
    'ba0637e1-9ff1-41a8-b13c-f45e6a71efc5.jsonl',
  );

  it('derives the subagents directory next to the resolved main transcript path', () => {
    const resolver = new FileSystemSubAgentTranscriptDirectoryResolver(
      rootDirectory,
    );

    const result = resolver.resolveSubAgentsDirectory(
      'https_//github_com/owner/repo/issues/9',
      mainTranscriptPath,
    );

    expect(result).toBe(
      path.join(
        rootDirectory,
        '-home-user-0-workspaces-workspace1-oss-some-repo-worktrees-i123',
        'ba0637e1-9ff1-41a8-b13c-f45e6a71efc5',
        'subagents',
      ),
    );
  });

  it('returns null when the root directory is null', () => {
    const resolver = new FileSystemSubAgentTranscriptDirectoryResolver(null);

    const result = resolver.resolveSubAgentsDirectory(
      'https_//github_com/owner/repo/issues/9',
      mainTranscriptPath,
    );

    expect(result).toBeNull();
  });

  it('returns null when the main transcript path is unresolved', () => {
    const resolver = new FileSystemSubAgentTranscriptDirectoryResolver(
      rootDirectory,
    );

    const result = resolver.resolveSubAgentsDirectory(
      'https_//github_com/owner/repo/issues/9',
      null,
    );

    expect(result).toBeNull();
  });

  it('returns null when the main transcript path is not a .jsonl file', () => {
    const resolver = new FileSystemSubAgentTranscriptDirectoryResolver(
      rootDirectory,
    );

    const result = resolver.resolveSubAgentsDirectory(
      'https_//github_com/owner/repo/issues/9',
      path.join(rootDirectory, 'slug', 'no-extension'),
    );

    expect(result).toBeNull();
  });
});
