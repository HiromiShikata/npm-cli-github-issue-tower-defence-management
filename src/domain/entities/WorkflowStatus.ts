import { FieldOption } from './Project';

export const DEFAULT_STATUS_NAME = 'Unread';
export const AWAITING_WORKSPACE_STATUS_NAME = 'Awaiting Workspace';
export const PREPARATION_STATUS_NAME = 'Preparation';
export const FAILED_PREPARATION_STATUS_NAME = 'Failed Preparation';
export const AWAITING_QUALITY_CHECK_STATUS_NAME = 'Awaiting Quality Check';
export const TODO_STATUS_NAME = 'Todo by human';
export const PC_TODO_STATUS_NAME = 'PC Todo';
export const IN_TMUX_STATUS_NAME = 'In Tmux by human';
export const IN_TMUX_BY_AGENT_STATUS_NAME = 'In Tmux by agent';
export const DONE_STATUS_NAME = 'Done';
export const ICEBOX_STATUS_NAME = 'Icebox';

export const LEGACY_TODO_STATUS_NAME = 'Todo';
export const LEGACY_IN_TMUX_STATUS_NAME = 'In Tmux';
export const LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME =
  'Awaiting Task Breakdown';

export type WorkflowStatusDefinition = {
  name: string;
  color: FieldOption['color'];
};

export const REQUIRED_WORKFLOW_STATUSES: WorkflowStatusDefinition[] = [
  {
    name: DEFAULT_STATUS_NAME,
    color: 'ORANGE',
  },
  {
    name: AWAITING_WORKSPACE_STATUS_NAME,
    color: 'BLUE',
  },
  {
    name: PREPARATION_STATUS_NAME,
    color: 'YELLOW',
  },
  {
    name: FAILED_PREPARATION_STATUS_NAME,
    color: 'RED',
  },
  {
    name: AWAITING_QUALITY_CHECK_STATUS_NAME,
    color: 'GREEN',
  },
  {
    name: TODO_STATUS_NAME,
    color: 'PINK',
  },
  {
    name: IN_TMUX_STATUS_NAME,
    color: 'RED',
  },
  {
    name: IN_TMUX_BY_AGENT_STATUS_NAME,
    color: 'YELLOW',
  },
  {
    name: DONE_STATUS_NAME,
    color: 'PURPLE',
  },
  {
    name: ICEBOX_STATUS_NAME,
    color: 'GRAY',
  },
];
