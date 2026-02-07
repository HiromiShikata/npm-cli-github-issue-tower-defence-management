import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { StoryObjectMap } from '../../../domain/usecases/GetStoryObjectMapUseCase';
export declare class GetStoryObjectMapUseCaseHandler {
    handle: (configFilePath: string, verbose: boolean) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        storyObjectMap: StoryObjectMap;
    }>;
}
//# sourceMappingURL=GetStoryObjectMapUseCaseHandler.d.ts.map