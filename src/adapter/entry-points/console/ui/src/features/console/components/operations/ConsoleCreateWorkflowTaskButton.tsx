import { useState } from 'react';

export type ConsoleCreateWorkflowTaskButtonProps = {
  onCreateWorkflowTask: (title: string) => Promise<string>;
};

export const ConsoleCreateWorkflowTaskButton = ({
  onCreateWorkflowTask,
}: ConsoleCreateWorkflowTaskButtonProps) => {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
    setError(null);
  };

  const handleSubmit = async () => {
    if (title.trim() === '') {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreateWorkflowTask(title.trim());
      setTitle('');
      setExpanded(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create workflow task',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && title.trim() !== '' && !submitting) {
      void handleSubmit();
    }
  };

  return (
    <div className="console-op-group console-op-group-create-workflow-task">
      <button
        type="button"
        className="console-tab-settings-button"
        onClick={handleToggle}
        title="Create workflow improvement task"
        aria-label="Create workflow improvement task"
      >
        ⬆
      </button>
      {expanded && (
        <>
          <input
            type="text"
            className="console-settings-modal-input"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            autoFocus
          />
          <button
            type="button"
            className="console-op-button"
            onClick={() => void handleSubmit()}
            disabled={submitting || title.trim() === ''}
          >
            {submitting ? '...' : 'Create'}
          </button>
        </>
      )}
      {error !== null && (
        <p className="console-settings-modal-error">{error}</p>
      )}
    </div>
  );
};
