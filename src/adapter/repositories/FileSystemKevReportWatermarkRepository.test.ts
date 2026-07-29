import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemKevReportWatermarkRepository } from './FileSystemKevReportWatermarkRepository';

describe('FileSystemKevReportWatermarkRepository', () => {
  let temporaryDirectory: string;
  let stateFilePath: string;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'kev-report-watermark-'),
    );
    stateFilePath = path.join(
      temporaryDirectory,
      'nested',
      'kev-report-watermark.json',
    );
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorLog.mockRestore();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  const writeStoredContent = (content: string): void => {
    fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
    fs.writeFileSync(stateFilePath, content);
  };

  const loggedMessages = (): string[] =>
    errorLog.mock.calls.map((call: unknown[]) => String(call[0]));

  it('reports an absent state file as absent without logging an error', async () => {
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );
    expect(await repository.load()).toEqual({ type: 'absent' });
    expect(loggedMessages()).toEqual([]);
  });

  it('persists and reloads the watermark', async () => {
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );
    await repository.save({
      lastReportedDateAdded: '2024-01-02',
      reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
    });

    expect(await repository.load()).toEqual({
      type: 'stored',
      watermark: {
        lastReportedDateAdded: '2024-01-02',
        reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
      },
    });
    expect(loggedMessages()).toEqual([]);
  });

  it('overwrites a previously saved watermark', async () => {
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );
    await repository.save({
      lastReportedDateAdded: '2024-01-02',
      reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
    });
    await repository.save({
      lastReportedDateAdded: '2024-01-03',
      reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0003'],
    });

    expect(await repository.load()).toEqual({
      type: 'stored',
      watermark: {
        lastReportedDateAdded: '2024-01-03',
        reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0003'],
      },
    });
  });

  it('reports invalid JSON as unreadable, logging the state file path and the cause, and leaves the file untouched', async () => {
    writeStoredContent('not json');
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    const result = await repository.load();

    expect(result.type).toBe('unreadable');
    expect(result).toHaveProperty('reason');
    expect(
      loggedMessages().some(
        (message) =>
          message.includes(stateFilePath) &&
          message.includes('valid JSON') &&
          message.includes('SyntaxError'),
      ),
    ).toBe(true);
    expect(fs.readFileSync(stateFilePath, 'utf8')).toBe('not json');
  });

  it('reports stored content that is not a JSON object as unreadable', async () => {
    writeStoredContent(JSON.stringify(['2024-01-02']));
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    expect((await repository.load()).type).toBe('unreadable');
    expect(
      loggedMessages().some(
        (message) =>
          message.includes(stateFilePath) && message.includes('JSON object'),
      ),
    ).toBe(true);
  });

  it('reports a non-string stored date as unreadable', async () => {
    writeStoredContent(
      JSON.stringify({
        lastReportedDateAdded: 20240102,
        reportedCveIdsOnLastReportedDateAdded: [],
      }),
    );
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    expect((await repository.load()).type).toBe('unreadable');
    expect(
      loggedMessages().some(
        (message) =>
          message.includes(stateFilePath) &&
          message.includes('lastReportedDateAdded'),
      ),
    ).toBe(true);
  });

  it('reports an empty stored date as unreadable rather than as a usable boundary', async () => {
    writeStoredContent(
      JSON.stringify({
        lastReportedDateAdded: '',
        reportedCveIdsOnLastReportedDateAdded: [],
      }),
    );
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    expect((await repository.load()).type).toBe('unreadable');
    expect(
      loggedMessages().some(
        (message) =>
          message.includes(stateFilePath) &&
          message.includes('calendar date') &&
          message.includes('YYYY-MM-DD'),
      ),
    ).toBe(true);
  });

  it('reports a stored date that is not a real calendar date as unreadable', async () => {
    writeStoredContent(
      JSON.stringify({
        lastReportedDateAdded: '2024-02-31',
        reportedCveIdsOnLastReportedDateAdded: [],
      }),
    );
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    expect((await repository.load()).type).toBe('unreadable');
    expect(
      loggedMessages().some((message) => message.includes('calendar date')),
    ).toBe(true);
  });

  it('reports a stored identifier list that is not an array as unreadable', async () => {
    writeStoredContent(
      JSON.stringify({
        lastReportedDateAdded: '2024-01-02',
        reportedCveIdsOnLastReportedDateAdded: 'CVE-2024-0002',
      }),
    );
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    expect((await repository.load()).type).toBe('unreadable');
    expect(
      loggedMessages().some((message) =>
        message.includes('reportedCveIdsOnLastReportedDateAdded'),
      ),
    ).toBe(true);
  });

  it('reports stored identifiers that are not all strings as unreadable', async () => {
    writeStoredContent(
      JSON.stringify({
        lastReportedDateAdded: '2024-01-02',
        reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002', 7],
      }),
    );
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    expect((await repository.load()).type).toBe('unreadable');
    expect(
      loggedMessages().some((message) => message.includes('non-string')),
    ).toBe(true);
  });

  it('reports a path that cannot be read as unreadable rather than as absent', async () => {
    fs.mkdirSync(stateFilePath, { recursive: true });
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    expect((await repository.load()).type).toBe('unreadable');
    expect(
      loggedMessages().some(
        (message) =>
          message.includes(stateFilePath) &&
          message.includes('could not be read'),
      ),
    ).toBe(true);
  });

  it('logs the state file path and the cause when the watermark cannot be written', async () => {
    fs.writeFileSync(path.dirname(stateFilePath), 'not a directory');
    const repository = new FileSystemKevReportWatermarkRepository(
      stateFilePath,
    );

    await expect(
      repository.save({
        lastReportedDateAdded: '2024-01-02',
        reportedCveIdsOnLastReportedDateAdded: ['CVE-2024-0002'],
      }),
    ).rejects.toThrow();
    expect(
      loggedMessages().some(
        (message) =>
          message.includes(stateFilePath) &&
          message.includes('Unable to write the KEV report watermark'),
      ),
    ).toBe(true);
  });
});
