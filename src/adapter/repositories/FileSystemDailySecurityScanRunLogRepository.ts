import * as fs from 'fs';
import * as path from 'path';
import { DailySecurityScanRunLogEntry } from '../../domain/entities/DailySecurityScanRunLogEntry';
import { DailySecurityScanRunLogRepository } from '../../domain/usecases/adapter-interfaces/DailySecurityScanRunLogRepository';
import { isRecord } from '../../domain/usecases/isRecord';
import { tdpmCacheDirectory } from './localStorageCacheDirectory';

const MAX_RETAINED_RUN_LOG_ENTRIES = 30;

const errorCode = (error: unknown): string | null => {
  if (!isRecord(error)) {
    return null;
  }
  const code = error.code;
  return typeof code === 'string' ? code : null;
};

const isDailySecurityScanRunLogEntryOutcome = (
  value: unknown,
): value is DailySecurityScanRunLogEntry['outcome'] =>
  isRecord(value) && typeof value.type === 'string';

const isDailySecurityScanRunLogEntry = (
  value: unknown,
): value is DailySecurityScanRunLogEntry =>
  isRecord(value) &&
  typeof value.repositoryName === 'string' &&
  typeof value.executedAtIso === 'string' &&
  isDailySecurityScanRunLogEntryOutcome(value.outcome);

export const defaultDailySecurityScanRunLogDirectory = (): string =>
  path.join(tdpmCacheDirectory(), 'daily-security-scan-run-log');

export class FileSystemDailySecurityScanRunLogRepository implements DailySecurityScanRunLogRepository {
  constructor(
    private readonly baseDirectory: string = defaultDailySecurityScanRunLogDirectory(),
  ) {}

  append = async (entry: DailySecurityScanRunLogEntry): Promise<void> => {
    const filePath = this.filePathFor(entry.repositoryName);
    const existingEntries = this.readExistingEntries(filePath);
    const updatedEntries = [...existingEntries, entry].slice(
      -MAX_RETAINED_RUN_LOG_ENTRIES,
    );

    fs.mkdirSync(this.baseDirectory, { recursive: true });
    const temporaryFilePath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryFilePath, JSON.stringify(updatedEntries));
    fs.renameSync(temporaryFilePath, filePath);
  };

  private filePathFor = (repositoryName: string): string =>
    path.join(this.baseDirectory, `${repositoryName}.json`);

  private readExistingEntries = (
    filePath: string,
  ): DailySecurityScanRunLogEntry[] => {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        return [];
      }
      console.error(
        `Unable to read the daily security scan run log at ${filePath}: ${String(error)}. Treating it as empty so the new entry is still recorded.`,
      );
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error(
        `The daily security scan run log at ${filePath} does not contain valid JSON (${String(error)}). Treating it as empty so the new entry is still recorded.`,
      );
      return [];
    }

    if (!Array.isArray(parsed)) {
      console.error(
        `The daily security scan run log at ${filePath} does not contain a JSON array. Treating it as empty so the new entry is still recorded.`,
      );
      return [];
    }

    const validEntries = parsed.filter(isDailySecurityScanRunLogEntry);
    if (validEntries.length !== parsed.length) {
      console.error(
        `The daily security scan run log at ${filePath} contains ${parsed.length - validEntries.length} entry(ies) that do not match the expected shape. They are dropped so the new entry is still recorded.`,
      );
    }
    return validEntries;
  };
}
