import { fileStatusBadge } from '../../logic/fileStatus';
import type { ConsoleChangedFile } from '../../logic/types';

export type ConsoleChangedFileListProps = {
  files: ConsoleChangedFile[];
  isLoading: boolean;
  error: string | null;
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
      {files.map((file) => {
        const badge = fileStatusBadge(file.status);
        return (
          <li key={file.path} className="console-file">
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
          </li>
        );
      })}
    </ul>
  );
};
