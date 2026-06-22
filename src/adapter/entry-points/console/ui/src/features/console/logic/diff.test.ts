import { parseUnifiedDiff } from './diff';

describe('parseUnifiedDiff', () => {
  it('marks a hunk header with no line numbers', () => {
    const rows = parseUnifiedDiff('@@ -54,7 +54,12 @@ jobs:');
    expect(rows).toEqual([
      {
        kind: 'hunk',
        oldLineNumber: null,
        newLineNumber: null,
        content: '@@ -54,7 +54,12 @@ jobs:',
      },
    ]);
  });

  it('numbers context lines on both sides starting from the hunk header', () => {
    const rows = parseUnifiedDiff(
      ['@@ -10,2 +20,2 @@', ' context one', ' context two'].join('\n'),
    );
    expect(rows[1]).toEqual({
      kind: 'ctx',
      oldLineNumber: 10,
      newLineNumber: 20,
      content: ' context one',
    });
    expect(rows[2]).toEqual({
      kind: 'ctx',
      oldLineNumber: 11,
      newLineNumber: 21,
      content: ' context two',
    });
  });

  it('numbers added lines only on the new side', () => {
    const rows = parseUnifiedDiff(
      ['@@ -1,1 +1,2 @@', ' kept', '+added line'].join('\n'),
    );
    expect(rows[2]).toEqual({
      kind: 'add',
      oldLineNumber: null,
      newLineNumber: 2,
      content: '+added line',
    });
  });

  it('numbers removed lines only on the old side', () => {
    const rows = parseUnifiedDiff(
      ['@@ -1,2 +1,1 @@', ' kept', '-removed line'].join('\n'),
    );
    expect(rows[2]).toEqual({
      kind: 'del',
      oldLineNumber: 2,
      newLineNumber: null,
      content: '-removed line',
    });
  });

  it('keeps the old and new counters independent across a mixed hunk', () => {
    const rows = parseUnifiedDiff(
      [
        '@@ -54,7 +54,12 @@ jobs:',
        ' loose-matching: true',
        '-          npm install',
        '+          npm ci',
        '+          npm run build',
        ' after',
      ].join('\n'),
    );
    expect(rows.map((row) => row.kind)).toEqual([
      'hunk',
      'ctx',
      'del',
      'add',
      'add',
      'ctx',
    ]);
    const lastContext = rows[5];
    expect(lastContext.oldLineNumber).toBe(56);
    expect(lastContext.newLineNumber).toBe(57);
  });
});
