"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupTowerDefenceProjectUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
class SetupTowerDefenceProjectUseCase {
    constructor(projectRepository, issueRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (params) => {
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const existing = project.status.statuses;
            const awaitingWorkspaceStatus = existing.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            let issuesPromise = null;
            const fetchIssues = () => {
                if (!issuesPromise) {
                    issuesPromise = this.issueRepository.getAllIssues(project.id);
                }
                return issuesPromise;
            };
            const unreadStatus = existing.find((s) => s.name === SetupTowerDefenceProjectUseCase.UNREAD_MIGRATED_STATUS_NAME);
            if (unreadStatus && awaitingWorkspaceStatus) {
                const { issues } = await fetchIssues();
                const unreadIssues = issues.filter((issue) => issue.status ===
                    SetupTowerDefenceProjectUseCase.UNREAD_MIGRATED_STATUS_NAME);
                for (const issue of unreadIssues) {
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatus.id);
                }
            }
            const awaitingTaskBreakdownStatus = existing.find((s) => s.name === WorkflowStatus_1.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME);
            if (awaitingTaskBreakdownStatus) {
                const todoStatus = existing.find((s) => s.name === WorkflowStatus_1.TODO_STATUS_NAME);
                if (todoStatus) {
                    const { issues } = await fetchIssues();
                    const awaitingTaskBreakdownIssues = issues.filter((issue) => issue.status === WorkflowStatus_1.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME);
                    for (const issue of awaitingTaskBreakdownIssues) {
                        await this.issueRepository.updateStatus(project, issue, todoStatus.id);
                    }
                }
            }
            if (awaitingWorkspaceStatus) {
                const { issues } = await fetchIssues();
                const limboIssues = issues.filter((issue) => issue.state === 'OPEN' &&
                    (issue.status === WorkflowStatus_1.DONE_STATUS_NAME || issue.status === null));
                for (const issue of limboIssues) {
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatus.id);
                }
            }
            const hasMigratedFromName = existing.some((s) => SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES.has(s.name));
            if (!hasMigratedFromName &&
                SetupTowerDefenceProjectUseCase.hasRequiredStatusesInCanonicalOrder(existing)) {
                return;
            }
            const requiredNames = new Set(WorkflowStatus_1.REQUIRED_WORKFLOW_STATUSES.map((s) => s.name));
            const others = existing.filter((status) => !requiredNames.has(status.name) &&
                !SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES.has(status.name));
            const reusedOptionIds = new Set();
            const newStatusList = [
                ...WorkflowStatus_1.REQUIRED_WORKFLOW_STATUSES.map((required) => {
                    const legacyName = SetupTowerDefenceProjectUseCase.LEGACY_STATUS_NAMES[required.name];
                    const found = existing.find((status) => status.name === required.name) ??
                        (legacyName !== undefined
                            ? existing.find((status) => status.name === legacyName && !reusedOptionIds.has(status.id))
                            : undefined);
                    if (found) {
                        reusedOptionIds.add(found.id);
                    }
                    return {
                        id: found ? found.id : null,
                        name: required.name,
                        color: required.color,
                        description: '',
                    };
                }),
                ...others.map((other) => ({
                    id: other.id,
                    name: other.name,
                    color: other.color,
                    description: other.description,
                })),
            ];
            await this.projectRepository.updateStatusList(project, newStatusList);
        };
    }
}
exports.SetupTowerDefenceProjectUseCase = SetupTowerDefenceProjectUseCase;
SetupTowerDefenceProjectUseCase.LEGACY_STATUS_NAMES = {
    [WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME]: WorkflowStatus_1.LEGACY_TODO_STATUS_NAME,
    [WorkflowStatus_1.TODO_STATUS_NAME]: WorkflowStatus_1.LEGACY_TODO_STATUS_NAME,
    [WorkflowStatus_1.IN_TMUX_STATUS_NAME]: WorkflowStatus_1.LEGACY_IN_TMUX_STATUS_NAME,
};
SetupTowerDefenceProjectUseCase.UNREAD_MIGRATED_STATUS_NAME = 'Unread';
SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES = new Set([
    WorkflowStatus_1.LEGACY_TODO_STATUS_NAME,
    WorkflowStatus_1.LEGACY_IN_TMUX_STATUS_NAME,
    WorkflowStatus_1.PC_TODO_STATUS_NAME,
    WorkflowStatus_1.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
    SetupTowerDefenceProjectUseCase.UNREAD_MIGRATED_STATUS_NAME,
]);
SetupTowerDefenceProjectUseCase.hasRequiredStatusesInCanonicalOrder = (existing) => {
    if (existing.length < WorkflowStatus_1.REQUIRED_WORKFLOW_STATUSES.length) {
        return false;
    }
    return WorkflowStatus_1.REQUIRED_WORKFLOW_STATUSES.every((required, index) => {
        const actual = existing[index];
        return (actual.name === required.name &&
            actual.color === required.color &&
            actual.description === '');
    });
};
//# sourceMappingURL=SetupTowerDefenceProjectUseCase.js.map