import { useState } from 'react';

export type ConsoleDangerousActionsProps = {
  onDeleteAllComments: () => void;
  onDeleteStory?: (() => Promise<void>) | null;
  storyNameForDeletion?: string | null;
};

export const ConsoleDangerousActions = ({
  onDeleteAllComments,
  onDeleteStory,
  storyNameForDeletion,
}: ConsoleDangerousActionsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [storyDeleteConfirming, setStoryDeleteConfirming] = useState(false);
  const [isStoryDeleting, setIsStoryDeleting] = useState(false);
  const [storyDeleteError, setStoryDeleteError] = useState<string | null>(null);

  const handleDeleteAllComments = () => {
    onDeleteAllComments();
    setExpanded(false);
  };

  const handleStoryDeleteClick = () => {
    setStoryDeleteConfirming(true);
    setStoryDeleteError(null);
  };

  const handleStoryDeleteConfirm = async (): Promise<void> => {
    if (!onDeleteStory) return;
    setIsStoryDeleting(true);
    setStoryDeleteError(null);
    try {
      await onDeleteStory();
    } catch (err) {
      setStoryDeleteError(err instanceof Error ? err.message : String(err));
      setIsStoryDeleting(false);
    }
  };

  const handleStoryDeleteCancel = () => {
    setStoryDeleteConfirming(false);
    setStoryDeleteError(null);
  };

  return (
    <div className="console-op-group">
      <button
        type="button"
        className="console-op-button console-op-button-danger"
        onClick={() => setExpanded((prev) => !prev)}
      >
        ⚠
      </button>
      {expanded && (
        <>
          <button
            type="button"
            className="console-op-button console-op-button-danger"
            onClick={handleDeleteAllComments}
          >
            Delete All Comments
          </button>
          {onDeleteStory != null && (
            <button
              type="button"
              className="console-op-button console-op-button-danger"
              onClick={handleStoryDeleteClick}
              disabled={storyDeleteConfirming}
            >
              Delete Story
            </button>
          )}
        </>
      )}
      {storyDeleteConfirming && (
        <div
          className="console-story-delete-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm story deletion"
        >
          <p className="console-story-delete-confirm-message">
            Delete story option &quot;{storyNameForDeletion}&quot; from the
            GitHub custom field? Tasks assigned to this story will not be
            deleted.
          </p>
          {storyDeleteError !== null && (
            <p role="alert" className="console-list-error">
              {storyDeleteError}
            </p>
          )}
          <div className="console-story-delete-confirm-actions">
            <button
              type="button"
              className="console-op-button console-op-button-danger"
              onClick={() => void handleStoryDeleteConfirm()}
              disabled={isStoryDeleting}
            >
              {isStoryDeleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="console-op-button"
              onClick={handleStoryDeleteCancel}
              disabled={isStoryDeleting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
