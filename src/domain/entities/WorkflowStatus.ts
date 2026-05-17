import { FieldOption } from './Project';

export const DEFAULT_STATUS_NAME = 'Unread';
export const AWAITING_WORKSPACE_STATUS_NAME = 'Awaiting Workspace';
export const PREPARATION_STATUS_NAME = 'Preparation';
export const AWAITING_QUALITY_CHECK_STATUS_NAME = 'Awaiting Quality Check';
export const DISABLED_STATUS_NAME = 'Disabled';

export type WorkflowStatusDefinition = {
  name: string;
  color: FieldOption['color'];
  description: string;
};

export const REQUIRED_WORKFLOW_STATUSES: WorkflowStatusDefinition[] = [
  {
    name: DEFAULT_STATUS_NAME,
    color: 'GRAY',
    description: 'Default fallback status for issues before triage',
  },
  {
    name: AWAITING_WORKSPACE_STATUS_NAME,
    color: 'YELLOW',
    description: 'Issue is ready and waiting for an agent workspace',
  },
  {
    name: PREPARATION_STATUS_NAME,
    color: 'ORANGE',
    description: 'Agent is preparing the issue',
  },
  {
    name: AWAITING_QUALITY_CHECK_STATUS_NAME,
    color: 'BLUE',
    description: 'Awaiting human quality check',
  },
  {
    name: DISABLED_STATUS_NAME,
    color: 'GRAY',
    description: 'Disabled and excluded from the active workflow',
  },
];
