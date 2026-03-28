"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIssueStatusByLabelUseCase = void 0;
class UpdateIssueStatusByLabelUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const { defaultStatus } = input;
            for (const issue of input.issues) {
                const statusLabel = issue.labels.find((label) => label
                    .toLowerCase()
                    .startsWith(UpdateIssueStatusByLabelUseCase.STATUS_LABEL_PREFIX));
                if (!statusLabel) {
                    continue;
                }
                const targetStatusName = statusLabel.slice(UpdateIssueStatusByLabelUseCase.STATUS_LABEL_PREFIX.length);
                const matchedStatus = input.project.status.statuses.find((s) => UpdateIssueStatusByLabelUseCase.normalizeStatus(s.name) ===
                    UpdateIssueStatusByLabelUseCase.normalizeStatus(targetStatusName));
                const fallbackStatus = defaultStatus !== null
                    ? input.project.status.statuses.find((s) => UpdateIssueStatusByLabelUseCase.normalizeStatus(s.name) ===
                        UpdateIssueStatusByLabelUseCase.normalizeStatus(defaultStatus))
                    : null;
                const targetStatus = matchedStatus ?? fallbackStatus ?? null;
                if (!targetStatus) {
                    continue;
                }
                const currentStatusNormalized = issue.status
                    ? UpdateIssueStatusByLabelUseCase.normalizeStatus(issue.status)
                    : null;
                const targetStatusNormalized = UpdateIssueStatusByLabelUseCase.normalizeStatus(targetStatus.name);
                if (currentStatusNormalized !== targetStatusNormalized) {
                    await this.issueRepository.updateStatus(input.project, issue, targetStatus.id);
                }
                await this.issueRepository.removeLabel(issue, statusLabel);
            }
        };
    }
}
exports.UpdateIssueStatusByLabelUseCase = UpdateIssueStatusByLabelUseCase;
UpdateIssueStatusByLabelUseCase.STATUS_LABEL_PREFIX = 'status:';
UpdateIssueStatusByLabelUseCase.normalizeStatus = (status) => status.toLowerCase().replace(/[\s\-_]/g, '');
//# sourceMappingURL=UpdateIssueStatusByLabelUseCase.js.map