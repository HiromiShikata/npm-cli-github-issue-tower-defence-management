import { Issue, Label } from '../../entities/Issue';
import { FieldOption, Project } from '../../entities/Project';
import { Member } from '../../entities/Member';
export interface IssueRepository {
    getAllIssues: (projectId: Project['id'], allowCacheMinutes: number) => Promise<{
        issues: Issue[];
        cacheUsed: boolean;
    }>;
    getIssueByUrl: (url: string) => Promise<Issue | null>;
    createNewIssue: (org: string, repo: string, title: string, body: string, assignees: Member['name'][], labels: Label[]) => Promise<number>;
    updateIssue: (issue: Issue) => Promise<void>;
    updateNextActionDate: (project: Project & {
        nextActionDate: NonNullable<Project['nextActionDate']>;
    }, issue: Issue, date: Date) => Promise<void>;
    updateNextActionHour: (project: Project & {
        nextActionHour: NonNullable<Project['nextActionHour']>;
    }, issue: Issue, hour: number) => Promise<void>;
    updateProjectTextField: (project: Project, fieldId: string, issue: Issue, text: string) => Promise<void>;
    updateStory: (project: Project & {
        story: NonNullable<Project['story']>;
    }, issue: Issue, storyId: FieldOption['id']) => Promise<void>;
    updateStatus: (project: Project, issue: Issue, statusId: string) => Promise<void>;
    clearProjectField: (project: Project, fieldId: string, issue: Issue) => Promise<void>;
    createComment: (issue: Issue, commentBody: string) => Promise<void>;
    updateLabels: (issue: Issue, labels: Issue['labels']) => Promise<void>;
}
//# sourceMappingURL=IssueRepository.d.ts.map