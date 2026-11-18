import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { SearchedIssue } from '../entities/SearchedIssue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Member } from '../entities/Member';
import {
  issueAddableByProjectScope,
  ProjectRepositoryScope,
} from '../services/projectRepositoryScope';

export class AssignNoAssigneeIssueToManagerUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      | 'updateAssigneeList'
      | 'searchIssues'
      | 'addIssueToProject'
      | 'isRepositoryArchived'
    >,
  ) {}

  run = async (input: {
    issues: Issue[];
    manager: Member['name'];
    cacheUsed: boolean;
    autoAssignManagerAuthors?: string[] | null;
    projectToAddSearchedIssues?: Project | null;
    queryToAddProjectEnabled?: boolean | null;
    queryToAddProject?: string | null;
    queryToAddManagerAssignedIssues?: string | null;
    projectScope?: ProjectRepositoryScope | null;
  }): Promise<void> => {
    const authorAllowList =
      input.autoAssignManagerAuthors &&
      input.autoAssignManagerAuthors.length > 0
        ? input.autoAssignManagerAuthors
        : null;
    const isAssignable = (target: {
      assignees: Member['name'][];
      state: Issue['state'];
      author: string;
      isRepoArchived?: boolean;
    }): boolean => {
      if (target.isRepoArchived) {
        return false;
      }
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
      await this.assignManager(issue, issue.url, input.manager);
    }
    const project = input.projectToAddSearchedIssues;
    const query = input.queryToAddProject;
    const projectItemUrls = new Set(input.issues.map((issue) => issue.url));
    if (project && input.queryToAddManagerAssignedIssues) {
      await this.addManagerAssignedIssuesToProject({
        project,
        query: input.queryToAddManagerAssignedIssues,
        manager: input.manager,
        projectItemUrls,
        projectScope: input.projectScope ?? null,
      });
    }
    if (!input.queryToAddProjectEnabled || !project || !query) {
      return;
    }
    const searchedIssues = await this.searchIssues(query);
    for (const searchedIssue of searchedIssues) {
      if (
        projectItemUrls.has(searchedIssue.url) ||
        !isAssignable(searchedIssue)
      ) {
        continue;
      }
      if (
        input.projectScope &&
        !issueAddableByProjectScope(
          { owner: searchedIssue.org, repo: searchedIssue.repo },
          input.projectScope,
        )
      ) {
        continue;
      }
      if (
        !searchedIssue.isPr &&
        !(await this.addToProject(project, searchedIssue))
      ) {
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

  private addManagerAssignedIssuesToProject = async (input: {
    project: Project;
    query: string;
    manager: Member['name'];
    projectItemUrls: Set<string>;
    projectScope: ProjectRepositoryScope | null;
  }): Promise<void> => {
    const searchedIssues = await this.searchIssues(input.query);
    const archivedByRepository = new Map<string, boolean>();
    for (const searchedIssue of searchedIssues) {
      if (
        input.projectItemUrls.has(searchedIssue.url) ||
        searchedIssue.isPr ||
        searchedIssue.state !== 'OPEN' ||
        !searchedIssue.assignees.includes(input.manager)
      ) {
        continue;
      }
      if (searchedIssue.author !== input.manager) {
        console.log(
          `Skipped issue ${searchedIssue.url}: author ${searchedIssue.author} is not ${input.manager}`,
        );
        continue;
      }
      if (
        input.projectScope &&
        !issueAddableByProjectScope(
          { owner: searchedIssue.org, repo: searchedIssue.repo },
          input.projectScope,
        )
      ) {
        console.log(
          `Skipped issue ${searchedIssue.url}: repository ${searchedIssue.org}/${searchedIssue.repo} is outside the project scope`,
        );
        continue;
      }
      const repositoryKey = `${searchedIssue.org}/${searchedIssue.repo}`;
      let isArchived = archivedByRepository.get(repositoryKey);
      if (isArchived === undefined) {
        const fetched = await this.fetchRepositoryArchived(
          searchedIssue.url,
          searchedIssue.org,
          searchedIssue.repo,
        );
        if (fetched === null) {
          continue;
        }
        isArchived = fetched;
        archivedByRepository.set(repositoryKey, fetched);
      }
      if (isArchived) {
        continue;
      }
      await this.addToProject(input.project, searchedIssue);
      await this.waitBeforeNextRequest();
    }
  };

  private fetchRepositoryArchived = async (
    issueUrl: string,
    org: string,
    repo: string,
  ): Promise<boolean | null> => {
    try {
      return await this.issueRepository.isRepositoryArchived(org, repo);
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      console.error(
        `Failed to check whether repository of ${issueUrl} is archived: ${e.message}`,
      );
      return null;
    }
  };

  private searchIssues = async (query: string): Promise<SearchedIssue[]> => {
    try {
      return await this.issueRepository.searchIssues(query);
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      console.error(`Failed to search issues by ${query}: ${e.message}`);
      return [];
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
