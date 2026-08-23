import { useEffect, useRef, useState } from 'react';
import { colorFromEnum } from '../../logic/colors';
import type { ConsoleStoryEntry } from '../../logic/types';

type StoryCreateFormProps = {
  storyOptionId: string;
  onSubmit: (storyOptionId: string, title: string) => Promise<void>;
  onCancel: () => void;
};

const StoryCreateForm = ({
  storyOptionId,
  onSubmit,
  onCancel,
}: StoryCreateFormProps) => {
  const [titleInput, setTitleInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    const trimmed = titleInput.trim();
    if (trimmed.length === 0) {
      setSubmitError('Title is required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(storyOptionId, trimmed);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="console-story-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        className="console-story-create-input"
        placeholder="Issue title"
        value={titleInput}
        onChange={(e) => setTitleInput(e.target.value)}
        disabled={submitting}
      />
      <button type="submit" className="console-op-button" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create'}
      </button>
      <button
        type="button"
        className="console-op-button"
        onClick={onCancel}
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
  );
};

type AddStoryFormProps = {
  onSubmit: (storyName: string) => Promise<void>;
  onCancel: () => void;
};

const AddStoryForm = ({ onSubmit, onCancel }: AddStoryFormProps) => {
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    const trimmed = nameInput.trim();
    if (trimmed.length === 0) {
      setSubmitError('Story name is required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="console-story-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        className="console-story-create-input"
        placeholder="Story name"
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        disabled={submitting}
      />
      <button type="submit" className="console-op-button" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create'}
      </button>
      <button
        type="button"
        className="console-op-button"
        onClick={onCancel}
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
  );
};

export type ConsoleStoryListProps = {
  stories: ConsoleStoryEntry[];
  isLoading: boolean;
  error: string | null;
  onCreateIssue: (storyOptionId: string, title: string) => Promise<void>;
  onAddStory: (storyName: string) => Promise<void>;
};

export const ConsoleStoryList = ({
  stories,
  isLoading,
  error,
  onCreateIssue,
  onAddStory,
}: ConsoleStoryListProps) => {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [addStoryExpanded, setAddStoryExpanded] = useState(false);

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

  const handleAddClick = (storyOptionId: string): void => {
    setExpandedOptionId(
      expandedOptionId === storyOptionId ? null : storyOptionId,
    );
  };

  const handleSubmit = async (
    storyOptionId: string,
    title: string,
  ): Promise<void> => {
    await onCreateIssue(storyOptionId, title);
    setExpandedOptionId(null);
  };

  return (
    <div className="console-story-list-container">
      {stories.length === 0 ? (
        <p className="console-list-empty">No active stories</p>
      ) : (
        <ul className="console-story-list">
          {stories.map((entry) => {
            const palette = colorFromEnum(entry.color);
            const isExpanded = expandedOptionId === entry.storyOptionId;
            return (
              <li key={entry.storyOptionId} className="console-story-list-row">
                <div className="console-story-list-row-main">
                  {entry.storyViewUrl ? (
                    <a
                      href={entry.storyViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="console-storytag"
                      style={{ color: palette.fg, borderColor: palette.border }}
                    >
                      <span
                        className="console-story-dot"
                        style={{ backgroundColor: palette.dot }}
                      />
                      {entry.storyName}
                    </a>
                  ) : (
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
                  )}
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
                  <StoryCreateForm
                    storyOptionId={entry.storyOptionId}
                    onSubmit={handleSubmit}
                    onCancel={() => setExpandedOptionId(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="console-add-story-section">
        <button
          type="button"
          className="console-op-button"
          onClick={() => setAddStoryExpanded(!addStoryExpanded)}
        >
          Add story
        </button>
        {addStoryExpanded && (
          <AddStoryForm
            onSubmit={async (storyName) => {
              await onAddStory(storyName);
              setAddStoryExpanded(false);
            }}
            onCancel={() => setAddStoryExpanded(false)}
          />
        )}
      </div>
    </div>
  );
};
