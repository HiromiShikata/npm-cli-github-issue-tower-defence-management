import { useState } from 'react';

export type ConsoleDangerousActionsProps = {
  onDeleteAllComments: () => void;
};

export const ConsoleDangerousActions = ({
  onDeleteAllComments,
}: ConsoleDangerousActionsProps) => {
  const [expanded, setExpanded] = useState(false);

  const handleDeleteAllComments = () => {
    onDeleteAllComments();
    setExpanded(false);
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
        <button
          type="button"
          className="console-op-button console-op-button-danger"
          onClick={handleDeleteAllComments}
        >
          Delete All Comments
        </button>
      )}
    </div>
  );
};
