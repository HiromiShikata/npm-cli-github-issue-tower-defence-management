"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleScheduledEventUseCase = exports.ProjectNotFoundError = void 0;
const resolveLabelsAsLlmAgentName_1 = require("./resolveLabelsAsLlmAgentName");
const resolveAllowedIssueAuthors_1 = require("./resolveAllowedIssueAuthors");
class ProjectNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProjectNotFoundError';
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
const SLOW_SWEEP_INTERVAL_SECONDS = 600;
class HandleScheduledEventUseCase {
    constructor(setupTowerDefenceProjectUseCase, actionAnnouncementUseCase, setWorkflowManagementIssueToStoryUseCase, clearPastNextActionUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, setDependedIssueUrlForOpenTaskPRsUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, createNewStoryByLabelUseCase, assignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase, startPreparationUseCase, revertOrphanedPreparationUseCase, revertNotReadyReviewQueueIssueUseCase, updateRateLimitCacheUseCase, dailySecurityScanUseCase, dateRepository, spreadsheetRepository, projectRepository, issueRepository) {
        this.setupTowerDefenceProjectUseCase = setupTowerDefenceProjectUseCase;
        this.actionAnnouncementUseCase = actionAnnouncementUseCase;
        this.setWorkflowManagementIssueToStoryUseCase = setWorkflowManagementIssueToStoryUseCase;
        this.clearPastNextActionUseCase = clearPastNextActionUseCase;
        this.analyzeProblemByIssueUseCase = analyzeProblemByIssueUseCase;
        this.analyzeStoriesUseCase = analyzeStoriesUseCase;
        this.clearDependedIssueURLUseCase = clearDependedIssueURLUseCase;
        this.setDependedIssueUrlForOpenTaskPRsUseCase = setDependedIssueUrlForOpenTaskPRsUseCase;
        this.createEstimationIssueUseCase = createEstimationIssueUseCase;
        this.convertCheckboxToIssueInStoryIssueUseCase = convertCheckboxToIssueInStoryIssueUseCase;
        this.changeStatusByStoryColorUseCase = changeStatusByStoryColorUseCase;
        this.setNoStoryIssueToStoryUseCase = setNoStoryIssueToStoryUseCase;
        this.createNewStoryByLabelUseCase = createNewStoryByLabelUseCase;
        this.assignNoAssigneeIssueToManagerUseCase = assignNoAssigneeIssueToManagerUseCase;
        this.updateIssueStatusByLabelUseCase = updateIssueStatusByLabelUseCase;
        this.startPreparationUseCase = startPreparationUseCase;
        this.revertOrphanedPreparationUseCase = revertOrphanedPreparationUseCase;
        this.revertNotReadyReviewQueueIssueUseCase = revertNotReadyReviewQueueIssueUseCase;
        this.updateRateLimitCacheUseCase = updateRateLimitCacheUseCase;
        this.dailySecurityScanUseCase = dailySecurityScanUseCase;
        this.dateRepository = dateRepository;
        this.spreadsheetRepository = spreadsheetRepository;
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            if (input.disabled) {
                return null;
            }
            await this.setupTowerDefenceProjectUseCase.run({
                projectUrl: input.projectUrl,
            });
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
                const storyStartTime = Date.now();
                console.log(`[HandleScheduledEvent] Creating story issue: story="${storyObject.story.name}"`);
                const issueNumber = await this.issueRepository.createNewIssue(input.org, input.workingReport.repo, storyObject.story.name, storyObject.story.description, [input.manager], ['story']);
                const issueUrl = `https://github.com/${input.org}/${input.workingReport.repo}/issues/${issueNumber}`;
                let issue = null;
                for (let i = 0; i < 3; i++) {
                    console.log(`[HandleScheduledEvent] Polling for issue (attempt ${i + 1}/3): url=${issueUrl}`);
                    await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
                    issue = await this.issueRepository.getIssueByUrl(issueUrl);
                    if (!issue || !issue.itemId) {
                        continue;
                    }
                    console.log(`[HandleScheduledEvent] Issue found: url=${issueUrl} itemId=${issue.itemId}`);
                    break;
                }
                if (!issue) {
                    throw new Error(`Issue not found. URL: ${issueUrl}`);
                }
                else if (!issue.itemId) {
                    throw new Error(`Issue itemId not found. URL: ${issueUrl}`);
                }
                await this.issueRepository.updateStory({ ...project, story: projectStory }, issue, storyObject.story.id);
                console.log(`[HandleScheduledEvent] Waiting for story update: url=${issueUrl}`);
                await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
                const newIssue = await this.issueRepository.getIssueByUrl(issueUrl);
                if (!newIssue) {
                    throw new Error(`Issue not found. URL: ${issueUrl}`);
                }
                storyObject.storyIssue = newIssue;
                issues.push(newIssue);
                storyObject.issues.push(newIssue);
                console.log(`[HandleScheduledEvent] Story issue created: story="${storyObject.story.name}" elapsed=${Date.now() - storyStartTime}ms`);
            }
            const targetDateTimes = await this.findTargetDateAndUpdateLastExecutionDateTime(input.workingReport.spreadsheetUrl, now, input.org, input.workingReport.repo, input.manager);
            const runSlowSweep = await this.shouldRunSlowSweep(input.workingReport.spreadsheetUrl, now, input.org, input.workingReport.repo, input.manager);
            let rotationOrder = null;
            try {
                const useCaseResult = await this.runEachUseCases(input, project, issues, cacheUsed, targetDateTimes, storyIssues, runSlowSweep);
                rotationOrder = useCaseResult.rotationOrder;
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
            return {
                project,
                issues,
                cacheUsed,
                targetDateTimes,
                storyIssues,
                rotationOrder,
            };
        };
        this.runEachUseCases = async (input, project, issues, cacheUsed, targetDateTimes, storyObjectMap, runSlowSweep) => {
            if (runSlowSweep) {
                await this.runSlowSweepUseCases(input, project, issues, cacheUsed, targetDateTimes, storyObjectMap);
            }
            const labelsAsLlmAgentName = (0, resolveLabelsAsLlmAgentName_1.resolveLabelsAsLlmAgentName)({
                topLevel: input.labelsAsLlmAgentName,
                startPreparation: input.startPreparation?.labelsAsLlmAgentName,
            });
            const allowedIssueAuthors = (0, resolveAllowedIssueAuthors_1.resolveAllowedIssueAuthors)({
                topLevel: input.allowedIssueAuthors,
                startPreparation: input.startPreparation?.allowedIssueAuthors,
            });
            await this.revertNotReadyReviewQueueIssueUseCase.run({
                projectUrl: input.projectUrl,
                allowIssueCacheMinutes: input.allowIssueCacheMinutes,
                labelsAsLlmAgentName,
                changeTargetPathAliases: input.changeTargetPathAliases,
                allowedIssueAuthors,
            });
            if (this.dailySecurityScanUseCase !== null && input.dailySecurityScan) {
                await this.dailySecurityScanUseCase.run({
                    targetDates: targetDateTimes,
                    org: input.org,
                    manager: input.manager,
                    dailySecurityScan: input.dailySecurityScan,
                });
            }
            if (input.startPreparation) {
                if (this.updateRateLimitCacheUseCase !== null) {
                    await this.updateRateLimitCacheUseCase.run({
                        nowEpochSeconds: Date.now() / 1000,
                    });
                }
                if (input.startPreparation.preparationProcessCheckCommand) {
                    await this.revertOrphanedPreparationUseCase.run({
                        projectUrl: input.projectUrl,
                        allowIssueCacheMinutes: input.allowIssueCacheMinutes,
                        preparationProcessCheckCommand: input.startPreparation.preparationProcessCheckCommand,
                        thresholdForAutoReject: input.thresholdForAutoReject ?? 3,
                        awLogDirectoryPath: input.startPreparation.awLogDirectoryPath,
                        awLogStaleThresholdMinutes: input.startPreparation.awLogStaleThresholdMinutes,
                        awaitingQualityCheckStatus: input.startPreparation.awaitingQualityCheckStatus ?? undefined,
                        labelsAsLlmAgentName,
                    });
                }
                const preparationResult = await this.startPreparationUseCase.run({
                    projectUrl: input.projectUrl,
                    defaultAgentName: input.startPreparation.defaultAgentName,
                    defaultLlmModelName: input.startPreparation.defaultLlmModelName ?? null,
                    fallbackLlmModelName: input.startPreparation.fallbackLlmModelName ?? null,
                    defaultLlmAgentName: input.startPreparation.defaultLlmAgentName ?? null,
                    configFilePath: input.startPreparation.configFilePath,
                    maximumPreparingIssuesCount: input.startPreparation.maximumPreparingIssuesCount,
                    utilizationPercentageThreshold: input.startPreparation.utilizationPercentageThreshold ?? 90,
                    allowedIssueAuthors,
                    codexHomeCandidates: input.startPreparation.codexHomeCandidates ?? null,
                    allowIssueCacheMinutes: input.allowIssueCacheMinutes,
                    labelsAsLlmAgentName,
                });
                return { rotationOrder: preparationResult.rotationOrder };
            }
            return { rotationOrder: null };
        };
        this.runSlowSweepUseCases = async (input, project, issues, cacheUsed, targetDateTimes, storyObjectMap) => {
            await this.setWorkflowManagementIssueToStoryUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
            });
            await this.setNoStoryIssueToStoryUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
            });
            await this.analyzeProblemByIssueUseCase.run({
                targetDates: targetDateTimes,
                project,
                storyObjectMap: storyObjectMap,
            });
            await this.actionAnnouncementUseCase.run({
                targetDates: targetDateTimes,
                project,
                issues,
                cacheUsed,
                members: input.workingReport.members,
                manager: input.manager,
            });
            await this.clearPastNextActionUseCase.run({
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
            await this.setDependedIssueUrlForOpenTaskPRsUseCase.run({
                project,
                issues,
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
                storyObjectMap: storyObjectMap,
            });
            await this.convertCheckboxToIssueInStoryIssueUseCase.run({
                project,
                issues,
                cacheUsed,
                urlOfStoryView: input.urlOfStoryView,
                storyObjectMap: storyObjectMap,
                manager: input.manager,
            });
            await this.changeStatusByStoryColorUseCase.run({
                project,
                cacheUsed,
                org: input.org,
                repo: input.workingReport.repo,
                storyObjectMap: storyObjectMap,
            });
            await this.createNewStoryByLabelUseCase.run({
                project,
                cacheUsed,
                org: input.org,
                repo: input.workingReport.repo,
                storyObjectMap: storyObjectMap,
                issues: issues,
            });
            await this.assignNoAssigneeIssueToManagerUseCase.run({
                issues,
                manager: input.manager,
                cacheUsed,
            });
            await this.updateIssueStatusByLabelUseCase.run({
                project,
                issues,
            });
        };
        this.runSpreadsheetOperation = async (operation, spreadsheetUrl, org, repo, manager, action) => {
            try {
                return await action();
            }
            catch (e) {
                if (!(e instanceof Error)) {
                    throw e;
                }
                await this.issueRepository.createNewIssue(org, repo, `Error in HandleScheduledEvent / spreadsheet ${operation} failure`, `Spreadsheet URL: ${spreadsheetUrl}
Operation: ${operation}

${e.message}
\`\`\`
${e.stack}
\`\`\`
\`\`\`
${JSON.stringify(e)}
\`\`\`

`, [manager], ['error']);
                throw e;
            }
        };
        this.findTargetDateAndUpdateLastExecutionDateTime = async (spreadsheetUrl, now, org, repo, manager) => {
            const sheetValues = await this.runSpreadsheetOperation('read', spreadsheetUrl, org, repo, manager, () => this.spreadsheetRepository.getSheet(spreadsheetUrl, 'HandleScheduledEvent'));
            if (!sheetValues) {
                await this.runSpreadsheetOperation('write', spreadsheetUrl, org, repo, manager, () => this.spreadsheetRepository.updateCell(spreadsheetUrl, 'HandleScheduledEvent', 1, 1, 'LastExecutionDateTime'));
            }
            const lastExecutionDateTime = sheetValues && sheetValues[1][2] ? new Date(sheetValues[1][2]) : null;
            const targetDateTimes = lastExecutionDateTime
                ? HandleScheduledEventUseCase.createTargetDateTimes(lastExecutionDateTime, now)
                : [now];
            if (targetDateTimes.length === 0) {
                return targetDateTimes;
            }
            await this.runSpreadsheetOperation('write', spreadsheetUrl, org, repo, manager, () => this.spreadsheetRepository.updateCell(spreadsheetUrl, 'HandleScheduledEvent', 1, 2, targetDateTimes[targetDateTimes.length - 1].toISOString()));
            return targetDateTimes;
        };
        this.shouldRunSlowSweep = async (spreadsheetUrl, now, org, repo, manager) => {
            const sheetValues = await this.runSpreadsheetOperation('read', spreadsheetUrl, org, repo, manager, () => this.spreadsheetRepository.getSheet(spreadsheetUrl, 'HandleScheduledEvent'));
            const lastSlowSweepDateTime = sheetValues && sheetValues[1] && sheetValues[1][4]
                ? new Date(sheetValues[1][4])
                : null;
            const elapsedSeconds = lastSlowSweepDateTime
                ? (now.getTime() - lastSlowSweepDateTime.getTime()) / 1000
                : Infinity;
            if (elapsedSeconds < SLOW_SWEEP_INTERVAL_SECONDS) {
                return false;
            }
            await this.runSpreadsheetOperation('write', spreadsheetUrl, org, repo, manager, () => this.spreadsheetRepository.updateCell(spreadsheetUrl, 'HandleScheduledEvent', 1, 3, 'LastSlowSweepDateTime'));
            await this.runSpreadsheetOperation('write', spreadsheetUrl, org, repo, manager, () => this.spreadsheetRepository.updateCell(spreadsheetUrl, 'HandleScheduledEvent', 1, 4, now.toISOString()));
            return true;
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