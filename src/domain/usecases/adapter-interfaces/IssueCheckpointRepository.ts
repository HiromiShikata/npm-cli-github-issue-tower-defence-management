export interface IssueCheckpointRepository {
  postCheckpoint(issueUrl: string): Promise<void>;
}
