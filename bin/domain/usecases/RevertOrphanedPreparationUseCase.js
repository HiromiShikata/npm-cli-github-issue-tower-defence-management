"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevertOrphanedPreparationUseCase = void 0;
class RevertOrphanedPreparationUseCase {
    constructor(projectRepository, issueRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.run = async (params) => {
            const projectId = await this.projectRepository.findProjectIdByUrl(params.projectUrl);
            if (!projectId) {
                throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
            }
            const project = await this.projectRepository.getProject(projectId);
            if (!project) {
                throw new Error(`Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`);
            }
            const { issues } = await this.issueRepository.getAllIssues(projectId, params.allowIssueCacheMinutes);
            const preparationIssues = issues.filter((issue) => issue.status === params.preparationStatus);
            const awaitingWorkspaceStatusOption = project.status.statuses.find((s) => s.name === params.awaitingWorkspaceStatus);
            if (!awaitingWorkspaceStatusOption) {
                return;
            }
            for (const issue of preparationIssues) {
                const command = params.preparationProcessCheckCommand.replace('{URL}', issue.url);
                const { exitCode } = await this.localCommandRunner.runCommand(command);
                if (exitCode !== 0) {
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    await this.issueRepository.createComment(issue, `Orphaned preparation detected: no live worker process found for ${issue.url}. Status reverted to ${params.awaitingWorkspaceStatus}.`);
                }
            }
        };
    }
}
exports.RevertOrphanedPreparationUseCase = RevertOrphanedPreparationUseCase;
//# sourceMappingURL=RevertOrphanedPreparationUseCase.js.map