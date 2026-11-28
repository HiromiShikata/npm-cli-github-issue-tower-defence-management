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
  const resolveGithubToken = (): string => 'default-token';

  type BatchUploadRequest = {
    issueOrPullRequestUrl: string;
    files: { fileName: string; content: Uint8Array }[];
  };
  type BatchUploadResult =
    | { fileName: string; status: 'uploaded'; markdown: string }
    | { fileName: string; status: 'failed'; error: string };
  type BatchAttachmentRepository = {
    uploadAttachment: (
      request: BatchUploadRequest,
    ) => Promise<BatchUploadResult[]>;
  };

  const asBatchRepository = (
    repository: LocalCommandIssueAttachmentRepository,
  ): BatchAttachmentRepository =>
    repository as unknown as BatchAttachmentRepository;

  it('should run the upload command with the github token resolved for the item url', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachment-test-root-'));
    const received: {
      args: string[];
      options: LocalCommandRunnerOptions | undefined;
    }[] = [];
    const runner: LocalCommandRunner = {
      runCommand: async (_program, args, options) => {
        received.push({ args, options });
        return {
          stdout:
            '![attachment](https://github.com/user-attachments/assets/66666666-7777-8888-9999-000000000000)\n',
          stderr: '',
          exitCode: 0,
        };
      },
      spawnInteractive: jest.fn(),
    };
    const repository = new LocalCommandIssueAttachmentRepository(
      runner,
      (issueOrPullRequestUrl) =>
        issueOrPullRequestUrl.startsWith('https://github.com/acme/')
          ? 'acme-token'
          : 'other-token',
      root,
    );

    await repository.uploadAttachment({
      issueOrPullRequestUrl: 'https://github.com/acme/repo/issues/7',
      fileName: 'screenshot.png',
      content: new Uint8Array([1]),
    });

    expect(received).toHaveLength(1);
    expect(received[0].options?.env).toEqual({ GH_TOKEN: 'acme-token' });
  });

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
      spawnInteractive: jest.fn(),
    };
    const repository = new LocalCommandIssueAttachmentRepository(
      runner,
      resolveGithubToken,
      root,
    );

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
      spawnInteractive: jest.fn(),
    };
    const repository = new LocalCommandIssueAttachmentRepository(
      runner,
      resolveGithubToken,
      root,
    );

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
      spawnInteractive: jest.fn(),
    };
    const repository = new LocalCommandIssueAttachmentRepository(
      runner,
      resolveGithubToken,
      root,
    );

    await expect(
      repository.uploadAttachment({
        issueOrPullRequestUrl: 'https://github.com/owner/repo/issues/1',
        fileName: 'screenshot.png',
        content: new Uint8Array([1]),
      }),
    ).rejects.toThrow(`${UPLOAD_COMMAND} returned no markdown`);
  });

  it.each([
    {
      name: 'maps uploaded and failed JSONL records independently',
      fileNames: ['first.png', 'broken.png', 'last.txt'],
      exitCode: 0,
      output: (paths: string[]) =>
        [
          {
            filePath: paths[0],
            status: 'uploaded',
            url: 'https://github.com/user-attachments/first',
            markdown:
              '![attachment](https://github.com/user-attachments/first)',
          },
          {
            filePath: paths[1],
            status: 'failed',
            error: 'upload failed',
          },
          {
            filePath: paths[2],
            status: 'uploaded',
            url: 'https://github.com/user-attachments/last',
            markdown: '[attachment](https://github.com/user-attachments/last)',
          },
        ]
          .map((line) => JSON.stringify(line))
          .join('\n'),
      stderr: '',
      expected: [
        {
          fileName: 'first.png',
          status: 'uploaded',
          markdown: '![first.png](https://github.com/user-attachments/first)',
        },
        { fileName: 'broken.png', status: 'failed', error: 'upload failed' },
        {
          fileName: 'last.txt',
          status: 'uploaded',
          markdown: '[last.txt](https://github.com/user-attachments/last)',
        },
      ],
    },
    {
      name: 'uses command stderr for a file with no JSONL record',
      fileNames: ['first.png', 'missing.txt'],
      exitCode: 0,
      output: (paths: string[]) =>
        JSON.stringify({
          filePath: paths[0],
          status: 'uploaded',
          url: 'https://github.com/user-attachments/first',
          markdown: '![attachment](https://github.com/user-attachments/first)',
        }),
      stderr: 'command stderr\n',
      expected: [
        {
          fileName: 'first.png',
          status: 'uploaded',
          markdown: '![first.png](https://github.com/user-attachments/first)',
        },
        { fileName: 'missing.txt', status: 'failed', error: 'command stderr' },
      ],
    },
    {
      name: 'keeps reported successes when the command exits non-zero',
      fileNames: ['first.png', 'second.txt'],
      exitCode: 3,
      output: (paths: string[]) =>
        paths
          .map((filePath) =>
            JSON.stringify({
              filePath,
              status: 'uploaded',
              url: `https://github.com/user-attachments/${filePath}`,
              markdown:
                '![attachment](https://github.com/user-attachments/all)',
            }),
          )
          .join('\n'),
      stderr: 'policy failure\n',
      expected: [
        {
          fileName: 'first.png',
          status: 'uploaded',
          markdown: '![first.png](https://github.com/user-attachments/all)',
        },
        {
          fileName: 'second.txt',
          status: 'uploaded',
          markdown: '![second.png](https://github.com/user-attachments/all)',
        },
      ],
    },
  ])('$name', async ({ exitCode, output, stderr, expected, fileNames }) => {
    const root = await mkdtemp(join(tmpdir(), 'attachment-test-root-'));
    const calls: { program: string; args: string[] }[] = [];
    const runner: LocalCommandRunner = {
      runCommand: async (program, args) => {
        calls.push({ program, args });
        return {
          stdout: output(args.slice(1, -1)),
          stderr,
          exitCode,
        };
      },
      spawnInteractive: jest.fn(),
    };
    const repository = asBatchRepository(
      new LocalCommandIssueAttachmentRepository(
        runner,
        resolveGithubToken,
        root,
      ),
    );

    const actual = await repository.uploadAttachment({
      issueOrPullRequestUrl: 'https://github.com/owner/repo/issues/1',
      files: fileNames.map((fileName, index) => ({
        fileName,
        content: new Uint8Array([index + 1]),
      })),
    });

    expect(actual).toEqual(expected);
    expect(calls).toHaveLength(1);
    expect(calls[0].program).toBe(UPLOAD_COMMAND);
    expect(calls[0].args[0]).toBe('--output-format=jsonl');
    expect(calls[0].args.at(-1)).toBe('https://github.com/owner/repo/issues/1');
    expect(calls[0].args.slice(1, -1)).toHaveLength(fileNames.length);
    expect(
      calls[0].args
        .slice(1, -1)
        .map((filePath) => (filePath.endsWith('.txt') ? '.txt' : '.png')),
    ).toEqual(
      fileNames.map((fileName) =>
        fileName.endsWith('.txt') ? '.txt' : '.png',
      ),
    );
  });
});
