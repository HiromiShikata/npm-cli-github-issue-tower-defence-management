import { useState } from 'react';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';
import {
  IssueCreateModalDialog,
  type IssueCreateParams,
} from './IssueCreateModalDialog';

export type { IssueCreateParams };

export type ConsoleTaskCreateButtonProps = {
  pjcode: string;
  storyEntries: ConsoleStoryEntry[];
  agentOptions: ConsoleFieldOption[];
  defaultNameWithOwner: string | null;
  onCreateIssue: (params: IssueCreateParams) => Promise<void>;
  fleetTaskCreateUrl?: string | null;
};

export const ConsoleTaskCreateButton = ({
  pjcode: _pjcode,
  storyEntries,
  agentOptions,
  defaultNameWithOwner,
  onCreateIssue,
  fleetTaskCreateUrl = null,
}: ConsoleTaskCreateButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const disabled = defaultNameWithOwner === null || storyEntries.length === 0;

  const handleSubmit = async (params: IssueCreateParams): Promise<void> => {
    await onCreateIssue(params);
    setIsDialogOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="console-task-create-button"
        disabled={disabled}
        onClick={() => setIsDialogOpen(true)}
        aria-label="Create new task"
      >
        + New task
      </button>
      {isDialogOpen && (
        <IssueCreateModalDialog
          storyEntries={storyEntries}
          agentOptions={agentOptions}
          onSubmit={handleSubmit}
          onClose={() => setIsDialogOpen(false)}
          fleetTaskCreateUrl={fleetTaskCreateUrl}
        />
      )}
    </>
  );
};
