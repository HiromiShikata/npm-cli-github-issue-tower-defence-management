import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { SearchedIssue } from '../entities/SearchedIssue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Member } from '../entities/Member';

export class AssignNoAssigneeIssueToManagerUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'updateAssigneeList' | 'searchIssues' | 'addIssueToProject'
    >,
  ) {}

  run = async (input: {
    issues: Issue[];
    manager: Member['name'];
    cacheUsed: boolean;
    autoAssignManagerAuthors?: string[] | null;
    projectToAddSearchedIssues?: Project | null;
    queryToAddProject?: string | null;
  }): Promise<void> => {
    if (input.cacheUsed) {
      return;
    }
    const authorAllowList =
      input.autoAssignManagerAuthors &&
      input.autoAssignManagerAuthors.length > 0
        ? input.autoAssignManagerAuthors
        : null;
    const isAssignable = (target: {
      assignees: Member['name'][];
      state: Issue['state'];
      author: string;
    }): boolean => {
      if (target.assignees.length > 0 || target.state !== 'OPEN') {
        return false;
      }
      return (
        authorAllowList === null || authorAllowList.includes(target.author)
      );
    };
    for (const issue of input.issues) {
      if (!isAssignable(issue)) {
        continue;
      }
      if (!(await this.assignManager(issue, issue.url, input.manager))) {
        continue;
      }
      await this.waitBeforeNextRequest();
    }
    const project = input.projectToAddSearchedIssues;
    const query = input.queryToAddProject;
    if (!project || !query) {
      return;
    }
    const projectItemUrls = new Set(input.issues.map((issue) => issue.url));
    const searchedIssues = await this.issueRepository.searchIssues(query);
    for (const searchedIssue of searchedIssues) {
      if (
        projectItemUrls.has(searchedIssue.url) ||
        !isAssignable(searchedIssue)
      ) {
        continue;
      }
      if (!(await this.addToProject(project, searchedIssue))) {
        continue;
      }
      if (
        !(await this.assignManager(
          {
            org: searchedIssue.org,
            repo: searchedIssue.repo,
            number: searchedIssue.number,
          },
          searchedIssue.url,
          input.manager,
        ))
      ) {
        continue;
      }
      await this.waitBeforeNextRequest();
    }
  };

  private addToProject = async (
    project: Project,
    searchedIssue: SearchedIssue,
  ): Promise<boolean> => {
    try {
      await this.issueRepository.addIssueToProject(project, searchedIssue.url);
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      console.error(
        `Failed to add issue ${searchedIssue.url} to project: ${e.message}`,
      );
      return false;
    }
    return true;
  };

  private assignManager = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
    issueUrl: string,
    manager: Member['name'],
  ): Promise<boolean> => {
    try {
      await this.issueRepository.updateAssigneeList(issue, [manager]);
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      console.error(
        `Failed to update assignee for issue ${issueUrl}: ${e.message}`,
      );
      return false;
    }
    return true;
  };

  private waitBeforeNextRequest = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };
}
