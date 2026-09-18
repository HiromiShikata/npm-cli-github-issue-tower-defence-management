import { useEffect, useState } from 'react';

export type ConsoleItemTitleEditorProps = {
  title: string;
  onRename: (newTitle: string) => Promise<void>;
};

export const ConsoleItemTitleEditor = ({
  title,
  onRename,
}: ConsoleItemTitleEditorProps) => {
  const [localTitle, setLocalTitle] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalTitle(title);
    }
  }, [title, isEditing]);

  const handleEdit = () => {
    setEditValue(localTitle);
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (trimmed === '' || trimmed === localTitle) {
      setIsEditing(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onRename(trimmed);
      setLocalTitle(trimmed);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <span className="console-detail-title-text console-detail-title-text--editing">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="console-detail-title-input"
          aria-label="Edit title"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isLoading}
          className="console-detail-title-save"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="console-detail-title-cancel"
        >
          Cancel
        </button>
        {error !== null && (
          <span className="console-detail-title-error" role="alert">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="console-detail-title-text">
      {localTitle}
      <button
        type="button"
        onClick={handleEdit}
        className="console-detail-title-edit"
        aria-label="Edit title"
      >
        Edit
      </button>
    </span>
  );
};
