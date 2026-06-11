import React from 'react';
import { useState } from 'react';
import { html as diff2htmlHtml } from 'diff2html';
import type { PrFile } from '../api/types';
import type { DiffLineComment } from '../api/types';

type DiffViewProps = {
  files: PrFile[];
  headSha: string;
  repo: string;
  inlineComments: DiffLineComment[];
  onAddComment: (comment: DiffLineComment) => void;
};

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];

const getProjectCode = (): string => {
  const match = window.location.pathname.match(/\/projects\/([^/]+)\/prs/);
  return match ? match[1] : '';
};

const isImageFile = (filename: string): boolean =>
  IMAGE_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));

const isVideoFile = (filename: string): boolean =>
  VIDEO_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));

const buildRawUrl = (repo: string, headSha: string, filename: string): string => {
  const [owner, repoName] = repo.split('/');
  const projectCode = getProjectCode();
  return `/projects/${projectCode}/blob/${owner}/${repoName}/${headSha}/${filename}`;
};

type FileEntryProps = {
  file: PrFile;
  headSha: string;
  repo: string;
  fileComments: DiffLineComment[];
  onAddComment: (comment: DiffLineComment) => void;
};

const FileEntry = ({ file, headSha, repo, fileComments, onAddComment }: FileEntryProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState('');

  const rawUrl = buildRawUrl(repo, headSha, file.filename);

  const handleAddComment = (): void => {
    if (commentLine !== null && commentBody.trim()) {
      onAddComment({ filename: file.filename, line: commentLine, body: commentBody.trim() });
      setCommentBody('');
      setCommentLine(null);
    }
  };

  const renderMediaContent = (): React.JSX.Element => {
    if (isImageFile(file.filename)) {
      return <img src={rawUrl} alt={file.filename} style={{ maxWidth: '100%' }} />;
    }
    if (isVideoFile(file.filename)) {
      return <video src={rawUrl} controls style={{ maxWidth: '100%' }} />;
    }
    return <span />;
  };

  const isMedia = isImageFile(file.filename) || isVideoFile(file.filename);

  const diffHtml = !isMedia && file.patch
    ? diff2htmlHtml(
        `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`,
        { drawFileList: false, matching: 'lines', outputFormat: 'line-by-line' },
      )
    : '';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '0.5rem', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f9fafb', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem' }}
      >
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{file.filename}</span>
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
          <span style={{ color: '#22c55e' }}>+{file.additions}</span>{' '}
          <span style={{ color: '#ef4444' }}>-{file.deletions}</span>
          {' '}{expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div>
          {isMedia ? (
            <div style={{ padding: '1rem' }}>{renderMediaContent()}</div>
          ) : (
            <div>
              {file.patch ? (
                <div
                  className="diff-container"
                  dangerouslySetInnerHTML={{ __html: diffHtml }}
                  style={{ overflow: 'auto', fontSize: '0.8125rem' }}
                />
              ) : (
                <div style={{ padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>Binary file or no diff available</div>
              )}

              {fileComments.length > 0 && (
                <div style={{ padding: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                  {fileComments.map((comment, index) => (
                    <div key={index} style={{ padding: '0.25rem 0.5rem', background: '#fef3c7', borderRadius: '4px', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                      <span style={{ color: '#92400e', fontWeight: 500 }}>Line {comment.line}: </span>
                      {comment.body}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: '0.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <input
                  type="number"
                  placeholder="Line"
                  value={commentLine ?? ''}
                  onChange={(e) => setCommentLine(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '4rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
                />
                <input
                  type="text"
                  placeholder="Add inline comment..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  style={{ flex: 1, padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!commentLine || !commentBody.trim()}
                  style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const DiffView = ({ files, headSha, repo, inlineComments, onAddComment }: DiffViewProps): React.JSX.Element => (
  <div>
    {files.map((file) => (
      <FileEntry
        key={file.filename}
        file={file}
        headSha={headSha}
        repo={repo}
        fileComments={inlineComments.filter((c) => c.filename === file.filename)}
        onAddComment={onAddComment}
      />
    ))}
  </div>
);
