import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  defaultWorkerSessionFailureStreakDirectoryPath,
  FileSystemWorkerSessionFailureStreakRepository,
} from './FileSystemWorkerSessionFailureStreakRepository';

const issueUrl = 'https://github.com/owner/repo/issues/999';
const otherIssueUrl = 'https://github.com/owner/repo/issues/1000';

const streakFileNameOf = (streakIssueUrl: string): string =>
  `${createHash('sha256').update(streakIssueUrl).digest('hex').slice(0, 16)}.json`;

const collectStandardErrorOutput = (): {
  joinedOutput: () => string;
  restore: () => void;
} => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => undefined);
  const standardErrorWriteSpy = jest
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true);
  return {
    joinedOutput: () =>
      [
        ...consoleErrorSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
        ...standardErrorWriteSpy.mock.calls,
      ]
        .flat()
        .map(String)
        .join('\n'),
    restore: () => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      standardErrorWriteSpy.mockRestore();
    },
  };
};

describe('FileSystemWorkerSessionFailureStreakRepository', () => {
  let temporaryDirectory: string;
  let streakDirectoryPath: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'worker-session-failure-streak-'),
    );
    streakDirectoryPath = path.join(
      temporaryDirectory,
      'worker-session-failure-streaks',
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('returns null before any streak is saved', async () => {
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );

    expect(await repository.findByIssueUrl(issueUrl)).toBeNull();
  });

  it('returns the saved streak after save', async () => {
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );

    await repository.save(issueUrl, {
      terminalReason: 'api_error',
      consecutiveFailureCount: 2,
    });

    expect(await repository.findByIssueUrl(issueUrl)).toEqual({
      terminalReason: 'api_error',
      consecutiveFailureCount: 2,
    });
  });

  it('returns the streak saved last when one issue is saved twice', async () => {
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );

    await repository.save(issueUrl, {
      terminalReason: 'api_error',
      consecutiveFailureCount: 2,
    });
    await repository.save(issueUrl, {
      terminalReason: 'blocking_limit',
      consecutiveFailureCount: 1,
    });

    expect(await repository.findByIssueUrl(issueUrl)).toEqual({
      terminalReason: 'blocking_limit',
      consecutiveFailureCount: 1,
    });
  });

  it('returns null after deleteByIssueUrl', async () => {
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );
    await repository.save(issueUrl, {
      terminalReason: 'api_error',
      consecutiveFailureCount: 3,
    });

    await repository.deleteByIssueUrl(issueUrl);

    expect(await repository.findByIssueUrl(issueUrl)).toBeNull();
  });

  it('keeps the streaks of two issue URLs independent', async () => {
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );
    await repository.save(issueUrl, {
      terminalReason: 'api_error',
      consecutiveFailureCount: 2,
    });
    await repository.save(otherIssueUrl, {
      terminalReason: 'blocking_limit',
      consecutiveFailureCount: 1,
    });

    await repository.deleteByIssueUrl(issueUrl);

    expect(await repository.findByIssueUrl(issueUrl)).toBeNull();
    expect(await repository.findByIssueUrl(otherIssueUrl)).toEqual({
      terminalReason: 'blocking_limit',
      consecutiveFailureCount: 1,
    });
  });

  it('writes one JSON file per issue named by the first 16 hexadecimal characters of the SHA-256 of the issue URL', async () => {
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );

    await repository.save(issueUrl, {
      terminalReason: 'api_error',
      consecutiveFailureCount: 2,
    });

    expect(fs.readdirSync(streakDirectoryPath)).toEqual([
      streakFileNameOf(issueUrl),
    ]);
    const storedContent: unknown = JSON.parse(
      fs.readFileSync(
        path.join(streakDirectoryPath, streakFileNameOf(issueUrl)),
        'utf8',
      ),
    );
    expect(storedContent).toEqual({
      issueUrl,
      terminalReason: 'api_error',
      consecutiveFailureCount: 2,
    });
  });

  it('reads a streak file written in the stored format', async () => {
    fs.mkdirSync(streakDirectoryPath, { recursive: true });
    fs.writeFileSync(
      path.join(streakDirectoryPath, streakFileNameOf(issueUrl)),
      JSON.stringify({
        issueUrl,
        terminalReason: 'blocking_limit',
        consecutiveFailureCount: 2,
      }),
    );
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );

    expect(await repository.findByIssueUrl(issueUrl)).toEqual({
      terminalReason: 'blocking_limit',
      consecutiveFailureCount: 2,
    });
  });

  it('treats a file it cannot parse as no stored streak and writes a warning naming the file to standard error', async () => {
    const unparsableStreakFilePath = path.join(
      streakDirectoryPath,
      streakFileNameOf(issueUrl),
    );
    fs.mkdirSync(streakDirectoryPath, { recursive: true });
    fs.writeFileSync(unparsableStreakFilePath, 'api_error\n2\n');
    const repository = new FileSystemWorkerSessionFailureStreakRepository(
      streakDirectoryPath,
    );
    const standardErrorOutput = collectStandardErrorOutput();

    try {
      expect(await repository.findByIssueUrl(issueUrl)).toBeNull();
      expect(standardErrorOutput.joinedOutput()).toContain(
        unparsableStreakFilePath,
      );
    } finally {
      standardErrorOutput.restore();
    }
  });

  it.each([
    {
      label: 'an object without any streak field',
      storedContent: JSON.stringify({ unexpected: true }),
    },
    {
      label: 'an array holding a streak',
      storedContent: JSON.stringify([
        {
          issueUrl,
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      ]),
    },
    {
      label: 'an object whose streak fields have the wrong types',
      storedContent: JSON.stringify({
        issueUrl,
        terminalReason: 5,
        consecutiveFailureCount: 'x',
      }),
    },
    {
      label: 'the JSON literal null',
      storedContent: 'null',
    },
  ])(
    'treats a stored file holding valid JSON that is $label as no stored streak and writes a warning naming the file to standard error',
    async ({ storedContent }) => {
      const invalidStreakFilePath = path.join(
        streakDirectoryPath,
        streakFileNameOf(issueUrl),
      );
      fs.mkdirSync(streakDirectoryPath, { recursive: true });
      fs.writeFileSync(invalidStreakFilePath, storedContent);
      const repository = new FileSystemWorkerSessionFailureStreakRepository(
        streakDirectoryPath,
      );
      const standardErrorOutput = collectStandardErrorOutput();

      try {
        expect(await repository.findByIssueUrl(issueUrl)).toBeNull();
        expect(standardErrorOutput.joinedOutput()).toContain(
          invalidStreakFilePath,
        );
      } finally {
        standardErrorOutput.restore();
      }
    },
  );

  it('defaults to the worker-session-failure-streaks directory under the TDPM cache directory', () => {
    const originalXdgCacheHome = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = temporaryDirectory;
    try {
      expect(defaultWorkerSessionFailureStreakDirectoryPath()).toBe(
        path.join(temporaryDirectory, 'tdpm', 'worker-session-failure-streaks'),
      );
    } finally {
      if (originalXdgCacheHome === undefined) {
        delete process.env.XDG_CACHE_HOME;
      } else {
        process.env.XDG_CACHE_HOME = originalXdgCacheHome;
      }
    }
  });
});
