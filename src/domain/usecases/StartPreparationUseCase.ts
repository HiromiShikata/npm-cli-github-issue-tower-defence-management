import { Issue } from '../entities/Issue';
import { Project, StoryOption } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';

export type StoryObject = {
  story: StoryOption;
  storyIssue: Issue | null;
  issues: Issue[];
};
export type StoryObjectMap = Map<
  NonNullable<Project['story']>['stories'][0]['name'],
  StoryObject
>;

export class StartPreparationUseCase {
  constructor(
    readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    readonly issueRepository: Pick<
      IssueRepository,
      'getAllIssues' | 'updateStatus'
    >,
    readonly claudeRepository: Pick<ClaudeRepository, 'getUsage'>,
    readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    awaitingWorkspaceStatus: string;
    preparationStatus: string;
    defaultAgentName: string;
    logFilePath?: string;
    maximumPreparingIssuesCount: number | null;
    allowIssueCacheMinutes: number;
  }): Promise<void> => {
    try {
      const claudeUsages = await this.claudeRepository.getUsage();
      if (claudeUsages.some((usage) => usage.utilizationPercentage > 90)) {
        console.warn(
          'Claude usage limit exceeded. Skipping starting preparation.',
        );
        return;
      }
    } catch (error) {
      console.warn('Failed to check Claude usage:', error);
    }

    const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;
    const projectId = await this.projectRepository.findProjectIdByUrl(
      params.projectUrl,
    );
    if (!projectId) {
      throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new Error(
        `Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`,
      );
    }
    const { issues }: { issues: Issue[] } =
      await this.issueRepository.getAllIssues(
        projectId,
        params.allowIssueCacheMinutes,
      );
    const storyObjectMap: StoryObjectMap = this.createStoryObjectMap({
      project,
      issues,
    });

    const repositoryBlockerIssues =
      this.createWorkflowBlockerIssues(storyObjectMap);

    const awaitingWorkspaceIssues: Issue[] = Array.from(storyObjectMap.values())
      .map((storyObject: StoryObject) => storyObject.issues)
      .flat()
      .filter(
        (issue: Issue) => issue.status === params.awaitingWorkspaceStatus,
      );
    const currentPreparationIssueCount = issues.filter(
      (issue: Issue) => issue.status === params.preparationStatus,
    ).length;
    let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;

    const preparationStatusOption = project.status.statuses.find(
      (s) => s.name === params.preparationStatus,
    );

    for (
      let i = 0;
      i < awaitingWorkspaceIssues.length &&
      updatedCurrentPreparationIssueCount < maximumPreparingIssuesCount;
      i++
    ) {
      const issue = awaitingWorkspaceIssues[i];
      const blockerIssueUrls: string[] =
        repositoryBlockerIssues.find((blocker) =>
          issue.url.includes(blocker.orgRepo),
        )?.blockerIssueUrls || [];
      if (
        blockerIssueUrls.length > 0 &&
        !blockerIssueUrls.includes(issue.url)
      ) {
        continue;
      }
      const agent =
        issue.labels
          .find((label) => label.startsWith('category:'))
          ?.replace('category:', '')
          .trim() || params.defaultAgentName;

      if (preparationStatusOption) {
        await this.issueRepository.updateStatus(
          project,
          issue,
          preparationStatusOption.id,
        );
      }

      const logFilePathArg = params.logFilePath
        ? `--logFilePath ${params.logFilePath}`
        : '';
      await this.localCommandRunner.runCommand(
        `aw ${issue.url} ${agent} ${params.projectUrl}${logFilePathArg ? ` ${logFilePathArg}` : ''}`,
      );
      updatedCurrentPreparationIssueCount++;
    }
  };

  createStoryObjectMap = (input: {
    project: Project;
    issues: Issue[];
  }): StoryObjectMap => {
    const summaryStoryIssue: StoryObjectMap = new Map();
    const targetStory = input.project.story?.stories || [];
    for (const story of targetStory) {
      const storyIssue = input.issues.find((issue) =>
        story.name.startsWith(issue.title),
      );
      summaryStoryIssue.set(story.name, {
        story,
        storyIssue: storyIssue || null,
        issues: [],
      });
      for (const issue of input.issues) {
        if (issue.story !== story.name) {
          continue;
        }
        summaryStoryIssue.get(story.name)?.issues.push(issue);
      }
    }
    return summaryStoryIssue;
  };

  createWorkflowBlockerIssues = (
    storyObjectMap: StoryObjectMap,
  ): {
    orgRepo: string;
    blockerIssueUrls: string[];
  }[] => {
    const workflowBlockerStory: StoryObject['story']['name'][] = Array.from(
      storyObjectMap.keys(),
    ).filter((storyName) =>
      storyName.toLowerCase().includes('workflow blocker'),
    );
    if (workflowBlockerStory.length === 0) {
      return [];
    }

    const result: {
      orgRepo: string;
      blockerIssueUrls: string[];
    }[] =
      storyObjectMap
        .get(workflowBlockerStory[0])
        ?.issues.filter((issue) => issue.state === 'OPEN')
        .map((issue) => {
          const orgRepo = issue.url.split('/issues')[0].split('github.com/')[1];
          return {
            orgRepo,
            blockerIssueUrls: [issue.url],
          };
        }) || [];
    return result;
  };
}
