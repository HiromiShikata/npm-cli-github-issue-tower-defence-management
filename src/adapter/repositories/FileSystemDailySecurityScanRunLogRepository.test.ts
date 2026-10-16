import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DailySecurityScanRunLogEntry } from '../../domain/entities/DailySecurityScanRunLogEntry';
import { isRecord } from '../../domain/usecases/isRecord';
import { FileSystemDailySecurityScanRunLogRepository } from './FileSystemDailySecurityScanRunLogRepository';

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

describe('FileSystemDailySecurityScanRunLogRepository', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'daily-security-scan-run-log-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  const filePathFor = (repositoryName: string): string =>
    path.join(temporaryDirectory, `${repositoryName}.json`);

  const readStored = (repositoryName: string): unknown =>
    JSON.parse(fs.readFileSync(filePathFor(repositoryName), 'utf8'));

  const buildEntry = (
    overrides: Partial<DailySecurityScanRunLogEntry> = {},
  ): DailySecurityScanRunLogEntry => ({
    repositoryName: 'app',
    executedAtIso: '2024-01-01T00:00:00.000Z',
    outcome: { type: 'scanCompletedClean', clonedCommitSha: 'abc123' },
    ...overrides,
  });

  it('creates the file and persists the entry when no file exists yet for that repository', async () => {
    const repository = new FileSystemDailySecurityScanRunLogRepository(
      temporaryDirectory,
    );
    const entry = buildEntry();

    await repository.append(entry);

    expect(readStored('app')).toEqual([entry]);
  });

  it('creates the base directory first when it does not exist yet', async () => {
    const baseDirectory = path.join(temporaryDirectory, 'nested', 'logs');
    const repository = new FileSystemDailySecurityScanRunLogRepository(
      baseDirectory,
    );
    const entry = buildEntry();

    await repository.append(entry);

    const stored: unknown = JSON.parse(
      fs.readFileSync(path.join(baseDirectory, 'app.json'), 'utf8'),
    );
    expect(stored).toEqual([entry]);
  });

  it('appends to a file that already has entries, keeping the previous ones', async () => {
    const repository = new FileSystemDailySecurityScanRunLogRepository(
      temporaryDirectory,
    );
    const first = buildEntry({ executedAtIso: '2024-01-01T00:00:00.000Z' });
    const second = buildEntry({ executedAtIso: '2024-01-02T00:00:00.000Z' });

    await repository.append(first);
    await repository.append(second);

    expect(readStored('app')).toEqual([first, second]);
  });

  it('writes entries for different repositories to separate files', async () => {
    const repository = new FileSystemDailySecurityScanRunLogRepository(
      temporaryDirectory,
    );
    const appEntry = buildEntry({ repositoryName: 'app' });
    const apiEntry = buildEntry({ repositoryName: 'api' });

    await repository.append(appEntry);
    await repository.append(apiEntry);

    expect(readStored('app')).toEqual([appEntry]);
    expect(readStored('api')).toEqual([apiEntry]);
  });

  it('keeps only the most recent 30 entries, discarding the oldest, when a 31st is appended', async () => {
    const repository = new FileSystemDailySecurityScanRunLogRepository(
      temporaryDirectory,
    );
    const entryAt = (index: number): DailySecurityScanRunLogEntry => ({
      repositoryName: 'app',
      executedAtIso: '2024-01-01T00:00:00.000Z',
      outcome: { type: 'checkoutFailed', reason: `entry-${index}` },
    });

    for (let index = 1; index <= 31; index += 1) {
      await repository.append(entryAt(index));
    }

    const stored = readStored('app');
    if (!isUnknownArray(stored)) {
      throw new Error('expected the stored run log to be an array');
    }
    expect(stored).toHaveLength(30);
    expect(stored[0]).toEqual(entryAt(2));
    expect(stored[stored.length - 1]).toEqual(entryAt(31));
  });

  it.each([
    { description: 'syntactically invalid JSON', storedContent: 'not json' },
    {
      description: 'valid JSON that is not an array',
      storedContent: JSON.stringify({ not: 'an array' }),
    },
  ])(
    'treats the file as empty rather than crashing when it contains $description',
    async ({ storedContent }) => {
      fs.writeFileSync(filePathFor('app'), storedContent);
      const repository = new FileSystemDailySecurityScanRunLogRepository(
        temporaryDirectory,
      );
      const entry = buildEntry();

      await repository.append(entry);

      expect(readStored('app')).toEqual([entry]);
    },
  );

  it.each([
    {
      description: 'checkoutFailed',
      outcome: { type: 'checkoutFailed' as const, reason: 'clone timed out' },
    },
    {
      description: 'scanCompletedClean',
      outcome: {
        type: 'scanCompletedClean' as const,
        clonedCommitSha: 'deadbeef',
      },
    },
    {
      description: 'scanCompletedWithVulnerabilities',
      outcome: {
        type: 'scanCompletedWithVulnerabilities' as const,
        clonedCommitSha: 'deadbeef',
        vulnerablePackageCount: 2,
      },
    },
    {
      description: 'scanFailed',
      outcome: {
        type: 'scanFailed' as const,
        clonedCommitSha: 'deadbeef',
        exitCode: 2,
        stderr: 'osv-scanner crashed',
      },
    },
  ])(
    'writes a file whose contents are valid JSON matching the entity shape for the $description outcome',
    async ({ outcome }) => {
      const repository = new FileSystemDailySecurityScanRunLogRepository(
        temporaryDirectory,
      );
      const entry: DailySecurityScanRunLogEntry = {
        repositoryName: 'app',
        executedAtIso: '2024-02-02T03:04:05.000Z',
        outcome,
      };

      await repository.append(entry);

      const raw = fs.readFileSync(filePathFor('app'), 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!isUnknownArray(parsed)) {
        throw new Error('expected the stored run log to be an array');
      }
      expect(parsed).toEqual([entry]);
      const [storedEntry] = parsed;
      if (!isRecord(storedEntry) || !isRecord(storedEntry.outcome)) {
        throw new Error(
          'expected the stored entry to be an object with an outcome',
        );
      }
      expect(typeof storedEntry.repositoryName).toBe('string');
      expect(typeof storedEntry.executedAtIso).toBe('string');
      expect(storedEntry.outcome.type).toBe(outcome.type);
    },
  );
});
