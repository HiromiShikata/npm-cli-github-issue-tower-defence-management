import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const expandHome = (filePath: string): string => {
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

const isErrorWithCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === code;

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type JsonParseResult =
  | { type: 'parsed'; value: unknown }
  | { type: 'error'; name: string; position: string | null };

const parseJson = (raw: string): JsonParseResult => {
  try {
    return { type: 'parsed', value: JSON.parse(raw) };
  } catch (error) {
    return {
      type: 'error',
      name: error instanceof Error ? error.name : 'SyntaxError',
      position:
        error instanceof Error
          ? (error.message.match(/position (\d+)/)?.[1] ?? null)
          : null,
    };
  }
};

export const loadTokenEntries = (jsonPath: string): TokenEntry[] | null => {
  const resolved = expandHome(jsonPath);
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, 'utf8');
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) return null;
    throw new Error(
      `Could not read token list file ${resolved}: ${errorMessageOf(error)}`,
      { cause: error },
    );
  }

  const parseResult = parseJson(raw);
  if (parseResult.type === 'error') {
    const positionDescription =
      parseResult.position === null
        ? ''
        : ` at position ${parseResult.position}`;
    throw new Error(
      `Token list file ${resolved} is not valid JSON (${parseResult.name}${positionDescription})`,
    );
  }
  const parsed = parseResult.value;
  if (!Array.isArray(parsed)) {
    throw new Error(`Token list file ${resolved} must have a JSON array root`);
  }
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
};

export const loadTokens = (jsonPath: string): string[] | null => {
  const entries = loadTokenEntries(jsonPath);
  if (entries === null) return null;
  return entries.map((e) => e.token);
};
