import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ACTION_RESULT_LIMIT,
  ACTION_RESULT_RETENTION_MS,
  ACTION_RESULTS_FILE_NAME,
  type ConsoleActionRecord,
  readConsoleActionRecords,
  writeConsoleActionRecord,
} from './consoleActionResultStore';

const nowMs = Date.parse('2026-01-02T00:00:00.000Z');

const record = (recordedAtMs: number): ConsoleActionRecord => ({
  recordedAtMs,
  statusCode: 200,
  body: { ok: true },
});

describe('console action result store', () => {
  let consoleDataOutputDir: string;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDataOutputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'console-action-result-store-'),
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    fs.rmSync(consoleDataOutputDir, { recursive: true, force: true });
  });

  it('reads record stores according to their contents and retention boundary', () => {
    const cases: Array<{
      name: string;
      contents?: string;
      expected: Record<string, ConsoleActionRecord>;
      errorCount: number;
    }> = [
      {
        name: 'missing store file',
        expected: {},
        errorCount: 0,
      },
      {
        name: 'corrupt JSON store file',
        contents: '{',
        expected: {},
        errorCount: 1,
      },
      {
        name: 'non-object top-level value',
        contents: JSON.stringify([]),
        expected: {},
        errorCount: 1,
      },
      {
        name: 'invalid entries mixed with valid entries',
        contents: JSON.stringify({
          invalid: { recordedAtMs: nowMs, statusCode: '200', body: {} },
          valid: record(nowMs),
        }),
        expected: { valid: record(nowMs) },
        errorCount: 1,
      },
      {
        name: 'expired entries and entries at the retention boundary',
        contents: JSON.stringify({
          expired: record(nowMs - ACTION_RESULT_RETENTION_MS - 1),
          boundary: record(nowMs - ACTION_RESULT_RETENTION_MS),
        }),
        expected: {
          boundary: record(nowMs - ACTION_RESULT_RETENTION_MS),
        },
        errorCount: 0,
      },
    ];

    for (const testCase of cases) {
      fs.rmSync(consoleDataOutputDir, { recursive: true, force: true });
      fs.mkdirSync(consoleDataOutputDir, { recursive: true });
      if (testCase.contents !== undefined) {
        fs.writeFileSync(
          path.join(consoleDataOutputDir, ACTION_RESULTS_FILE_NAME),
          testCase.contents,
        );
      }
      consoleErrorSpy.mockClear();

      expect(readConsoleActionRecords(consoleDataOutputDir, nowMs)).toEqual(
        testCase.expected,
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(testCase.errorCount);
    }
  });

  it('exports the configured retention and limit constants', () => {
    expect(ACTION_RESULTS_FILE_NAME).toBe('.console-action-results.json');
    expect(ACTION_RESULT_RETENTION_MS).toBe(24 * 60 * 60 * 1000);
    expect(ACTION_RESULT_LIMIT).toBe(1000);
  });

  it('writes a record that a subsequent read returns', () => {
    const actionRecord = record(nowMs);

    writeConsoleActionRecord(
      consoleDataOutputDir,
      'action-1',
      actionRecord,
      nowMs,
    );

    expect(readConsoleActionRecords(consoleDataOutputDir, nowMs)).toEqual({
      'action-1': actionRecord,
    });
  });

  it('drops expired entries when writing a record', () => {
    fs.writeFileSync(
      path.join(consoleDataOutputDir, ACTION_RESULTS_FILE_NAME),
      JSON.stringify({
        expired: record(nowMs - ACTION_RESULT_RETENTION_MS - 1),
      }),
    );

    writeConsoleActionRecord(
      consoleDataOutputDir,
      'current',
      record(nowMs),
      nowMs,
    );

    expect(readConsoleActionRecords(consoleDataOutputDir, nowMs)).toEqual({
      current: record(nowMs),
    });
  });

  it('keeps the most recent records when the limit is exceeded', () => {
    const initialRecords = Object.fromEntries(
      Array.from({ length: ACTION_RESULT_LIMIT + 1 }, (_, index) => [
        `action-${index}`,
        record(nowMs - ACTION_RESULT_LIMIT - 1 + index),
      ]),
    );
    fs.writeFileSync(
      path.join(consoleDataOutputDir, ACTION_RESULTS_FILE_NAME),
      JSON.stringify(initialRecords),
    );

    writeConsoleActionRecord(
      consoleDataOutputDir,
      'most-recent',
      record(nowMs),
      nowMs,
    );

    const stored = readConsoleActionRecords(consoleDataOutputDir, nowMs);
    expect(Object.keys(stored)).toHaveLength(ACTION_RESULT_LIMIT);
    expect(stored['action-0']).toBeUndefined();
    expect(stored['action-1']).toBeUndefined();
    expect(stored['action-2']).toEqual(record(nowMs - ACTION_RESULT_LIMIT + 1));
    expect(stored['action-1000']).toEqual(record(nowMs - 1));
    expect(stored['most-recent']).toEqual(record(nowMs));
  });

  it('leaves no temporary file after writing', () => {
    writeConsoleActionRecord(
      consoleDataOutputDir,
      'action-1',
      record(nowMs),
      nowMs,
    );

    expect(
      fs.existsSync(
        path.join(consoleDataOutputDir, `${ACTION_RESULTS_FILE_NAME}.tmp`),
      ),
    ).toBe(false);
  });

  it('logs and does not throw when writing cannot succeed', () => {
    const regularFilePath = path.join(consoleDataOutputDir, 'regular-file');
    fs.writeFileSync(regularFilePath, 'not a directory');

    expect(() =>
      writeConsoleActionRecord(
        regularFilePath,
        'action-1',
        record(nowMs),
        nowMs,
      ),
    ).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
