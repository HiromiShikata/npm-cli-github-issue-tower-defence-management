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
    url: string;
    assignees: Member['name'][];
    workingTimeline: WorkingTime[];
    labels: Label[];
    org: string;
    repo: string;
    body: string;
    itemId: string;
    isPr: boolean;
};
//# sourceMappingURL=Issue.d.ts.map