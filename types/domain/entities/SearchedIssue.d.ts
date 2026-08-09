import { Member } from './Member';
export type SearchedIssue = {
    url: string;
    org: string;
    repo: string;
    number: number;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    author: string;
    assignees: Member['name'][];
};
//# sourceMappingURL=SearchedIssue.d.ts.map