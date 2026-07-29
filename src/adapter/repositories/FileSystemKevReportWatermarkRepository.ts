import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KevReportWatermark } from '../../domain/entities/KevReportWatermark';
import {
  KevReportWatermarkLoadResult,
  KevReportWatermarkRepository,
} from '../../domain/usecases/adapter-interfaces/KevReportWatermarkRepository';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const errorCode = (error: unknown): string | null => {
  if (!isRecord(error)) {
    return null;
  }
  const code = error.code;
  return typeof code === 'string' ? code : null;
};

const isCalendarYmd = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const defaultStateFilePath = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'kev-report-watermark.json');
};

export class FileSystemKevReportWatermarkRepository implements KevReportWatermarkRepository {
  constructor(
    private readonly stateFilePath: string = defaultStateFilePath(),
  ) {}

  load = async (): Promise<KevReportWatermarkLoadResult> => {
    let raw: string;
    try {
      raw = fs.readFileSync(this.stateFilePath, 'utf8');
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        return { type: 'absent' };
      }
      return this.unreadable(
        `the stored watermark file could not be read (${String(error)})`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return this.unreadable(
        `the stored watermark file does not contain valid JSON (${String(error)})`,
      );
    }

    if (!isRecord(parsed)) {
      return this.unreadable(
        'the stored watermark file does not contain a JSON object',
      );
    }

    const lastReportedDateAdded = parsed.lastReportedDateAdded;
    if (typeof lastReportedDateAdded !== 'string') {
      return this.unreadable(
        `the stored lastReportedDateAdded is not a string (${JSON.stringify(lastReportedDateAdded)})`,
      );
    }
    if (!isCalendarYmd(lastReportedDateAdded)) {
      return this.unreadable(
        `the stored lastReportedDateAdded is not a calendar date in YYYY-MM-DD form (${JSON.stringify(lastReportedDateAdded)})`,
      );
    }

    const reportedCveIdsOnLastReportedDateAdded =
      parsed.reportedCveIdsOnLastReportedDateAdded;
    if (!Array.isArray(reportedCveIdsOnLastReportedDateAdded)) {
      return this.unreadable(
        'the stored reportedCveIdsOnLastReportedDateAdded is not an array',
      );
    }
    if (
      !reportedCveIdsOnLastReportedDateAdded.every(
        (cveId) => typeof cveId === 'string',
      )
    ) {
      return this.unreadable(
        'the stored reportedCveIdsOnLastReportedDateAdded contains a non-string entry',
      );
    }

    return {
      type: 'stored',
      watermark: {
        lastReportedDateAdded,
        reportedCveIdsOnLastReportedDateAdded:
          reportedCveIdsOnLastReportedDateAdded,
      },
    };
  };

  save = async (watermark: KevReportWatermark): Promise<void> => {
    try {
      const directory = path.dirname(this.stateFilePath);
      fs.mkdirSync(directory, { recursive: true });
      const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify(watermark));
      fs.renameSync(temporaryPath, this.stateFilePath);
    } catch (error) {
      console.error(
        `Unable to write the KEV report watermark to ${this.stateFilePath}: ${String(error)}`,
      );
      throw error;
    }
  };

  private unreadable = (reason: string): KevReportWatermarkLoadResult => {
    console.error(
      `Unable to use the KEV report watermark stored at ${this.stateFilePath}: ${reason}. The file is left untouched for inspection.`,
    );
    return { type: 'unreadable', reason };
  };
}
