import { AWAITING_WORKSPACE_STATUS_NAME } from '../../entities/WorkflowStatus';
import {
  GithubIssueReference,
  StoryGateGithubRequestError,
  StoryGateIssueRepository,
} from '../adapter-interfaces/StoryGateIssueRepository';

export type SpecificationTaskStartOutcome =
  | 'STARTED'
  | 'ISSUE_CLOSED'
  | 'AGENT_OPTION_NOT_FOUND'
  | 'STATUS_OPTION_NOT_FOUND'
  | 'ISSUE_NOT_IN_PROJECT'
  | 'READ_BACK_MISMATCH'
  | 'SKIPPED_DRY_RUN';

export type SpecificationTaskStartInput = {
  issue: GithubIssueReference;
  specificationAgentName: string;
  dryRun: boolean;
};

export type SpecificationTaskStartResult = {
  issueUrl: string;
  specificationAgentName: string;
  statusName: string;
  dryRun: boolean;
  outcome: SpecificationTaskStartOutcome;
  projectId: string | null;
  itemId: string | null;
  readBackAgentName: string | null;
  readBackStatusName: string | null;
};

export class SpecificationTaskStartUseCase {
  constructor(private readonly issueRepository: StoryGateIssueRepository) {}

  run = async (
    input: SpecificationTaskStartInput,
  ): Promise<SpecificationTaskStartResult> => {
    const result: SpecificationTaskStartResult = {
      issueUrl: input.issue.url,
      specificationAgentName: input.specificationAgentName,
      statusName: AWAITING_WORKSPACE_STATUS_NAME,
      dryRun: input.dryRun,
      outcome: 'ISSUE_NOT_IN_PROJECT',
      projectId: null,
      itemId: null,
      readBackAgentName: null,
      readBackStatusName: null,
    };
    const snapshot = await this.issueRepository.findIssueProjectItems(
      input.issue,
    );
    if (snapshot === null) {
      throw new StoryGateGithubRequestError(
        `Issue not found or not readable with the given token: ${input.issue.url}`,
      );
    }
    if (snapshot.state === 'CLOSED') {
      return { ...result, outcome: 'ISSUE_CLOSED' };
    }
    if (snapshot.items.length === 0) {
      return result;
    }
    const target = snapshot.items
      .map((item) => ({
        item,
        agentField: item.agentField,
        agentOption: item.agentField?.options.find(
          (option) => option.name === input.specificationAgentName,
        ),
      }))
      .find((candidate) => candidate.agentOption !== undefined);
    if (
      target === undefined ||
      target.agentOption === undefined ||
      target.agentField === null
    ) {
      return { ...result, outcome: 'AGENT_OPTION_NOT_FOUND' };
    }
    const targetResult: SpecificationTaskStartResult = {
      ...result,
      projectId: target.item.projectId,
      itemId: target.item.itemId,
    };
    const statusField = target.item.statusField;
    const statusOption = statusField?.options.find(
      (option) => option.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (statusField === null || statusOption === undefined) {
      return { ...targetResult, outcome: 'STATUS_OPTION_NOT_FOUND' };
    }
    if (input.dryRun) {
      return { ...targetResult, outcome: 'SKIPPED_DRY_RUN' };
    }
    await this.issueRepository.updateProjectItemSingleSelectValue({
      projectId: target.item.projectId,
      itemId: target.item.itemId,
      fieldId: target.agentField.fieldId,
      optionId: target.agentOption.id,
    });
    await this.issueRepository.updateProjectItemSingleSelectValue({
      projectId: target.item.projectId,
      itemId: target.item.itemId,
      fieldId: statusField.fieldId,
      optionId: statusOption.id,
    });
    const readBackItem =
      (
        await this.issueRepository.findIssueProjectItems(input.issue)
      )?.items.find((item) => item.itemId === target.item.itemId) ?? null;
    const readBackAgentName = readBackItem?.agentName ?? null;
    const readBackStatusName = readBackItem?.statusName ?? null;
    return {
      ...targetResult,
      readBackAgentName,
      readBackStatusName,
      outcome:
        readBackAgentName === input.specificationAgentName &&
        readBackStatusName === AWAITING_WORKSPACE_STATUS_NAME
          ? 'STARTED'
          : 'READ_BACK_MISMATCH',
    };
  };
}
