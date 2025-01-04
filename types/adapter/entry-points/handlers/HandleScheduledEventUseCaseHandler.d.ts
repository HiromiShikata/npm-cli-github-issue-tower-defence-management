import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
export declare class HandleScheduledEventUseCaseHandler {
    handle: (configFilePath: string, verbose: boolean) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        targetDateTimes: Date[];
    }>;
}
//# sourceMappingURL=HandleScheduledEventUseCaseHandler.d.ts.map