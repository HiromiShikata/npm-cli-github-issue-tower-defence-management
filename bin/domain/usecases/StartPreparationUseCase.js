"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = void 0;
class StartPreparationUseCase {
    constructor(projectRepository, issueRepository, claudeRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.claudeRepository = claudeRepository;
        this.localCommandRunner = localCommandRunner;
        this.run = async (params) => {
            try {
                const claudeUsages = await this.claudeRepository.getUsage();
                if (claudeUsages.some((usage) => usage.utilizationPercentage > 90)) {
                    console.warn('Claude usage limit exceeded. Skipping starting preparation.');
                    return;
                }
            }
            catch (error) {
                console.warn('Failed to check Claude usage:', error);
            }
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
            const projectId = await this.projectRepository.findProjectIdByUrl(params.projectUrl);
            if (!projectId) {
                throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
            }
            const project = await this.projectRepository.getProject(projectId);
            if (!project) {
                throw new Error(`Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`);
            }
            const { issues } = await this.issueRepository.getAllIssues(projectId, params.allowIssueCacheMinutes);
            const storyObjectMap = this.createStoryObjectMap({
                project,
                issues,
            });
            const repositoryBlockerIssues = this.createWorkflowBlockerIssues(storyObjectMap);
            const awaitingWorkspaceIssues = Array.from(storyObjectMap.values())
                .map((storyObject) => storyObject.issues)
                .flat()
                .filter((issue) => issue.status === params.awaitingWorkspaceStatus);
            const currentPreparationIssueCount = issues.filter((issue) => issue.status === params.preparationStatus).length;
            let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
            const preparationStatusOption = project.status.statuses.find((s) => s.name === params.preparationStatus);
            for (let i = 0; i < awaitingWorkspaceIssues.length &&
                updatedCurrentPreparationIssueCount < maximumPreparingIssuesCount; i++) {
                const issue = awaitingWorkspaceIssues[i];
                const blockerIssueUrls = repositoryBlockerIssues.find((blocker) => issue.url.includes(blocker.orgRepo))?.blockerIssueUrls || [];
                if (blockerIssueUrls.length > 0 &&
                    !blockerIssueUrls.includes(issue.url)) {
                    continue;
                }
                const agent = issue.labels
                    .find((label) => label.startsWith('category:'))
                    ?.replace('category:', '')
                    .trim() || params.defaultAgentName;
                if (preparationStatusOption) {
                    await this.issueRepository.updateStatus(project, issue, preparationStatusOption.id);
                }
                const logFilePathArg = params.logFilePath
                    ? `--logFilePath ${params.logFilePath}`
                    : '';
                await this.localCommandRunner.runCommand(`aw ${issue.url} ${agent} ${params.projectUrl}${logFilePathArg ? ` ${logFilePathArg}` : ''}`);
                updatedCurrentPreparationIssueCount++;
            }
        };
        this.createStoryObjectMap = (input) => {
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
        this.createWorkflowBlockerIssues = (storyObjectMap) => {
            const workflowBlockerStory = Array.from(storyObjectMap.keys()).filter((storyName) => storyName.toLowerCase().includes('workflow blocker'));
            if (workflowBlockerStory.length === 0) {
                return [];
            }
            const result = storyObjectMap
                .get(workflowBlockerStory[0])
                ?.issues.filter((issue) => issue.state === 'OPEN')
                .map((issue) => {
                const orgRepo = issue.url.split('/issues')[0].split('github.com/')[1];
                return {
                    orgRepo,
                    blockerIssueUrls: [issue.url],
                };
            }) || [];
            return result;
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map