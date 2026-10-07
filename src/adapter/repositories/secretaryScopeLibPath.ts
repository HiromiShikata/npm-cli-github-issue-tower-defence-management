import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const secretaryScopeLibPath = (): string | null => {
  const explicitPath = process.env.CL_SCOPE_LIB_PATH;
  if (explicitPath !== undefined && fs.existsSync(explicitPath)) {
    return explicitPath;
  }
  const defaultPath = path.join(
    os.homedir(),
    'git',
    'secretary',
    'machine',
    'sk',
    'sh',
    'cl-scope-lib.sh',
  );
  return fs.existsSync(defaultPath) ? defaultPath : null;
};
