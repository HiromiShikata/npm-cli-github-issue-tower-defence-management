"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_WORKFLOW_STATUSES = exports.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME = exports.LEGACY_IN_TMUX_STATUS_NAME = exports.LEGACY_TODO_STATUS_NAME = exports.ICEBOX_STATUS_NAME = exports.DONE_STATUS_NAME = exports.IN_TMUX_BY_AGENT_STATUS_NAME = exports.IN_TMUX_STATUS_NAME = exports.PC_TODO_STATUS_NAME = exports.TODO_BY_AGENT_STATUS_NAME = exports.TODO_STATUS_NAME = exports.AWAITING_QUALITY_CHECK_STATUS_NAME = exports.FAILED_PREPARATION_STATUS_NAME = exports.PREPARATION_STATUS_NAME = exports.AWAITING_WORKSPACE_STATUS_NAME = exports.DEFAULT_STATUS_NAME = void 0;
exports.DEFAULT_STATUS_NAME = 'Unread';
exports.AWAITING_WORKSPACE_STATUS_NAME = 'Awaiting Workspace';
exports.PREPARATION_STATUS_NAME = 'Preparation';
exports.FAILED_PREPARATION_STATUS_NAME = 'Failed Preparation';
exports.AWAITING_QUALITY_CHECK_STATUS_NAME = 'Awaiting Quality Check';
exports.TODO_STATUS_NAME = 'Todo by human';
exports.TODO_BY_AGENT_STATUS_NAME = 'Todo by agent';
exports.PC_TODO_STATUS_NAME = 'PC Todo';
exports.IN_TMUX_STATUS_NAME = 'In Tmux by human';
exports.IN_TMUX_BY_AGENT_STATUS_NAME = 'In Tmux by agent';
exports.DONE_STATUS_NAME = 'Done';
exports.ICEBOX_STATUS_NAME = 'Icebox';
exports.LEGACY_TODO_STATUS_NAME = 'Todo';
exports.LEGACY_IN_TMUX_STATUS_NAME = 'In Tmux';
exports.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME = 'Awaiting Task Breakdown';
exports.REQUIRED_WORKFLOW_STATUSES = [
    {
        name: exports.DEFAULT_STATUS_NAME,
        color: 'ORANGE',
    },
    {
        name: exports.AWAITING_WORKSPACE_STATUS_NAME,
        color: 'BLUE',
    },
    {
        name: exports.PREPARATION_STATUS_NAME,
        color: 'YELLOW',
    },
    {
        name: exports.FAILED_PREPARATION_STATUS_NAME,
        color: 'RED',
    },
    {
        name: exports.AWAITING_QUALITY_CHECK_STATUS_NAME,
        color: 'GREEN',
    },
    {
        name: exports.TODO_STATUS_NAME,
        color: 'PINK',
    },
    {
        name: exports.TODO_BY_AGENT_STATUS_NAME,
        color: 'BLUE',
    },
    {
        name: exports.IN_TMUX_STATUS_NAME,
        color: 'RED',
    },
    {
        name: exports.IN_TMUX_BY_AGENT_STATUS_NAME,
        color: 'YELLOW',
    },
    {
        name: exports.DONE_STATUS_NAME,
        color: 'PURPLE',
    },
    {
        name: exports.ICEBOX_STATUS_NAME,
        color: 'GRAY',
    },
];
//# sourceMappingURL=WorkflowStatus.js.map