import { FieldOption, Project } from '../../entities/Project';
export interface ProjectRepository {
    findProjectIdByUrl: (projectUrl: string) => Promise<Project['id'] | null>;
    getProject: (projectId: Project['id']) => Promise<Project | null>;
    addNewStory: (projectId: Project, storyOption: (Omit<FieldOption, 'id'> & {
        id: FieldOption['id'] | null;
    })[]) => Promise<FieldOption[]>;
}
//# sourceMappingURL=ProjectRepository.d.ts.map