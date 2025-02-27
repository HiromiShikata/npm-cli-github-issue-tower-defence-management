import { WorkingTime } from './WorkingTime';
import { Member } from './Member';
export type Label = string;
export type Issue = {
    nameWithOwner: string;
    number: number;
    title: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    status: string | null;
    story: string | null;
    nextActionDate: Date | null;
    nextActionHour: number | null;
    estimationMinutes: number | null;
    dependedIssueUrls: string[];
    completionDate50PercentConfidence: Date | null;
    url: string;
    assignees: Member['name'][];
    workingTimeline: WorkingTime[];
    labels: Label[];
    org: string;
    repo: string;
    body: string;
    itemId: string;
    isPr: boolean;
    isInProgress: boolean;
    isClosed: boolean;
    createdAt: Date;
};
//# sourceMappingURL=Issue.d.ts.map