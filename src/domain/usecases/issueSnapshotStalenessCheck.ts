import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export type IssueSnapshotCheckedFieldName = keyof Pick<
  Issue,
  'story' | 'status' | 'agent' | 'state' | 'stateReason' | 'isClosed'
>;

export type IssueSnapshotStaleness =
  | { type: 'current'; liveIssue: Issue }
  | {
      type: 'stale';
      liveIssue: Issue;
      changedFieldNames: IssueSnapshotCheckedFieldName[];
    }
  | { type: 'removedFromProject' };

export const issueSnapshotStalenessCheck = async (params: {
  issueRepository: Pick<IssueRepository, 'get'>;
  project: Project;
  snapshotIssue: Issue;
  checkedFieldNames: IssueSnapshotCheckedFieldName[];
  skippedWriteDescription: string;
}): Promise<IssueSnapshotStaleness> => {
  const { snapshotIssue } = params;
  const liveIssue = await params.issueRepository.get(
    snapshotIssue.url,
    params.project,
  );
  if (liveIssue === null) {
    console.warn(
      `Skipping ${params.skippedWriteDescription} for ${snapshotIssue.url} because the item is no longer on project ${params.project.url}.`,
    );
    return { type: 'removedFromProject' };
  }
  const changedFieldNames = params.checkedFieldNames.filter(
    (fieldName) => liveIssue[fieldName] !== snapshotIssue[fieldName],
  );
  if (changedFieldNames.length === 0) {
    return { type: 'current', liveIssue };
  }
  const changeDescriptions = changedFieldNames.map(
    (fieldName) =>
      `${fieldName} changed from ${JSON.stringify(snapshotIssue[fieldName])} to ${JSON.stringify(liveIssue[fieldName])}`,
  );
  console.warn(
    `Skipping ${params.skippedWriteDescription} for ${snapshotIssue.url} because ${changeDescriptions.join(', ')} after the item snapshot was taken.`,
  );
  return { type: 'stale', liveIssue, changedFieldNames };
};
