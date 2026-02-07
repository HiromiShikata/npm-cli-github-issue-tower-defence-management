"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetStoryObjectMapUseCase = exports.ProjectNotFoundError = void 0;
class ProjectNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProjectNotFoundError';
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
class GetStoryObjectMapUseCase {
    constructor(projectRepository, issueRepository) {
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
            const { issues, cacheUsed } = await this.issueRepository.getAllIssues(projectId, input.allowIssueCacheMinutes);
            const storyObjectMap = this.createStoryObjectMap({
                project,
                issues,
            });
            return { project, issues, cacheUsed, storyObjectMap };
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
    }
}
exports.GetStoryObjectMapUseCase = GetStoryObjectMapUseCase;
//# sourceMappingURL=GetStoryObjectMapUseCase.js.map