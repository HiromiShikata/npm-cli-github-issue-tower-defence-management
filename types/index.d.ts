import { getStoryObjectMap } from './adapter/entry-points/function/getStoryObjectMap';
export declare const hello: (name: string) => string;
export { Project } from './domain/entities/Project';
export { Issue } from './domain/entities/Issue';
export declare const scheduledEvent: (configFilePath: string, verbose: boolean) => Promise<{
    project: import("./domain/entities/Project").Project;
    issues: import("./domain/entities/Issue").Issue[];
    cacheUsed: boolean;
    targetDateTimes: Date[];
}>;
export { getStoryObjectMap };
export { StoryObject, StoryObjectMap, } from './domain/usecases/GetStoryObjectMapUseCase';
//# sourceMappingURL=index.d.ts.map