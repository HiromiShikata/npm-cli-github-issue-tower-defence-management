export interface ProcessEnvironReader {
  readEnviron: (pid: number) => Record<string, string> | null;
}
