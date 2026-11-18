import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemCodexRolloutRateLimitRepository } from './FileSystemCodexRolloutRateLimitRepository';

const sevenDayLine = (timestamp: string, usedPercent: number): string =>
  JSON.stringify({
    timestamp,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      rate_limits: {
        primary: {
          used_percent: usedPercent,
          window_minutes: 10080,
          resets_at: 1795004568,
        },
        secondary: null,
      },
    },
  });

const writeRollout = (
  filePath: string,
  lines: string[],
  mtimeEpochSeconds: number,
): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  fs.utimesSync(filePath, mtimeEpochSeconds, mtimeEpochSeconds);
};

describe('FileSystemCodexRolloutRateLimitRepository', () => {
  let codexHome: string;

  beforeEach(() => {
    codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rollout-'));
  });

  afterEach(() => {
    fs.rmSync(codexHome, { recursive: true, force: true });
  });

  it('returns null with no errors when the Codex home has no rollout files', () => {
    const result =
      new FileSystemCodexRolloutRateLimitRepository().readLatestSevenDayRateLimit(
        codexHome,
      );
    expect(result).toEqual({ observation: null, errorMessages: [] });
  });

  it('reads the newest rollout by modification time across sessions', () => {
    writeRollout(
      path.join(codexHome, 'sessions', '2026', '11', '17', 'rollout-old.jsonl'),
      [sevenDayLine('2026-11-17T10:00:00.000Z', 5)],
      1795000000,
    );
    writeRollout(
      path.join(codexHome, 'sessions', '2026', '11', '18', 'rollout-new.jsonl'),
      [sevenDayLine('2026-11-18T02:16:17.179Z', 11)],
      1795100000,
    );
    const result =
      new FileSystemCodexRolloutRateLimitRepository().readLatestSevenDayRateLimit(
        codexHome,
      );
    expect(result.observation).toEqual({
      capturedAt: '2026-11-18T02:16:17.179Z',
      usedPercent: 11,
      resetsAtEpochSeconds: 1795004568,
    });
    expect(result.errorMessages).toEqual([]);
  });

  it('includes rollouts that were moved to sessions-archive', () => {
    writeRollout(
      path.join(
        codexHome,
        'sessions-archive',
        '2026',
        '11',
        '18',
        'rollout-archived.jsonl',
      ),
      [sevenDayLine('2026-11-18T03:00:00.000Z', 7)],
      1795100000,
    );
    const result =
      new FileSystemCodexRolloutRateLimitRepository().readLatestSevenDayRateLimit(
        codexHome,
      );
    expect(result.observation?.usedPercent).toBe(7);
  });

  it('finds the 7-day event only within the bounded tail of a file', () => {
    const padding = 'x'.repeat(4096);
    writeRollout(
      path.join(codexHome, 'sessions', 'rollout-tail-miss.jsonl'),
      [sevenDayLine('2026-11-18T02:00:00.000Z', 9), padding],
      1795100000,
    );
    const result = new FileSystemCodexRolloutRateLimitRepository({
      maxFilesToRead: 20,
      tailBytes: 512,
    }).readLatestSevenDayRateLimit(codexHome);
    expect(result).toEqual({ observation: null, errorMessages: [] });
  });

  it('falls back to an older rollout and reports the unreadable newer one', () => {
    writeRollout(
      path.join(codexHome, 'sessions', 'rollout-old.jsonl'),
      [sevenDayLine('2026-11-17T10:00:00.000Z', 5)],
      1795000000,
    );
    writeRollout(
      path.join(codexHome, 'sessions', 'rollout-corrupt.jsonl'),
      ['{"payload":{"rate_limits":{"primary":'],
      1795100000,
    );
    const result =
      new FileSystemCodexRolloutRateLimitRepository().readLatestSevenDayRateLimit(
        codexHome,
      );
    expect(result.observation?.usedPercent).toBe(5);
    expect(result.errorMessages).toHaveLength(1);
    expect(result.errorMessages[0]).toContain('rollout-corrupt.jsonl');
  });

  it('reports the error and no observation when every readable rollout is corrupt', () => {
    writeRollout(
      path.join(codexHome, 'sessions', 'rollout-corrupt.jsonl'),
      ['{"payload":{"rate_limits":{"primary":'],
      1795100000,
    );
    const result =
      new FileSystemCodexRolloutRateLimitRepository().readLatestSevenDayRateLimit(
        codexHome,
      );
    expect(result.observation).toBeNull();
    expect(result.errorMessages).toHaveLength(1);
  });
});
