import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
export declare const AWAITING_WORKSPACE_STATUS_NAME = "awaiting workspace";
export declare const IN_TMUX_BY_HUMAN_STATUS_NAME = "in tmux by human";
export type ConsoleProjectBinding = {
    pjcode: string;
    project: Project;
};
export type ConsoleProjectResolver = (pjcode: string) => Promise<ConsoleProjectBinding | null>;
export type ConsoleOperationContext = {
    issueRepository: IssueRepository;
    resolveProject: ConsoleProjectResolver;
    consoleDataOutputDir: string | null;
};
export type ConsoleOperationResponse = {
    statusCode: number;
    body: unknown;
};
export declare const handleReview: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleTriage: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleComment: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleReviewComment: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
export declare const handleIntmux: (context: ConsoleOperationContext, body: Record<string, unknown>) => Promise<ConsoleOperationResponse>;
//# sourceMappingURL=consoleOperationApi.d.ts.map