import { Issue, Label } from '../../entities/Issue';
import { Project } from '../../entities/Project';
import { Member } from '../../entities/Member';

export interface IssueRepository {
  getAllIssues: (projectId: Project['id']) => Promise<Issue[]>;
  createNewIssue: (
    org: string,
    repo: string,
    title: string,
    body: string,
    assignees: Member['name'][],
    labels: Label[],
  ) => Promise<void>;
}
