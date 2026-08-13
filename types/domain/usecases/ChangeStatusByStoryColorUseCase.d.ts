import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { Member } from '../entities/Member';
export declare class ChangeStatusByStoryColorUseCase {
    readonly dateRepository: Pick<DateRepository, 'now'>;
    readonly issueRepository: Pick<IssueRepository, 'updateStatus' | 'createComment'>;
    constructor(dateRepository: Pick<DateRepository, 'now'>, issueRepository: Pick<IssueRepository, 'updateStatus' | 'createComment'>);
    run: (input: {
        project: Project;
        cacheUsed: boolean;
        org: string;
        repo: string;
        storyObjectMap: StoryObjectMap;
        manager: Member["name"];
    }) => Promise<void>;
}
//# sourceMappingURL=ChangeStatusByStoryColorUseCase.d.ts.map