import { useState } from 'react';

export type ConsoleRareActionsProps = {
  onSetDependedIssueUrl: ((url: string) => Promise<void>) | null;
};

export const ConsoleRareActions = ({
  onSetDependedIssueUrl,
}: ConsoleRareActionsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [dependedIssueUrl, setDependedIssueUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
    setError(null);
  };

  const handleSubmit = async () => {
    if (onSetDependedIssueUrl === null || dependedIssueUrl.trim() === '') {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSetDependedIssueUrl(dependedIssueUrl.trim());
      setDependedIssueUrl('');
      setExpanded(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to set depended issue URL',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="console-op-group console-op-group-rare-actions">
      <button
        type="button"
        className="console-op-button"
        onClick={handleToggle}
        title="Rare actions"
      >
        ⋯
      </button>
      {expanded && onSetDependedIssueUrl !== null && (
        <>
          <input
            type="url"
            className="console-settings-modal-input"
            placeholder="Depended issue URL"
            value={dependedIssueUrl}
            onChange={(e) => setDependedIssueUrl(e.target.value)}
            disabled={submitting}
          />
          <button
            type="button"
            className="console-op-button"
            onClick={handleSubmit}
            disabled={submitting || dependedIssueUrl.trim() === ''}
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
