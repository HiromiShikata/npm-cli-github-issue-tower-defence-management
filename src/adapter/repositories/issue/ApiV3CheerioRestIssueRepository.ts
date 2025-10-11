import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import {
  CheerioIssueRepository,
  Issue as CheerioIssue,
} from './CheerioIssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import {
  GraphqlProjectItemRepository,
  ProjectItem,
} from './GraphqlProjectItemRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import typia from 'typia';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { normalizeFieldName } from '../utils';
import { LocalStorageRepository } from '../LocalStorageRepository';

export class ApiV3CheerioRestIssueRepository
  extends BaseGitHubRepository
  implements IssueRepository
{
  constructor(
    readonly apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>,
    readonly cheerioIssueRepository: Pick<
      CheerioIssueRepository,
      'getIssue' | 'refreshCookie'
    >,
    readonly restIssueRepository: Pick<
      RestIssueRepository,
      | 'createNewIssue'
      | 'updateIssue'
      | 'createComment'
      | 'getIssue'
      | 'updateLabels'
    >,
    readonly graphqlProjectItemRepository: Pick<
      GraphqlProjectItemRepository,
      | 'fetchProjectItems'
      | 'fetchProjectItemByUrl'
      | 'updateProjectField'
      | 'clearProjectField'
      | 'updateProjectTextField'
    >,
    readonly localStorageCacheRepository: Pick<
      LocalStorageCacheRepository,
      'getLatest' | 'set'
    >,
    readonly localStorageRepository: LocalStorageRepository,
    readonly jsonFilePath: string = './tmp/github.com.cookies.json',
    readonly ghToken: string = process.env.GH_TOKEN || 'dummy',
    readonly ghUserName: string | undefined = process.env.GH_USER_NAME,
    readonly ghUserPassword: string | undefined = process.env.GH_USER_PASSWORD,
    readonly ghAuthenticatorKey: string | undefined = process.env
      .GH_AUTHENTICATOR_KEY,
  ) {
    super(
      localStorageRepository,
      jsonFilePath,
      ghToken,
      ghUserName,
      ghUserPassword,
      ghAuthenticatorKey,
    );
  }

  updateStatus: (
    project: Project,
    issue: Issue,
    statusId: string,
  ) => Promise<void> = async (project, issue, statusId) => {
    await this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.status.fieldId,
      issue.itemId,
      { singleSelectOptionId: statusId },
    );
  };

  convertProjectItemAndCheerioIssueToIssue = async (
    item: ProjectItem,
    cheerioIssue: CheerioIssue,
  ): Promise<Issue> => {
    const timeline: WorkingTime[] = cheerioIssue.inProgressTimeline;
    const nextActionDate = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'nextactiondate',
    )?.value;
    const nextActionHour = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'nextactionhour',
    )?.value;
    const estimationMinutes = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'estimationminutes',
    )?.value;
    const dependedIssueUrls =
      item.customFields
        .find((field) =>
          normalizeFieldName(field.name).startsWith('dependedissueurls'),
        )
        ?.value?.split(',') || [];
    const completionDate50PercentConfidence = item.customFields.find((field) =>
      normalizeFieldName(field.name).startsWith('completiondate50'),
    )?.value;
    const story = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'story',
    )?.value;
    const status = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'status',
    )?.value;
    const { owner, repo } = this.extractIssueFromUrl(item.url);
    const restIssueData = await this.restIssueRepository.getIssue(item.url);

    return {
      nameWithOwner: item.nameWithOwner,
      url: item.url,
      title: item.title,
      number: item.number,
      state: item.state,
      labels: cheerioIssue.labels,
      assignees: cheerioIssue.assignees,
      workingTimeline: timeline,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
      nextActionHour: nextActionHour ? parseInt(nextActionHour) : null,
      estimationMinutes: estimationMinutes ? parseInt(estimationMinutes) : null,
      dependedIssueUrls: dependedIssueUrls,
      completionDate50PercentConfidence: completionDate50PercentConfidence
        ? new Date(completionDate50PercentConfidence)
        : null,
      status: status || null,
      story: story || null,
      org: owner,
      repo: repo,
      body: item.body,
      itemId: item.id,
      isPr: item.url.includes('/pull/'),
      isInProgress: normalizeFieldName(cheerioIssue.status).includes(
        'progress',
      ),
      isClosed: item.state !== 'OPEN',
      createdAt: new Date(restIssueData.created_at || '2000-01-01'),
    };
  };
  getAllIssuesFromCache = async (
    cacheKey: string,
    allowCacheMinutes: number,
  ): Promise<Issue[] | null> => {
    const cache = await this.localStorageCacheRepository.getLatest(cacheKey);
    if (cache) {
      const now = new Date();
      const cacheTimestamp = cache.timestamp;
      const diff = now.getTime() - cacheTimestamp.getTime();
      if (diff < allowCacheMinutes * 60 * 1000) {
        if (!Array.isArray(cache.value)) {
          return null;
        }
        const issues = cache.value
          .filter(
            (issue: unknown): issue is object => typeof issue === 'object',
          )
          .map((issue: object): object => {
            const nextActionDate =
              !('nextActionDate' in issue) ||
              typeof issue.nextActionDate !== 'string' ||
              issue.nextActionDate === null
                ? null
                : new Date(issue.nextActionDate);
            const workingTimeline =
              !('workingTimeline' in issue) ||
              !Array.isArray(issue.workingTimeline)
                ? []
                : issue.workingTimeline.map((event: object): object => {
                    const startedAt =
                      !('startedAt' in event) ||
                      typeof event.startedAt !== 'string' ||
                      event.startedAt === null
                        ? null
                        : new Date(event.startedAt);
                    const endedAt =
                      !('endedAt' in event) ||
                      typeof event.endedAt !== 'string' ||
                      event.endedAt === null
                        ? null
                        : new Date(event.endedAt);
                    return {
                      ...event,
                      startedAt,
                      endedAt,
                    };
                  });
            const completionDate50PercentConfidence =
              !('completionDate50PercentConfidence' in issue) ||
              typeof issue.completionDate50PercentConfidence !== 'string'
                ? null
                : new Date(issue.completionDate50PercentConfidence);
            const createdAt =
              !('createdAt' in issue) || typeof issue.createdAt !== 'string'
                ? new Date() // Fallback to current date if missing
                : new Date(issue.createdAt);

            return {
              ...issue,
              nextActionDate: nextActionDate,
              workingTimeline: workingTimeline,
              completionDate50PercentConfidence:
                completionDate50PercentConfidence,
              createdAt: createdAt,
            };
          });

        if (typia.is<Issue[]>(issues)) {
          return issues;
        }
      }
    }
    return null;
  };

  getAllIssues = async (
    projectId: Project['id'],
    allowCacheMinutes: number,
  ): Promise<{
    issues: Issue[];
    cacheUsed: boolean;
  }> => {
    const cacheKey = `allIssues-${projectId}`;
    const cachedIssues = await this.getAllIssuesFromCache(
      cacheKey,
      allowCacheMinutes,
    );
    if (cachedIssues) {
      return { issues: cachedIssues, cacheUsed: true };
    }
    const issues = await this.getAllIssuesFromGitHub(projectId);
    await this.localStorageCacheRepository.set(cacheKey, issues);
    return { issues, cacheUsed: false };
  };
  getAllIssuesFromGitHub = async (
    projectId: Project['id'],
  ): Promise<Issue[]> => {
    const items =
      await this.graphqlProjectItemRepository.fetchProjectItems(projectId);

    const processItemsInBatches = async (
      items: ProjectItem[],
      batchSize: number,
    ): Promise<Issue[]> => {
      let result: Issue[] = [];
      await this.cheerioIssueRepository.refreshCookie();

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const issues = await Promise.all(
          batch.map(async (item): Promise<Issue> => {
            const cheerioIssue = await this.cheerioIssueRepository.getIssue(
              item.url,
            );
            return this.convertProjectItemAndCheerioIssueToIssue(
              item,
              cheerioIssue,
            );
          }),
        );
        result = result.concat(issues);
      }

      return result;
    };
    const issues = await processItemsInBatches(items, 10);

    // const issues = await Promise.all(
    //   items.map(async (item): Promise<Issue> => {
    //     const cheerioIssue = await this.cheerioIssueRepository.getIssue(
    //       item.url,
    //     );
    //     return this.convertProjectItemAndCheerioIssueToIssue(
    //       item,
    //       cheerioIssue,
    //     );
    //   }),
    // );
    // const issues: Issue[] = [];
    // for (const item of items) {
    //   const cheerioIssue = await this.cheerioIssueRepository.getIssue(item.url);
    //   issues.push(
    //     await this.convertProjectItemAndCheerioIssueToIssue(item, cheerioIssue),
    //   );
    // }
    return issues;
  };
  createNewIssue = async (
    org: string,
    repo: string,
    title: string,
    body: string,
    assignees: string[],
    labels: string[],
  ): Promise<number> => {
    return await this.restIssueRepository.createNewIssue(
      org,
      repo,
      title,
      body,
      assignees,
      labels,
    );
  };
  updateIssue = async (issue: Issue): Promise<void> => {
    await this.restIssueRepository.updateIssue(issue);
  };
  getIssueByUrl = async (url: string): Promise<Issue | null> => {
    const projectItem =
      await this.graphqlProjectItemRepository.fetchProjectItemByUrl(url);
    if (!projectItem) {
      return null;
    }
    const cheerioIssue = await this.cheerioIssueRepository.getIssue(url);
    return this.convertProjectItemAndCheerioIssueToIssue(
      projectItem,
      cheerioIssue,
    );
  };
  updateNextActionDate = async (
    project: Project & { nextActionDate: Required<Project['nextActionDate']> },
    issue: Issue,
    date: Date,
  ): Promise<void> => {
    if (project.nextActionDate === null) {
      throw new Error('nextActionDate is not defined');
    }
    return this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.nextActionDate.fieldId,
      issue.itemId,
      { date: date.toISOString() },
    );
  };
  updateNextActionHour = async (
    project: Project & {
      nextActionHour: NonNullable<Project['nextActionHour']>;
    },
    issue: Issue,
    hour: number,
  ): Promise<void> => {
    return this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.nextActionHour.fieldId,
      issue.itemId,
      { number: hour },
    );
  };
  updateStory = async (
    project: Project & { story: NonNullable<Project['story']> },
    issue: Issue,
    storyOptionId: string,
  ): Promise<void> => {
    await this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.story.fieldId,
      issue.itemId,
      { singleSelectOptionId: storyOptionId },
    );
  };
  clearProjectField = async (
    project: Project,
    fieldId: string,
    issue: Issue,
  ): Promise<void> => {
    await this.graphqlProjectItemRepository.clearProjectField(
      project.id,
      fieldId,
      issue.itemId,
    );
    return;
  };
  createComment = async (issue: Issue, comment: string): Promise<void> => {
    await this.restIssueRepository.createComment(issue.url, comment);
  };
  updateProjectTextField = async (
    project: Project,
    fieldId: string,
    issue: Issue,
    text: string,
  ): Promise<void> => {
    await this.graphqlProjectItemRepository.updateProjectTextField(
      project.id,
      fieldId,
      issue.itemId,
      text,
    );
  };

  updateLabels = (issue: Issue, labels: Issue['labels']): Promise<void> => {
    return this.restIssueRepository.updateLabels(issue, labels);
  };
}
