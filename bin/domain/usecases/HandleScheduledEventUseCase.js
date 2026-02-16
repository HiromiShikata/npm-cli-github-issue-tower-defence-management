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
    constructor(actionAnnouncementUseCase, setWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, createNewStoryByLabelUseCase, assignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase, dateRepository, spreadsheetRepository, projectRepository, issueRepository) {
        this.actionAnnouncementUseCase = actionAnnouncementUseCase;
        this.setWorkflowManagementIssueToStoryUseCase = setWorkflowManagementIssueToStoryUseCase;
        this.clearNextActionHourUseCase = clearNextActionHourUseCase;
        this.analyzeProblemByIssueUseCase = analyzeProblemByIssueUseCase;
        this.analyzeStoriesUseCase = analyzeStoriesUseCase;
        this.clearDependedIssueURLUseCase = clearDependedIssueURLUseCase;
        this.createEstimationIssueUseCase = createEstimationIssueUseCase;
        this.convertCheckboxToIssueInStoryIssueUseCase = convertCheckboxToIssueInStoryIssueUseCase;
        this.changeStatusByStoryColorUseCase = changeStatusByStoryColorUseCase;
        this.setNoStoryIssueToStoryUseCase = setNoStoryIssueToStoryUseCase;
        this.createNewStoryByLabelUseCase = createNewStoryByLabelUseCase;
        this.assignNoAssigneeIssueToManagerUseCase = assignNoAssigneeIssueToManagerUseCase;
        this.updateIssueStatusByLabelUseCase = updateIssueStatusByLabelUseCase;
        this.dateRepository = dateRepository;
        this.spreadsheetRepository = spreadsheetRepository;
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            if (input.disabled) {
                return null;
            }
            const projectId = await this.projectRepository.findProjectIdByUrl(input.projectUrl);
            if (!projectId) {
                throw new ProjectNotFoundError(`Project not found. projectUrl: ${input.projectUrl}`);
            }
            const project = await this.projectRepository.getProject(projectId);
            if (!project) {
                throw new ProjectNotFoundError(`Project not found. projectId: ${projectId} projectUrl: ${input.projectUrl}`);
            }
            const now = await this.dateRepository.now();
            const { issues, cacheUsed } = await this.issueRepository.getAllIssues(projectId, input.allowIssueCacheMinutes);
            const storyIssues = await this.storyIssues({
                project,
                issues,
            });
            for (const storyObject of storyIssues.values()) {
                const projectStory = project.story;
                if (!projectStory) {
                    break;
                }
                if (storyObject.storyIssue ||
                    storyObject.story.name.startsWith('regular / ')) {
                    continue;
                }
                const issueNumber = await this.issueRepository.createNewIssue(input.org, input.workingReport.repo, storyObject.story.name, storyObject.story.description, [input.manager], ['story']);
                const issueUrl = `https://github.com/${input.org}/${input.workingReport.repo}/issues/${issueNumber}`;
                let issue = null;
                for (let i = 0; i < 3; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
                    issue = await this.issueRepository.getIssueByUrl(issueUrl);
                    if (!issue) {
                        continue;
                    }
                    else if (!issue.itemId) {
                        continue;
                    }
                    break;
                }
                if (!issue) {
                    throw new Error(`Issue not found. URL: ${issueUrl}`);
                }
                else if (!issue.itemId) {
                    throw new Error(`Issue itemId not found. URL: ${issueUrl}`);
                }
                await this.issueRepository.updateStory({ ...project, story: projectStory }, issue, storyObject.story.id);
                await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
                const newIssue = await this.issueRepository.getIssueByUrl(issueUrl);
                if (!newIssue) {
                    throw new Error(`Issue not found. URL: ${issueUrl}`);
                }
                storyObject.storyIssue = newIssue;
                issues.push(newIssue);
                storyObject.issues.push(newIssue);
            }
            const targetDateTimes = await this.findTargetDateAndUpdateLastExecutionDateTime(input.workingReport.spreadsheetUrl, now);
            try {
                await this.runEachUseCases(input, project, issues, cacheUsed, targetDateTimes, storyIssues);
            }
            catch (e) {
                if (!(e instanceof Error)) {
                    throw e;
                }
                await this.issueRepository.createNewIssue(input.org, input.workingReport.repo, `Error in HandleScheduledEvent / workflow incident`, `${e.message}
\`\`\`
${e.stack}
\`\`\`
\`\`\`
${JSON.stringify(e)}
\`\`\`

`, [input.manager], ['error']);
                throw e;
            }
            return { project, issues, cacheUsed, targetDateTimes, storyIssues };
        };
        this.runEachUseCases = async (input, project, issues, cacheUsed, targetDateTimes, storyObjectMap) => {
            await this.setNoStoryIssueToStoryUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
            });
            await this.analyzeProblemByIssueUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
                manager: input.manager,
                members: input.workingReport.members,
                org: input.org,
                repo: input.workingReport.repo,
                storyObjectMap: storyObjectMap,
                disabledStatus: input.disabledStatus,
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
            await this.analyzeStoriesUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
                ...input,
                manager: input.manager,
                org: input.org,
                repo: input.workingReport.repo,
                storyObjectMap: storyObjectMap,
                members: input.workingReport.members,
            });
            await this.clearDependedIssueURLUseCase.run({
                project,
                issues,
                cacheUsed,
            });
            await this.createEstimationIssueUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
                manager: input.manager,
                org: input.org,
                repo: input.workingReport.repo,
                urlOfStoryView: input.urlOfStoryView,
                disabledStatus: input.disabledStatus,
                storyObjectMap: storyObjectMap,
            });
            await this.convertCheckboxToIssueInStoryIssueUseCase.run({
                project,
                issues,
                cacheUsed,
                urlOfStoryView: input.urlOfStoryView,
                disabledStatus: input.disabledStatus,
                storyObjectMap: storyObjectMap,
            });
            await this.changeStatusByStoryColorUseCase.run({
                project,
                cacheUsed,
                org: input.org,
                repo: input.workingReport.repo,
                disabledStatus: input.disabledStatus,
                storyObjectMap: storyObjectMap,
            });
            await this.createNewStoryByLabelUseCase.run({
                project,
                cacheUsed,
                org: input.org,
                repo: input.workingReport.repo,
                disabledStatus: input.disabledStatus,
                storyObjectMap: storyObjectMap,
            });
            await this.assignNoAssigneeIssueToManagerUseCase.run({
                issues,
                manager: input.manager,
                cacheUsed,
            });
            await this.updateIssueStatusByLabelUseCase.run({
                project,
                issues,
                defaultStatus: input.defaultStatus,
            });
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
        this.storyIssues = async (input) => {
            const summaryStoryIssue = new Map();
            const targetStory = input.project.story?.stories || [];
            for (const story of targetStory) {
                const storyIssue = input.issues.find((issue) => story.name.startsWith(issue.title));
                summaryStoryIssue.set(story.name, {
                    story,
                    storyIssue: storyIssue || null,
                    issues: [],
                });
                for (const issue of input.issues) {
                    if (issue.story !== story.name) {
                        continue;
                    }
                    summaryStoryIssue.get(story.name)?.issues.push(issue);
                }
            }
            return summaryStoryIssue;
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
        targetDateTimes.length < 300) {
        targetDateTimes.push(new Date(targetDate));
        targetDate.setMinutes(targetDate.getMinutes() + 1);
    }
    return targetDateTimes;
};
//# sourceMappingURL=HandleScheduledEventUseCase.js.map