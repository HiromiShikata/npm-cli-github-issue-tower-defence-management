import { Project } from '../../domain/entities/Project';
import { StatusDefaultRepository } from '../../domain/usecases/adapter-interfaces/StatusDefaultRepository';
export declare class BrowserGitHubProjectRepository implements Pick<StatusDefaultRepository, 'setStatusFieldDefault'> {
    private readonly username;
    private readonly password;
    private readonly totpSecret;
    constructor(username: string | undefined, password: string | undefined, totpSecret: string | undefined);
    setStatusFieldDefault: (project: Project, optionId: string) => Promise<void>;
}
//# sourceMappingURL=BrowserGitHubProjectRepository.d.ts.map