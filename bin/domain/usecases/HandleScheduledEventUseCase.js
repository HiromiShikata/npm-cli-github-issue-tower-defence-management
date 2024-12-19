"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleScheduledEventUseCase = exports.ProjectNotFoundError = void 0;
class ProjectNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProjectNotFoundError';
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
class HandleScheduledEventUseCase {
    constructor(generateWorkingTimeReportUseCase, actionAnnouncementUseCase, setWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase, analyzeProblemByIssueUseCase, dateRepository, spreadsheetRepository, projectRepository, issueRepository) {
        this.generateWorkingTimeReportUseCase = generateWorkingTimeReportUseCase;
        this.actionAnnouncementUseCase = actionAnnouncementUseCase;
        this.setWorkflowManagementIssueToStoryUseCase = setWorkflowManagementIssueToStoryUseCase;
        this.clearNextActionHourUseCase = clearNextActionHourUseCase;
        this.analyzeProblemByIssueUseCase = analyzeProblemByIssueUseCase;
        this.dateRepository = dateRepository;
        this.spreadsheetRepository = spreadsheetRepository;
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const projectId = await this.projectRepository.findProjectIdByUrl(input.projectUrl);
            if (!projectId) {
                throw new ProjectNotFoundError(`Project not found. projectUrl: ${input.projectUrl}`);
            }
            const project = await this.projectRepository.getProject(projectId);
            if (!project) {
                throw new ProjectNotFoundError(`Project not found. projectId: ${projectId} projectUrl: ${input.projectUrl}`);
            }
            const now = await this.dateRepository.now();
            const allowIssueCacheMinutes = 60;
            const { issues, cacheUsed } = await this.issueRepository.getAllIssues(projectId, allowIssueCacheMinutes);
            const targetDateTimes = await this.findTargetDateAndUpdateLastExecutionDateTime(input.workingReport.spreadsheetUrl, now);
            for (const targetDateTime of targetDateTimes) {
                await this.runForTargetDateTime({
                    org: input.org,
                    manager: input.manager,
                    workingReport: input.workingReport,
                    projectId,
                    issues,
                    targetDateTime,
                });
            }
            await this.analyzeProblemByIssueUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
                manager: input.manager,
                org: input.org,
                repo: input.workingReport.repo,
            });
            await this.actionAnnouncementUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
                members: input.workingReport.members,
                manager: input.manager,
            });
            await this.setWorkflowManagementIssueToStoryUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
            });
            await this.clearNextActionHourUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
            });
            return { project, issues, cacheUsed, targetDateTimes };
        };
        this.runForTargetDateTime = async (input) => {
            const targetHour = input.targetDateTime.getHours();
            const targetMinute = input.targetDateTime.getMinutes();
            if (targetHour === 0 && targetMinute === 0) {
                const yesterday = new Date(input.targetDateTime.getTime() - 24 * 60 * 60 * 1000);
                await this.generateWorkingTimeReportUseCase.run({
                    ...input,
                    ...input.workingReport,
                    targetDate: yesterday,
                });
            }
        };
        this.findTargetDateAndUpdateLastExecutionDateTime = async (spreadsheetUrl, now) => {
            const sheetValues = await this.spreadsheetRepository.getSheet(spreadsheetUrl, 'HandleScheduledEvent');
            if (!sheetValues) {
                await this.spreadsheetRepository.updateCell(spreadsheetUrl, 'HandleScheduledEvent', 1, 1, 'LastExecutionDateTime');
            }
            const lastExecutionDateTime = sheetValues && sheetValues[1][2] ? new Date(sheetValues[1][2]) : null;
            const targetDateTimes = lastExecutionDateTime
                ? HandleScheduledEventUseCase.createTargetDateTimes(lastExecutionDateTime, now)
                : [now];
            await this.spreadsheetRepository.updateCell(spreadsheetUrl, 'HandleScheduledEvent', 1, 2, targetDateTimes[targetDateTimes.length - 1].toISOString());
            return targetDateTimes;
        };
    }
}
exports.HandleScheduledEventUseCase = HandleScheduledEventUseCase;
HandleScheduledEventUseCase.createTargetDateTimes = (from, to) => {
    const targetDateTimes = [];
    if (from.getTime() > to.getTime()) {
        const targetDate = new Date(to);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);
        return [targetDate];
    }
    const targetDate = new Date(from);
    targetDate.setTime(targetDate.getTime() + 60 * 1000);
    targetDate.setSeconds(0);
    targetDate.setMilliseconds(0);
    while (targetDate.getTime() <= to.getTime() &&
        targetDateTimes.length < 30) {
        targetDateTimes.push(new Date(targetDate));
        targetDate.setMinutes(targetDate.getMinutes() + 1);
    }
    return targetDateTimes;
};
//# sourceMappingURL=HandleScheduledEventUseCase.js.map