import { useState } from 'react';
import { parseDependedIssueUrlsInput } from '../../logic/consoleStoryTaskPatch';

export type ConsoleRareActionsProps = {
  dependedIssueUrls: readonly string[];
  onReplaceDependedIssueUrls:
    ((urls: readonly string[]) => Promise<void>) | null;
};

const dependedIssueUrlsToText = (urls: readonly string[]): string =>
  urls.join('\n');

export const ConsoleRareActions = ({
  dependedIssueUrls,
  onReplaceDependedIssueUrls,
}: ConsoleRareActionsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [dependedIssueUrlsText, setDependedIssueUrlsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    if (!expanded) {
      setDependedIssueUrlsText(dependedIssueUrlsToText(dependedIssueUrls));
    }
    setExpanded((prev) => !prev);
    setError(null);
  };

  const handleSubmit = async () => {
    if (onReplaceDependedIssueUrls === null) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onReplaceDependedIssueUrls(
        parseDependedIssueUrlsInput(dependedIssueUrlsText),
      );
      setExpanded(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to set depended issue URL',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const groupClassName = expanded
    ? 'console-op-group console-op-group-rare-actions console-op-group-rare-actions-expanded'
    : 'console-op-group console-op-group-rare-actions';

  return (
    <div className={groupClassName}>
      <button
        type="button"
        className="console-op-button"
        onClick={handleToggle}
        title="Rare actions"
      >
        ⋯
      </button>
      {expanded && onReplaceDependedIssueUrls !== null && (
        <>
          <textarea
            className="console-rare-actions-textarea"
            placeholder="Depended issue URL"
            value={dependedIssueUrlsText}
            onChange={(e) => setDependedIssueUrlsText(e.target.value)}
            disabled={submitting}
            rows={4}
          />
          <button
            type="button"
            className="console-op-button"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '...' : 'Set Depended Issue'}
          </button>
        </>
      )}
      {error !== null && (
        <p className="console-settings-modal-error">{error}</p>
      )}
    </div>
  );
};
