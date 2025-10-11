import { BaseGitHubRepository } from './BaseGitHubRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
export declare class CheerioProjectRepository extends BaseGitHubRepository implements Pick<ProjectRepository, 'updateStoryList'> {
    readonly localStorageRepository: LocalStorageRepository;
    readonly jsonFilePath: string;
    readonly ghToken: string;
    readonly ghUserName: string | undefined;
    readonly ghUserPassword: string | undefined;
    readonly ghAuthenticatorKey: string | undefined;
    constructor(localStorageRepository: LocalStorageRepository, jsonFilePath?: string, ghToken?: string, ghUserName?: string | undefined, ghUserPassword?: string | undefined, ghAuthenticatorKey?: string | undefined);
    updateStoryList: (project: Project, newStoryList: (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[]) => Promise<FieldOption[]>;
}
//# sourceMappingURL=CheerioProjectRepository.d.ts.map