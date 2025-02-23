import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from './HandleScheduledEventUseCase';
export declare class ChangeStatusByStoryColorUseCase {
    readonly dateRepository: Pick<DateRepository, 'now'>;
    readonly issueRepository: Pick<IssueRepository, 'updateStatus' | 'createComment'>;
    constructor(dateRepository: Pick<DateRepository, 'now'>, issueRepository: Pick<IssueRepository, 'updateStatus' | 'createComment'>);
    run: (input: {
        project: Project;
        cacheUsed: boolean;
        org: string;
        repo: string;
        disabledStatus: string;
        storyObjectMap: StoryObjectMap;
    }) => Promise<void>;
}
//# sourceMappingURL=ChangeStatusByStoryColorUseCase.d.ts.map