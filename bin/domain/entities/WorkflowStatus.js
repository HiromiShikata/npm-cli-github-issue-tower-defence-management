"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_WORKFLOW_STATUSES = exports.DISABLED_STATUS_NAME = exports.AWAITING_QUALITY_CHECK_STATUS_NAME = exports.PREPARATION_STATUS_NAME = exports.AWAITING_WORKSPACE_STATUS_NAME = exports.DEFAULT_STATUS_NAME = void 0;
exports.DEFAULT_STATUS_NAME = 'Unread';
exports.AWAITING_WORKSPACE_STATUS_NAME = 'Awaiting Workspace';
exports.PREPARATION_STATUS_NAME = 'Preparation';
exports.AWAITING_QUALITY_CHECK_STATUS_NAME = 'Awaiting Quality Check';
exports.DISABLED_STATUS_NAME = 'Disabled';
exports.REQUIRED_WORKFLOW_STATUSES = [
    {
        name: exports.DEFAULT_STATUS_NAME,
        color: 'GRAY',
        description: 'Default fallback status for issues before triage',
    },
    {
        name: exports.AWAITING_WORKSPACE_STATUS_NAME,
        color: 'YELLOW',
        description: 'Issue is ready and waiting for an agent workspace',
    },
    {
        name: exports.PREPARATION_STATUS_NAME,
        color: 'ORANGE',
        description: 'Agent is preparing the issue',
    },
    {
        name: exports.AWAITING_QUALITY_CHECK_STATUS_NAME,
        color: 'BLUE',
        description: 'Awaiting human quality check',
    },
    {
        name: exports.DISABLED_STATUS_NAME,
        color: 'GRAY',
        description: 'Disabled and excluded from the active workflow',
    },
];
//# sourceMappingURL=WorkflowStatus.js.map