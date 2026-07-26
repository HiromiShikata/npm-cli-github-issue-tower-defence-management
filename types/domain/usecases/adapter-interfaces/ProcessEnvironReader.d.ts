export interface ProcessEnvironReader {
    readEnviron: (pid: number) => Record<string, string> | null;
}
//# sourceMappingURL=ProcessEnvironReader.d.ts.map