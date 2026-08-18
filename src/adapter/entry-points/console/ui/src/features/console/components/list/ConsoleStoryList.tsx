import { useState } from 'react';
import { colorFromEnum } from '../../logic/colors';
import type { ConsoleStoryEntry } from '../../logic/types';

export type ConsoleStoryListProps = {
  stories: ConsoleStoryEntry[];
  isLoading: boolean;
  error: string | null;
  onCreateIssue: (storyOptionId: string, title: string) => Promise<void>;
};

export const ConsoleStoryList = ({
  stories,
  isLoading,
  error,
  onCreateIssue,
}: ConsoleStoryListProps) => {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (error !== null) {
    return (
      <p role="alert" className="console-list-message console-list-error">
        Failed to load stories: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="console-list-message">Loading stories...</p>;
  }

  if (stories.length === 0) {
    return <p className="console-list-empty">No active stories</p>;
  }

  const handleAddClick = (storyOptionId: string): void => {
    if (expandedOptionId === storyOptionId) {
      setExpandedOptionId(null);
      setTitleInput('');
      setSubmitError(null);
    } else {
      setExpandedOptionId(storyOptionId);
      setTitleInput('');
      setSubmitError(null);
    }
  };

  const handleSubmit = async (storyOptionId: string): Promise<void> => {
    const trimmed = titleInput.trim();
    if (trimmed.length === 0) {
      setSubmitError('Title is required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreateIssue(storyOptionId, trimmed);
      setExpandedOptionId(null);
      setTitleInput('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ul className="console-story-list">
      {stories.map((entry) => {
        const palette = colorFromEnum(entry.color);
        const isExpanded = expandedOptionId === entry.storyOptionId;
        return (
          <li key={entry.storyOptionId} className="console-story-list-row">
            <div className="console-story-list-row-main">
              <span
                className="console-storytag"
                style={{ color: palette.fg, borderColor: palette.border }}
              >
                <span
                  className="console-story-dot"
                  style={{ backgroundColor: palette.dot }}
                />
                {entry.storyName}
              </span>
              <span className="console-story-count">{entry.openItemCount}</span>
              <button
                type="button"
                className="console-op-button"
                onClick={() => handleAddClick(entry.storyOptionId)}
              >
                Add task
              </button>
            </div>
            {isExpanded && (
              <form
                className="console-story-create-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit(entry.storyOptionId);
                }}
              >
                <input
                  type="text"
                  className="console-story-create-input"
                  placeholder="Issue title"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
                <button
                  type="submit"
                  className="console-op-button"
                  disabled={submitting}
                >
                  {submitting ? 'Creating…' : 'Create'}
                </button>
                <button
                  type="button"
                  className="console-op-button"
                  onClick={() => {
                    setExpandedOptionId(null);
                    setTitleInput('');
                    setSubmitError(null);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                {submitError !== null && (
                  <p role="alert" className="console-list-error">
                    {submitError}
                  </p>
                )}
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
};
