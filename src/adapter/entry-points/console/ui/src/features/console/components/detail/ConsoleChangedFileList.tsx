import { useState } from 'react';
import { fileStatusBadge } from '../../logic/fileStatus';
import {
  buildConsoleFileTree,
  type ConsoleFileTreeNode,
} from '../../logic/fileTree';
import type { ConsoleChangedFile } from '../../logic/types';
import {
  type ConsoleAddInlineComment,
  ConsoleFileDiff,
} from './ConsoleFileDiff';

export type ConsoleChangedFileListProps = {
  files: ConsoleChangedFile[];
  isLoading: boolean;
  error: string | null;
  onAddInlineComment?: ConsoleAddInlineComment;
};

const indentStyle = (depth: number): { paddingLeft: string } => ({
  paddingLeft: `${depth * 16}px`,
});

const ConsoleChangedFileRow = ({
  file,
  depth,
  name,
  onAddInlineComment,
}: {
  file: ConsoleChangedFile;
  depth: number;
  name: string;
  onAddInlineComment?: ConsoleAddInlineComment;
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const badge = fileStatusBadge(file.status);
  return (
    <li className="console-file">
      <button
        type="button"
        className="console-file-row"
        style={indentStyle(depth)}
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
        <span className="console-file-path">{name}</span>
        <span className="console-file-stat console-file-add">
          +{file.additions}
        </span>
        <span className="console-file-stat console-file-del">
          -{file.deletions}
        </span>
      </button>
      {expanded && (
        <ConsoleFileDiff
          patch={file.patch}
          path={file.path}
          onAddInlineComment={onAddInlineComment}
        />
      )}
    </li>
  );
};

const ConsoleChangedFileTreeNode = ({
  node,
  depth,
  onAddInlineComment,
}: {
  node: ConsoleFileTreeNode;
  depth: number;
  onAddInlineComment?: ConsoleAddInlineComment;
}) => {
  if (node.kind === 'file') {
    return (
      <ConsoleChangedFileRow
        file={node.file}
        depth={depth}
        name={node.name}
        onAddInlineComment={onAddInlineComment}
      />
    );
  }
  return (
    <li className="console-file-tree-dir">
      <div className="console-file-tree-dir-name" style={indentStyle(depth)}>
        <span className="console-file-tree-dir-icon" aria-hidden="true">
          📁
        </span>
        {node.name}
      </div>
      <ul className="console-file-tree-children">
        {node.children.map((child) => (
          <ConsoleChangedFileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onAddInlineComment={onAddInlineComment}
          />
        ))}
      </ul>
    </li>
  );
};

export const ConsoleChangedFileList = ({
  files,
  isLoading,
  error,
  onAddInlineComment,
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

  const tree = buildConsoleFileTree(files);

  return (
    <ul className="console-files console-file-tree">
      {tree.map((node) => (
        <ConsoleChangedFileTreeNode
          key={node.path}
          node={node}
          depth={0}
          onAddInlineComment={onAddInlineComment}
        />
      ))}
    </ul>
  );
};
