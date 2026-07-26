import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { StoryObjectMap } from '../../../domain/entities/StoryObjectMap';
export declare class GetStoryObjectMapUseCaseHandler {
    handle: (configFilePath: string, _verbose: boolean) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        storyObjectMap: StoryObjectMap;
    }>;
}
//# sourceMappingURL=GetStoryObjectMapUseCaseHandler.d.ts.map