import * as fs from 'fs';
import * as path from 'path';
import {
  TokenExhaustionHandoverState,
  TokenExhaustionHandoverStateEntry,
} from '../../domain/entities/TokenExhaustionHandoverState';
import { TokenExhaustionHandoverStateRepository } from '../../domain/usecases/adapter-interfaces/TokenExhaustionHandoverStateRepository';
import { tdpmCacheDirectory } from './localStorageCacheDirectory';

export const defaultHandoverStateFilePath = (): string =>
  path.join(
    tdpmCacheDirectory(),
    'token-exhaustion-handover-state-tdpm-native.json',
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export class FileHandoverStateRepository implements TokenExhaustionHandoverStateRepository {
  constructor(
    private readonly filePath: string = defaultHandoverStateFilePath(),
  ) {}

  load = (): TokenExhaustionHandoverState => {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, 'utf8');
    } catch {
      return { entries: {} };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { entries: {} };
    }
    return { entries: this.parseEntries(parsed) };
  };

  save = (state: TokenExhaustionHandoverState): void => {
    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(state));
    fs.renameSync(temporaryPath, this.filePath);
  };

  private parseEntries = (
    parsed: unknown,
  ): Record<string, TokenExhaustionHandoverStateEntry> => {
    const entries: Record<string, TokenExhaustionHandoverStateEntry> = {};
    if (!isRecord(parsed)) {
      return entries;
    }
    const stored = parsed.entries;
    if (!isRecord(stored)) {
      return entries;
    }
    for (const [key, value] of Object.entries(stored)) {
      if (!isRecord(value)) {
        continue;
      }
      const signaledAtEpoch = value.signaledAtEpoch;
      const pid = value.pid;
      if (typeof signaledAtEpoch === 'number' && typeof pid === 'number') {
        entries[key] = { signaledAtEpoch, pid };
      }
    }
    return entries;
  };
}
