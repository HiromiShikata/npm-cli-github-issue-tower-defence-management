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

export const loadTokens = (jsonPath: string): string[] | null => {
  const resolved = expandHome(jsonPath);
  if (!fs.existsSync(resolved)) return null;
  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const tokens: string[] = [];
    for (const entry of parsed) {
      if (isRecord(entry) && typeof entry.token === 'string') {
        tokens.push(entry.token);
      }
    }
    return tokens.length > 0 ? tokens : null;
  } catch {
    return null;
  }
};
