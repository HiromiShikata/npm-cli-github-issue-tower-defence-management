import type { IssueRepository } from './adapter-interfaces/IssueRepository';
type CliErrorReportRepository = Pick<IssueRepository, 'searchIssue' | 'createNewIssue' | 'createCommentByUrl'>;
export declare class CliErrorReportUseCase {
    private readonly issueRepository;
    constructor(issueRepository: CliErrorReportRepository);
    run: (params: {
        error: unknown;
        owner: string;
        repo: string;
        commandLine: string;
    }) => Promise<void>;
}
export {};
//# sourceMappingURL=CliErrorReportUseCase.d.ts.map