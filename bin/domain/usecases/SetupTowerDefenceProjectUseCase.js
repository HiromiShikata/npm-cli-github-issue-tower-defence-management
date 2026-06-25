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
            const awaitingTaskBreakdownStatus = existing.find((s) => s.name === WorkflowStatus_1.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME);
            if (awaitingTaskBreakdownStatus) {
                const todoStatus = existing.find((s) => s.name === WorkflowStatus_1.TODO_STATUS_NAME);
                if (todoStatus) {
                    const { issues } = await this.issueRepository.getAllIssues(project.id, 0);
                    const awaitingTaskBreakdownIssues = issues.filter((issue) => issue.status === WorkflowStatus_1.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME);
                    for (const issue of awaitingTaskBreakdownIssues) {
                        await this.issueRepository.updateStatus(project, issue, todoStatus.id);
                    }
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
            const newStatusList = [
                ...WorkflowStatus_1.REQUIRED_WORKFLOW_STATUSES.map((required) => {
                    const legacyNames = SetupTowerDefenceProjectUseCase.LEGACY_STATUS_NAMES[required.name];
                    const found = existing.find((status) => status.name === required.name) ??
                        (legacyNames !== undefined
                            ? existing.find((status) => legacyNames.includes(status.name))
                            : undefined);
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
    [WorkflowStatus_1.TODO_STATUS_NAME]: [WorkflowStatus_1.LEGACY_TODO_STATUS_NAME],
    [WorkflowStatus_1.IN_TMUX_STATUS_NAME]: [
        WorkflowStatus_1.LEGACY_IN_TMUX_BY_HUMAN_STATUS_NAME,
        WorkflowStatus_1.LEGACY_IN_TMUX_STATUS_NAME,
    ],
};
SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES = new Set([
    WorkflowStatus_1.LEGACY_TODO_STATUS_NAME,
    WorkflowStatus_1.LEGACY_IN_TMUX_STATUS_NAME,
    WorkflowStatus_1.LEGACY_IN_TMUX_BY_HUMAN_STATUS_NAME,
    WorkflowStatus_1.PC_TODO_STATUS_NAME,
    WorkflowStatus_1.LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
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