import { IssueCheckpointRepository } from '../../domain/usecases/adapter-interfaces/IssueCheckpointRepository';
export declare class GitHubIssueCheckpointRepository implements IssueCheckpointRepository {
    private readonly ghToken;
    constructor(ghToken: string);
    postCheckpoint: (issueUrl: string) => Promise<void>;
    private parseIssueUrl;
}
//# sourceMappingURL=GitHubIssueCheckpointRepository.d.ts.map