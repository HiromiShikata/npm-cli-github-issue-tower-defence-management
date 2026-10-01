import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemWorkerSessionLogRepository } from './FileSystemWorkerSessionLogRepository';

const rejectedRateLimitEventLine = JSON.stringify({
  type: 'rate_limit_event',
  rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour' },
});

const overloadedEndingLine = JSON.stringify({
  type: 'result',
  is_error: true,
  result: 'API Error: Overloaded',
  api_error_status: 529,
  terminal_reason: 'api_error',
});

const launcherSessionResumptionTextLine =
  'Session resumption: resuming the previous conversation of this task';

describe('FileSystemWorkerSessionLogRepository', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'worker-session-log-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('reads every line of an existing session log in order', async () => {
    const sessionLogFilePath = path.join(temporaryDirectory, 'session.log');
    fs.writeFileSync(
      sessionLogFilePath,
      `${launcherSessionResumptionTextLine}\n${rejectedRateLimitEventLine}\n${overloadedEndingLine}\n`,
    );

    const readResult =
      await new FileSystemWorkerSessionLogRepository().readLines(
        sessionLogFilePath,
      );

    expect(readResult.outcome).toBe('read');
    expect(
      readResult.outcome === 'read'
        ? readResult.lines.filter((line) => line !== '')
        : [],
    ).toEqual([
      launcherSessionResumptionTextLine,
      rejectedRateLimitEventLine,
      overloadedEndingLine,
    ]);
  });

  it('reads an empty session log as no lines', async () => {
    const sessionLogFilePath = path.join(temporaryDirectory, 'empty.log');
    fs.writeFileSync(sessionLogFilePath, '');

    const readResult =
      await new FileSystemWorkerSessionLogRepository().readLines(
        sessionLogFilePath,
      );

    expect(readResult.outcome).toBe('read');
    expect(
      readResult.outcome === 'read'
        ? readResult.lines.filter((line) => line !== '')
        : null,
    ).toEqual([]);
  });

  it('reports a session log path that does not exist as unreadable with the error message', async () => {
    const missingSessionLogFilePath = path.join(
      temporaryDirectory,
      'missing.log',
    );

    const readResult =
      await new FileSystemWorkerSessionLogRepository().readLines(
        missingSessionLogFilePath,
      );

    expect(readResult.outcome).toBe('unreadable');
    expect(
      readResult.outcome === 'unreadable' ? readResult.errorMessage : '',
    ).toContain('ENOENT');
  });
});
