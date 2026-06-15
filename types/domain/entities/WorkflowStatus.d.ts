import { FieldOption } from './Project';
export declare const DEFAULT_STATUS_NAME = "Unread";
export declare const AWAITING_WORKSPACE_STATUS_NAME = "Awaiting Workspace";
export declare const PREPARATION_STATUS_NAME = "Preparation";
export declare const FAILED_PREPARATION_STATUS_NAME = "Failed Preparation";
export declare const AWAITING_QUALITY_CHECK_STATUS_NAME = "Awaiting Quality Check";
export declare const TODO_STATUS_NAME = "Todo by human";
export declare const PC_TODO_STATUS_NAME = "PC Todo";
export declare const IN_TMUX_STATUS_NAME = "In Tmux by human";
export declare const IN_TMUX_BY_AGENT_STATUS_NAME = "In Tmux by agent";
export declare const DONE_STATUS_NAME = "Done";
export declare const ICEBOX_STATUS_NAME = "Icebox";
export declare const LEGACY_TODO_STATUS_NAME = "Todo";
export declare const LEGACY_IN_TMUX_STATUS_NAME = "In Tmux";
export declare const LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME = "Awaiting Task Breakdown";
export type WorkflowStatusDefinition = {
    name: string;
    color: FieldOption['color'];
};
export declare const REQUIRED_WORKFLOW_STATUSES: WorkflowStatusDefinition[];
//# sourceMappingURL=WorkflowStatus.d.ts.map