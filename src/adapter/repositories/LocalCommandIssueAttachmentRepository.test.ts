import { mkdtemp, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  LocalCommandRunner,
  LocalCommandRunnerOptions,
} from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import {
  LocalCommandIssueAttachmentRepository,
  relabelAttachmentMarkdown,
  resolveAttachmentExtension,
  sanitizeAttachmentFileName,
  UPLOAD_COMMAND,
} from './LocalCommandIssueAttachmentRepository';

describe('sanitizeAttachmentFileName', () => {
  it('should keep a safe file name unchanged', () => {
    expect(sanitizeAttachmentFileName('screenshot.png')).toBe('screenshot.png');
  });

  it('should drop directory components and replace unsafe characters', () => {
    expect(sanitizeAttachmentFileName('../../etc/pass wd;rm.png')).toBe(
      'pass_wd_rm.png',
    );
  });

  it('should fall back to a default name when nothing safe remains', () => {
    expect(sanitizeAttachmentFileName('')).toBe('attachment');
  });
});

describe('resolveAttachmentExtension', () => {
  it('should return the matching allowed extension', () => {
    expect(resolveAttachmentExtension('Screenshot 2026.PNG')).toBe('.png');
  });

  it('should return an empty extension for an unlisted one', () => {
    expect(resolveAttachmentExtension('payload.sh')).toBe('');
  });
});

describe('relabelAttachmentMarkdown', () => {
  it('should replace the label of an image markdown', () => {
    expect(
      relabelAttachmentMarkdown(
        '![attachment](https://example.com/a)',
        'shot.png',
      ),
    ).toBe('![shot.png](https://example.com/a)');
  });

  it('should replace the label of a link markdown', () => {
    expect(
      relabelAttachmentMarkdown(
        '[attachment](https://example.com/a)',
        'note.md',
      ),
    ).toBe('[note.md](https://example.com/a)');
  });

  it('should keep unexpected output unchanged', () => {
    expect(relabelAttachmentMarkdown('unexpected output', 'shot.png')).toBe(
      'unexpected output',
    );
  });
});

describe('LocalCommandIssueAttachmentRepository', () => {
  it('should upload the written file and return the markdown the command printed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachment-test-root-'));
    const received: { program: string; args: string[] }[] = [];
    const runner: LocalCommandRunner = {
      runCommand: async (program, args) => {
        received.push({ program, args });
        return {
          stdout:
            '![screenshot](https://github.com/user-attachments/assets/11111111-2222-3333-4444-555555555555)\n',
          stderr: '',
          exitCode: 0,
        };
      },
    };
    const repository = new LocalCommandIssueAttachmentRepository(runner, root);

    const markdown = await repository.uploadAttachment({
      issueOrPullRequestUrl: 'https://github.com/owner/repo/issues/1',
      fileName: 'screenshot.png',
      content: new Uint8Array([1, 2, 3]),
    });

    expect(markdown).toBe(
      '![screenshot.png](https://github.com/user-attachments/assets/11111111-2222-3333-4444-555555555555)',
    );
    expect(received).toHaveLength(1);
    expect(received[0].program).toBe(UPLOAD_COMMAND);
    expect(received[0].args[0].endsWith('/attachment.png')).toBe(true);
    expect(received[0].args[1]).toBe('https://github.com/owner/repo/issues/1');
    expect(await readdir(root)).toEqual([]);
  });

  it('should throw with the command stderr when the upload command fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachment-test-root-'));
    const runner: LocalCommandRunner = {
      runCommand: async () => ({
        stdout: '',
        stderr: 'Error: No GitHub web session is available\n',
        exitCode: 1,
      }),
    };
    const repository = new LocalCommandIssueAttachmentRepository(runner, root);

    await expect(
      repository.uploadAttachment({
        issueOrPullRequestUrl: 'https://github.com/owner/repo/issues/1',
        fileName: 'screenshot.png',
        content: new Uint8Array([1]),
      }),
    ).rejects.toThrow(
      `${UPLOAD_COMMAND} failed with exit code 1: Error: No GitHub web session is available`,
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('should throw when the upload command prints no markdown', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachment-test-root-'));
    const runner: LocalCommandRunner = {
      runCommand: async () => ({ stdout: '\n', stderr: '', exitCode: 0 }),
    };
    const repository = new LocalCommandIssueAttachmentRepository(runner, root);

    await expect(
      repository.uploadAttachment({
        issueOrPullRequestUrl: 'https://github.com/owner/repo/issues/1',
        fileName: 'screenshot.png',
        content: new Uint8Array([1]),
      }),
    ).rejects.toThrow(`${UPLOAD_COMMAND} returned no markdown`);
  });

  it('should pass GH_TOKEN env resolved from the owner when resolveGithubToken is provided', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachment-test-root-'));
    const received: {
      program: string;
      args: string[];
      options: LocalCommandRunnerOptions | undefined;
    }[] = [];
    const runner: LocalCommandRunner = {
      runCommand: async (program, args, options) => {
        received.push({ program, args, options });
        return {
          stdout:
            '![screenshot](https://github.com/user-attachments/assets/abc)\n',
          stderr: '',
          exitCode: 0,
        };
      },
    };
    const resolveGithubToken = (owner: string): string => `token-for-${owner}`;
    const repository = new LocalCommandIssueAttachmentRepository(
      runner,
      root,
      resolveGithubToken,
    );

    await repository.uploadAttachment({
      issueOrPullRequestUrl: 'https://github.com/meta-site/repo/issues/1',
      fileName: 'screenshot.png',
      content: new Uint8Array([1, 2, 3]),
    });

    expect(received).toHaveLength(1);
    expect(received[0].options).toEqual({
      env: { GH_TOKEN: 'token-for-meta-site' },
    });
  });

  it('should pass undefined as third argument to runCommand when resolveGithubToken is not provided', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachment-test-root-'));
    const received: {
      program: string;
      args: string[];
      options: LocalCommandRunnerOptions | undefined;
    }[] = [];
    const runner: LocalCommandRunner = {
      runCommand: async (program, args, options) => {
        received.push({ program, args, options });
        return {
          stdout:
            '![screenshot](https://github.com/user-attachments/assets/abc)\n',
          stderr: '',
          exitCode: 0,
        };
      },
    };
    const repository = new LocalCommandIssueAttachmentRepository(runner, root);

    await repository.uploadAttachment({
      issueOrPullRequestUrl: 'https://github.com/owner/repo/issues/1',
      fileName: 'screenshot.png',
      content: new Uint8Array([1]),
    });

    expect(received).toHaveLength(1);
    expect(received[0].options).toBeUndefined();
  });
});
