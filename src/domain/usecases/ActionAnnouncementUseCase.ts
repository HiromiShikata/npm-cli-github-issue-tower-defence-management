import { Issue } from '../entities/Issue';
import { Member } from '../entities/Member';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';

export class ActionAnnouncementUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'createNewIssue' | 'updateIssue'
    >,
  ) {}

  run = async (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    members: Member['name'][];
    manager: Member['name'];
  }): Promise<void> => {
    if (input.cacheUsed || input.targetDates.length === 0) {
      return;
    }
    const now = input.targetDates[input.targetDates.length - 1];
    const isTargetIssue = (issue: Issue): boolean => {
      return (
        issue.labels.includes('action:announcement') &&
        (issue.nextActionDate === null ||
          issue.nextActionDate.getTime() <= now.getTime()) &&
        issue.state === 'OPEN'
      );
    };
    const actionAnnouncementIssues = input.issues.filter((issue) =>
      isTargetIssue(issue),
    );
    for (const issue of actionAnnouncementIssues) {
      for (const member of input.members) {
        try {
          await this.issueRepository.createNewIssue(
            issue.org,
            issue.repo,
            `Announcement #${issue.number}: ${issue.title} / ${member}`,
            `Hi @${member},

Please take a look at the announcement in the issue ${issue.url} and take necessary actions :pray:
`,
            [member],
            [
              ...issue.labels.filter(
                (label) => label !== 'action:announcement',
              ),
              'story:workflow-management',
            ],
          );
        } catch (e) {
          await this.issueRepository.createNewIssue(
            issue.org,
            issue.repo,
            `Error occured while creating working report for ${member}`,
            `${JSON.stringify(e)}`,
            [input.manager],
            ['bug'],
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      await this.issueRepository.updateIssue({
        ...issue,
        labels: issue.labels
          .filter((label) => label !== 'action:announcement')
          .concat('announcement'),
      });
    }
  };
}
