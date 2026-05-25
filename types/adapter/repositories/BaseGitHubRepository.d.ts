import { LocalStorageRepository } from './LocalStorageRepository';
export declare class BaseGitHubRepository {
    readonly localStorageRepository: LocalStorageRepository;
    readonly ghToken: string;
    constructor(localStorageRepository: LocalStorageRepository, ghToken?: string);
    protected extractIssueFromUrl: (issueUrl: string) => {
        owner: string;
        repo: string;
        issueNumber: number;
        isIssue: boolean;
    };
}
//# sourceMappingURL=BaseGitHubRepository.d.ts.map