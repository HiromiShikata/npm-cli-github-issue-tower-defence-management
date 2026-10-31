import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class QualityCheckAdvanceUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'updateStatus' | 'get' | 'removeIssueFromProjectCache'
    >,
  ) {}

  run = async (_params: {
    project: Project;
    issues: Issue[];
    awaitingOwnerStatusName?: string;
    evaluatedAt?: Date;
  }): Promise<number> => 0;
}
