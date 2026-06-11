import { TriageRepository } from './adapter-interfaces/TriageRepository';
import { IssueCloseReason, TriageData } from '../entities/TriageIssue';

export type SetStoryRequest = {
  projectId: string;
  storyFieldId: string;
  itemId: string;
  storyOptionId: string;
};

export type CloseIssueRequest = {
  owner: string;
  repo: string;
  issueNumber: number;
  reason: IssueCloseReason;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface TriageViewerUseCaseInterface {
  getTriageData: (projectUrl: string) => Promise<TriageData>;
  setStory: (request: SetStoryRequest) => Promise<ActionResult>;
  closeIssue: (request: CloseIssueRequest) => Promise<ActionResult>;
  fetchImageProxy: (
    targetUrl: string,
  ) => Promise<{ content: Buffer; contentType: string }>;
}

export class TriageViewerServerStartUseCase
  implements TriageViewerUseCaseInterface
{
  constructor(private readonly triageRepository: TriageRepository) {}

  getTriageData = async (projectUrl: string): Promise<TriageData> => {
    return this.triageRepository.getTriageData(projectUrl);
  };

  setStory = async (request: SetStoryRequest): Promise<ActionResult> => {
    try {
      await this.triageRepository.setStory(
        request.projectId,
        request.storyFieldId,
        request.itemId,
        request.storyOptionId,
      );
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  };

  closeIssue = async (request: CloseIssueRequest): Promise<ActionResult> => {
    try {
      await this.triageRepository.closeIssue(
        request.owner,
        request.repo,
        request.issueNumber,
        request.reason,
      );
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  };

  fetchImageProxy = async (
    targetUrl: string,
  ): Promise<{ content: Buffer; contentType: string }> => {
    return this.triageRepository.fetchImageProxy(targetUrl);
  };
}
