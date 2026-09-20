export type ConsoleStoryDeleteModalDialogProps = {
  storyName: string;
  isDeleting: boolean;
  deleteError: string | null;
  onConfirm: (deleteChildTasks: boolean) => void;
  onCancel: () => void;
};

export const ConsoleStoryDeleteModalDialog = ({
  storyName,
  isDeleting,
  deleteError,
  onConfirm,
  onCancel,
}: ConsoleStoryDeleteModalDialogProps) => (
  <div
    className="console-modal-dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Confirm story deletion"
  >
    <button
      type="button"
      className="console-modal-backdrop"
      aria-label="Close dialog"
      onClick={onCancel}
    />
    <div className="console-modal-inner">
      <h2 className="console-modal-title">Delete story</h2>
      <p className="console-story-delete-confirm-message">
        Delete story option &quot;{storyName}&quot; from the GitHub custom
        field?
      </p>
      {deleteError !== null && (
        <p role="alert" className="console-list-error">
          {deleteError}
        </p>
      )}
      <div className="console-modal-actions">
        <button
          type="button"
          className="console-op-button console-op-button-danger"
          onClick={() => onConfirm(true)}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting…' : 'Delete with child tasks'}
        </button>
        <button
          type="button"
          className="console-op-button console-op-button-danger"
          onClick={() => onConfirm(false)}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting…' : 'Keep child tasks'}
        </button>
        <button
          type="button"
          className="console-op-button"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);
