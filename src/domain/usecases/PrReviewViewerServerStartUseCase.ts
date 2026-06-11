import {
  PrReviewViewerListRepository,
  PrReviewViewerDetailRepository,
  PrReviewRepository,
  PrReviewDoneRepository,
  IssueTitleCacheRepository,
} from './adapter-interfaces/PrReviewViewerRepository';
import { PrReviewAction } from '../entities/PrReviewViewerItem';

export type PrReviewViewerServerConfig = {
  accessKey: string;
  host: string;
  port: number;
  staticFilesDir: string;
  dataDir: string;
};

export type ReviewActionRequest = {
  action: PrReviewAction;
  repo: string;
  prNumber: number;
  projectItemId: string;
  projectId: string;
  statusFieldId: string;
  awaitingWorkspaceStatusOptionId: string;
  body?: string;
  comments?: {
    path: string;
    position: number;
    body: string;
  }[];
};

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

export interface PrReviewViewerUseCaseInterface {
  getList: (
    projectCode: string,
  ) => Promise<import('../entities/PrReviewViewerItem').PrReviewViewerItem[]>;
  getDetail: (
    projectCode: string,
    repo: string,
    prNumber: number,
  ) => Promise<object | null>;
  executeReview: (
    projectCode: string,
    request: ReviewActionRequest,
  ) => Promise<ReviewActionResult>;
  getFileContent: (
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    prHeadSha: string,
  ) => Promise<{ content: Buffer; contentType: string }>;
  getIssueTitleInfo: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<import('../entities/PrReviewViewerItem').IssueTitleInfo>;
}

export class PrReviewViewerServerStartUseCase {
  constructor(
    private readonly prReviewViewerListRepository: PrReviewViewerListRepository,
    private readonly prReviewViewerDetailRepository: PrReviewViewerDetailRepository,
    private readonly prReviewRepository: PrReviewRepository,
    private readonly prReviewDoneRepository: PrReviewDoneRepository,
    private readonly issueTitleCacheRepository: IssueTitleCacheRepository,
  ) {}

  getList = async (projectCode: string) => {
    const allItems =
      await this.prReviewViewerListRepository.getList(projectCode);
    const doneItems = await this.prReviewDoneRepository.getAllDone();
    const doneSet = new Set(
      doneItems.map((d) => `${d.owner}/${d.repo}#${d.prNumber}`),
    );
    return allItems.filter((item) => {
      const [owner, repo] = item.pr.repo.split('/');
      const key = `${owner}/${repo}#${item.pr.number}`;
      return !doneSet.has(key);
    });
  };

  getDetail = async (projectCode: string, repo: string, prNumber: number) => {
    return this.prReviewViewerDetailRepository.getDetail(
      projectCode,
      repo,
      prNumber,
    );
  };

  executeReview = async (
    projectCode: string,
    request: ReviewActionRequest,
  ): Promise<ReviewActionResult> => {
    const repoStr = request.repo;
    const repoParts = repoStr.split('/');
    if (repoParts.length < 2) {
      return { ok: false, error: `Invalid repo format: ${repoStr}` };
    }
    const owner = repoParts[0];
    const repoName = repoParts.slice(1).join('/');
    const { action, prNumber } = request;

    try {
      if (action === 'APPROVE') {
        await this.prReviewRepository.approve(
          owner,
          repoName,
          prNumber,
          request.body,
          request.comments,
        );
        await this.prReviewRepository.updateProjectItemStatus(
          request.projectId,
          request.statusFieldId,
          request.projectItemId,
          request.awaitingWorkspaceStatusOptionId,
        );
        await this.safeMarkDone(owner, repoName, prNumber);
      } else if (action === 'REQUEST_CHANGES') {
        await this.prReviewRepository.requestChanges(
          owner,
          repoName,
          prNumber,
          request.body,
          request.comments,
        );
        await this.prReviewRepository.updateProjectItemStatus(
          request.projectId,
          request.statusFieldId,
          request.projectItemId,
          request.awaitingWorkspaceStatusOptionId,
        );
        await this.safeMarkDone(owner, repoName, prNumber);
      } else if (action === 'COMMENT') {
        await this.prReviewRepository.comment(
          owner,
          repoName,
          prNumber,
          request.body,
          request.comments,
        );
      } else if (action === 'CLOSE_WRONG') {
        await this.prReviewRepository.createComment(
          owner,
          repoName,
          prNumber,
          'totally wrong',
        );
        await this.prReviewRepository.closePullRequest(
          owner,
          repoName,
          prNumber,
        );
        await this.safeMarkDone(owner, repoName, prNumber);
      } else if (action === 'CLOSE_UNNEEDED') {
        await this.prReviewRepository.createComment(
          owner,
          repoName,
          prNumber,
          'This pull request is unnecessary.',
        );
        const list =
          await this.prReviewViewerListRepository.getList(projectCode);
        const item = list.find(
          (i) => i.pr.repo === repoStr && i.pr.number === prNumber,
        );
        if (item) {
          const {
            owner: issueOwner,
            repo: issueRepo,
            number: issueNumber,
          } = this.parseIssueUrl(item.issue.url);
          if (issueOwner && issueRepo && issueNumber) {
            await this.prReviewRepository.addLabel(
              issueOwner,
              issueRepo,
              issueNumber,
              'chore',
            );
          }
        }
        await this.prReviewRepository.closePullRequest(
          owner,
          repoName,
          prNumber,
        );
        await this.safeMarkDone(owner, repoName, prNumber);
      } else {
        return { ok: false, error: 'Unsupported action' };
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  };

  getFileContent = async (
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    prHeadSha: string,
  ) => {
    return this.prReviewRepository.getFileContent(
      owner,
      repo,
      filePath,
      ref,
      prHeadSha,
    );
  };

  getIssueTitleInfo = async (owner: string, repo: string, number: number) => {
    const cached = await this.issueTitleCacheRepository.get(
      owner,
      repo,
      number,
    );
    if (cached) {
      return cached;
    }
    const info = await this.prReviewRepository.getIssueOrPrTitle(
      owner,
      repo,
      number,
    );
    await this.issueTitleCacheRepository.set(owner, repo, number, info);
    return info;
  };

  private safeMarkDone = async (
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<void> => {
    try {
      await this.prReviewDoneRepository.markDone(owner, repo, prNumber);
    } catch (error) {
      process.stderr.write(
        `safeMarkDone failed for ${owner}/${repo}#${prNumber}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  };

  private parseIssueUrl = (
    url: string,
  ): { owner: string; repo: string; number: number } => {
    const match = url.match(
      /https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
    );
    if (!match) {
      return { owner: '', repo: '', number: 0 };
    }
    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[4], 10),
    };
  };
}
