import { useState } from 'react';
import { fileStatusBadge } from '../../logic/fileStatus';
import type { ConsoleChangedFile } from '../../logic/types';
import { ConsoleFileDiff } from './ConsoleFileDiff';

export type ConsoleChangedFileListProps = {
  files: ConsoleChangedFile[];
  isLoading: boolean;
  error: string | null;
};

const ConsoleChangedFileRow = ({ file }: { file: ConsoleChangedFile }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const badge = fileStatusBadge(file.status);
  return (
    <li className="console-file">
      <button
        type="button"
        className="console-file-row"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="console-file-caret">{expanded ? '▾' : '▸'}</span>
        <span
          className="console-file-badge"
          style={{ color: badge.color, borderColor: badge.color }}
        >
          {badge.label}
        </span>
        <span className="console-file-path">{file.path}</span>
        <span className="console-file-stat console-file-add">
          +{file.additions}
        </span>
        <span className="console-file-stat console-file-del">
          -{file.deletions}
        </span>
      </button>
      {expanded && <ConsoleFileDiff patch={file.patch} />}
    </li>
  );
};

export const ConsoleChangedFileList = ({
  files,
  isLoading,
  error,
}: ConsoleChangedFileListProps) => {
  if (error !== null) {
    return (
      <p role="alert" className="console-files-error">
        Failed to load changed files: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="console-files-loading">Loading changed files...</p>;
  }

  if (files.length === 0) {
    return <p className="console-files-empty">No changed files.</p>;
  }

  return (
    <ul className="console-files">
      {files.map((file) => (
        <ConsoleChangedFileRow key={file.path} file={file} />
      ))}
    </ul>
  );
};
