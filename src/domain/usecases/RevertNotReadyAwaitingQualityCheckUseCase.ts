import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { FieldOption } from '../entities/Project';

const STORY_COLOR_HEX_MAP: Record<FieldOption['color'], string> = {
  GRAY: '#6e7781',
  BLUE: '#0075ca',
  GREEN: '#0a8a47',
  YELLOW: '#d4a72c',
  ORANGE: '#e4660a',
  RED: '#cf222e',
  PINK: '#e85aad',
  PURPLE: '#8250df',
};

const extractPrRepoFromUrl = (prUrl: string): string => {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
  }
  return `${match[1]}/${match[2]}`;
};

const extractDirectoryFromFilePath = (filePath: string): string => {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash > 0 ? filePath.slice(0, lastSlash) : '.';
};

const extractChangedDirectories = (filePaths: string[]): string[] => {
  const dirs = new Set<string>();
  for (const filePath of filePaths) {
    dirs.add(extractDirectoryFromFilePath(filePath));
  }
  return Array.from(dirs);
};

type QualityCheckViewerItem = {
  issue: {
    number: number;
    title: string;
    author: string;
    url: string;
    story: string | null;
    projectItemId: string;
  };
  pr: {
    number: number | null;
    repo: string;
    title: string | null;
    additions: number | null;
    deletions: number | null;
    changedFiles: number | null;
    url: string;
  };
  changedDirectories: string[];
};

export type QualityCheckViewerOutput = {
  stories: {
    name: string;
    color: string;
    order: number;
  }[];
  items: QualityCheckViewerItem[];
};

export class RevertNotReadyAwaitingQualityCheckUseCase {
  private readonly issueRejectionEvaluator: IssueRejectionEvaluator;
  private readonly changeTargetPullRequestApprover: ChangeTargetPullRequestApprover;

  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'getAllIssues'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'getPullRequestChangedFilePaths'
      | 'approvePullRequest'
      | 'requestChangesWithInlineComment'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'createComment'
    >,
  ) {
    this.issueRejectionEvaluator = new IssueRejectionEvaluator(issueRepository);
    this.changeTargetPullRequestApprover = new ChangeTargetPullRequestApprover(
      issueRepository,
    );
  }

  run = async (params: {
    projectUrl: string;
    allowIssueCacheMinutes: number;
    labelsAsLlmAgentName?: string[] | null;
    awaitingQualityCheckViewerOutputPath?: string | null;
    donePrUrls?: Set<string> | null;
  }): Promise<QualityCheckViewerOutput | null> => {
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

    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      return null;
    }

    const { issues } = await this.issueRepository.getAllIssues(
      projectId,
      params.allowIssueCacheMinutes,
    );

    const awaitingQualityCheckIssues = issues.filter(
      (issue) => issue.status === AWAITING_QUALITY_CHECK_STATUS_NAME,
    );

    const viewerItems: QualityCheckViewerItem[] = [];

    for (const issue of awaitingQualityCheckIssues) {
      const hasLlmAgentLabel = issue.labels.some(
        (l) => l === 'llm-agent' || l.startsWith('llm-agent:'),
      );
      if (hasLlmAgentLabel) {
        continue;
      }

      const { rejections, approvedPrUrl, readyPr } =
        await this.issueRejectionEvaluator.evaluate(
          issue,
          params.labelsAsLlmAgentName ?? [],
        );
      if (rejections.length > 0) {
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
        await this.issueCommentRepository.createComment(
          issue,
          `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`,
        );
        continue;
      }

      await this.changeTargetPullRequestApprover.approveIfConfined(
        issue.labels,
        approvedPrUrl,
      );

      if (
        params.awaitingQualityCheckViewerOutputPath &&
        readyPr &&
        issue.assignees.includes('HiromiShikata') &&
        issue.nextActionDate === null &&
        issue.nextActionHour === null &&
        !params.donePrUrls?.has(readyPr.url)
      ) {
        const filePaths =
          await this.issueRepository.getPullRequestChangedFilePaths(
            readyPr.url,
          );
        const changedDirectories = extractChangedDirectories(filePaths);
        viewerItems.push({
          issue: {
            number: issue.number,
            title: issue.title,
            author: issue.author,
            url: issue.url,
            story: issue.story ?? null,
            projectItemId: issue.itemId,
          },
          pr: {
            number: readyPr.number,
            repo: extractPrRepoFromUrl(readyPr.url),
            title: readyPr.title,
            additions: readyPr.additions,
            deletions: readyPr.deletions,
            changedFiles: readyPr.changedFiles,
            url: readyPr.url,
          },
          changedDirectories,
        });
      }
    }

    if (!params.awaitingQualityCheckViewerOutputPath) {
      return null;
    }

    const stories =
      project.story?.stories.map((s, index) => ({
        name: s.name,
        color: STORY_COLOR_HEX_MAP[s.color],
        order: index,
      })) ?? [];

    return {
      stories,
      items: viewerItems,
    };
  };
}
