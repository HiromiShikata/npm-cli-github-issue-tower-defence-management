import { FieldOption } from './Project';
export declare const DEFAULT_STATUS_NAME = "Unread";
export declare const AWAITING_WORKSPACE_STATUS_NAME = "Awaiting Workspace";
export declare const PREPARATION_STATUS_NAME = "Preparation";
export declare const AWAITING_QUALITY_CHECK_STATUS_NAME = "Awaiting Quality Check";
export declare const DISABLED_STATUS_NAME = "Disabled";
export type WorkflowStatusDefinition = {
    name: string;
    color: FieldOption['color'];
    description: string;
};
export declare const REQUIRED_WORKFLOW_STATUSES: WorkflowStatusDefinition[];
//# sourceMappingURL=WorkflowStatus.d.ts.map