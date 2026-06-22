export type ConsoleDiffLineKind = 'hunk' | 'add' | 'del' | 'ctx';

export type ConsoleDiffLine = {
  kind: ConsoleDiffLineKind;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
};

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export const parseUnifiedDiff = (patch: string): ConsoleDiffLine[] => {
  const rows: ConsoleDiffLine[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      const match = line.match(HUNK_HEADER);
      if (match !== null) {
        oldLineNumber = Number(match[1]);
        newLineNumber = Number(match[2]);
      }
      rows.push({
        kind: 'hunk',
        oldLineNumber: null,
        newLineNumber: null,
        content: line,
      });
      continue;
    }
    if (line.startsWith('+')) {
      rows.push({
        kind: 'add',
        oldLineNumber: null,
        newLineNumber: newLineNumber,
        content: line,
      });
      newLineNumber += 1;
      continue;
    }
    if (line.startsWith('-')) {
      rows.push({
        kind: 'del',
        oldLineNumber: oldLineNumber,
        newLineNumber: null,
        content: line,
      });
      oldLineNumber += 1;
      continue;
    }
    rows.push({
      kind: 'ctx',
      oldLineNumber: oldLineNumber,
      newLineNumber: newLineNumber,
      content: line,
    });
    oldLineNumber += 1;
    newLineNumber += 1;
  }
  return rows;
};
