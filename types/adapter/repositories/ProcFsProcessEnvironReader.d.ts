import { ProcessEnvironReader } from '../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
/**
 * Reads a process environment from the Linux procfs (`/proc/<pid>/environ`),
 * where entries are NUL-separated `KEY=value` pairs. Returns null when the
 * environment cannot be read (the process has exited or is not accessible).
 */
export declare class ProcFsProcessEnvironReader implements ProcessEnvironReader {
    private readonly procDirectory;
    constructor(procDirectory?: string);
    readEnviron: (pid: number) => Record<string, string> | null;
}
//# sourceMappingURL=ProcFsProcessEnvironReader.d.ts.map