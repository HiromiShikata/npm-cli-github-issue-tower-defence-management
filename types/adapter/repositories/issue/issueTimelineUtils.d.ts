import { WorkingTime } from '../../../domain/entities/WorkingTime';
export type IssueStatusTimeline = {
    time: string;
    author: string;
    from: string;
    to: string;
};
export type IssueInProgressTimeline = WorkingTime & {
    issueUrl: string;
};
export declare const getInProgressTimeline: (timelines: IssueStatusTimeline[], issueUrl: string) => Promise<WorkingTime[]>;
//# sourceMappingURL=issueTimelineUtils.d.ts.map