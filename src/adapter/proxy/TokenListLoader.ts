import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const expandHome = (filePath: string): string => {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath === '~') {
    return os.homedir();
  }
  return filePath;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export type TokenEntry = {
  name: string;
  token: string;
  selectionWeight?: number;
};

const parseSelectionWeight = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const buildTokenEntry = (
  name: string,
  token: string,
  selectionWeight: number | null,
): TokenEntry =>
  selectionWeight === null ? { name, token } : { name, token, selectionWeight };

export const loadTokenEntries = (jsonPath: string): TokenEntry[] | null => {
  const resolved = expandHome(jsonPath);
  if (!fs.existsSync(resolved)) return null;
  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const entries: TokenEntry[] = [];
    for (const entry of parsed) {
      if (
        isRecord(entry) &&
        typeof entry.token === 'string' &&
        typeof entry.name === 'string'
      ) {
        entries.push(
          buildTokenEntry(
            entry.name,
            entry.token,
            parseSelectionWeight(entry.selectionWeight),
          ),
        );
      } else if (isRecord(entry) && typeof entry.token === 'string') {
        entries.push(
          buildTokenEntry(
            `token-${entries.length + 1}`,
            entry.token,
            parseSelectionWeight(entry.selectionWeight),
          ),
        );
      }
    }
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
};

export const loadTokens = (jsonPath: string): string[] | null => {
  const entries = loadTokenEntries(jsonPath);
  if (entries === null) return null;
  return entries.map((e) => e.token);
};
