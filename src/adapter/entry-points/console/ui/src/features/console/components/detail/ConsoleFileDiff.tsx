import { parseUnifiedDiff } from '../../logic/diff';

export type ConsoleFileDiffProps = {
  patch: string | null;
};

export const ConsoleFileDiff = ({ patch }: ConsoleFileDiffProps) => {
  if (patch === null || patch === '') {
    return (
      <p className="console-file-diff-empty">(no diff / binary or too large)</p>
    );
  }
  const rows = parseUnifiedDiff(patch);
  return (
    <table className="console-file-diff">
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.kind}:${row.oldLineNumber ?? 'x'}:${row.newLineNumber ?? 'x'}:${row.content}`}
            className={`console-diff-row console-diff-${row.kind}`}
          >
            <td className="console-diff-ln">{row.oldLineNumber ?? ''}</td>
            <td className="console-diff-ln">{row.newLineNumber ?? ''}</td>
            <td className="console-diff-code">{row.content}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
