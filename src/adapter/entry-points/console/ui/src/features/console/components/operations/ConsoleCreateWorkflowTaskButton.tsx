import { useState } from 'react';
import { IssueCreateModalDialog } from '../layout/IssueCreateModalDialog';

export type ConsoleCreateWorkflowTaskButtonProps = {
  onCreateWorkflowTask: (title: string) => Promise<string>;
};

export const ConsoleCreateWorkflowTaskButton = ({
  onCreateWorkflowTask,
}: ConsoleCreateWorkflowTaskButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="console-op-group console-op-group-create-workflow-task">
      <button
        type="button"
        className="console-tab-settings-button"
        onClick={() => setIsDialogOpen(true)}
        title="Create workflow improvement task"
        aria-label="Create workflow improvement task"
      >
        !
      </button>
      {isDialogOpen && (
        <IssueCreateModalDialog
          storyEntries={[]}
          agentOptions={[]}
          showOptionalFields={false}
          onSubmit={async (params) => {
            await onCreateWorkflowTask(params.title);
          }}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </div>
  );
};
