import * as fs from 'fs';
import * as path from 'path';
import { ProcessEnvironReader } from '../../domain/usecases/adapter-interfaces/ProcessEnvironReader';

/**
 * Reads a process environment from the Linux procfs (`/proc/<pid>/environ`),
 * where entries are NUL-separated `KEY=value` pairs. Returns null when the
 * environment cannot be read (the process has exited or is not accessible).
 */
export class ProcFsProcessEnvironReader implements ProcessEnvironReader {
  constructor(private readonly procDirectory: string = '/proc') {}

  readEnviron = (pid: number): Record<string, string> | null => {
    let raw: string;
    try {
      raw = fs.readFileSync(
        path.join(this.procDirectory, String(pid), 'environ'),
        'utf8',
      );
    } catch {
      return null;
    }
    const environ: Record<string, string> = {};
    for (const entry of raw.split('\0')) {
      if (entry.length === 0) {
        continue;
      }
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }
      const key = entry.slice(0, separatorIndex);
      const value = entry.slice(separatorIndex + 1);
      environ[key] = value;
    }
    return environ;
  };
}
