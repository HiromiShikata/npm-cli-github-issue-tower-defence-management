import { type Project } from '../../../domain/entities/Project';
import type { IssueAttachmentRepository } from '../../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import type { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
export declare const AWAITING_WORKSPACE_STATUS_NAME = "awaiting workspace";
export declare const CONFLICT_RETURNED_MESSAGE = "Auto Status Check: CONFLICT\nThis pull request has a merge conflict and has been returned to Awaiting Workspace.";
export declare const IN_TMUX_BY_HUMAN_STATUS_NAME = "in tmux by human";
export declare const CHORE_LABEL_NAME = "chore";
export type ConsoleProjectBinding = {
    pjcode: string;
    project: Project;
};
export type ConsoleProjectResolver = (pjcode: string) => Promise<ConsoleProjectBinding | null>;
export type ConsolePjcodeValidator = (pjcode: string) => boolean;
export type ConsoleIssueRepositoryResolver = (issueOrPullRequestUrl: string) => IssueRepository;
export type ConsoleProjectRepositoryResolver = (projectUrl: string) => Pick<ProjectRepository, 'updateStoryList'>;
export type ConsoleOperationContext = {
    resolveIssueRepository: ConsoleIssueRepositoryResolver;
    resolveProject: ConsoleProjectResolver;
    isPjcodeConfigured: ConsolePjcodeValidator;
    consoleDataOutputDir: string | null;
    issueAttachmentRepository: IssueAttachmentRepository | null;
    resolveProjectRepository: ConsoleProjectRepositoryResolver | null;
    invalidateProject: ((pjcode: string) => void) | null;
    updateProjectCacheEntry: ((pjcode: string, updatedProject: Project) => void) | null;
};
export type ConsoleOperationResponse = {
    statusCode: number;
    body: unknown;
};
export declare const handleReview: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleTriage: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleComment: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleAttachmentUpload: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleCreateIssue: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleReviewComment: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleStoryColor: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleIntmux: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleReorderStory: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleStoryAdd: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleDeleteAllComments: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
//# sourceMappingURL=consoleOperationApi.d.ts.map