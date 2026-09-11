import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { ensureAgentOptionAndGetId } from './ensureAgentOptionAndGetId';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

export const adoptIssueAgentDesignationLabel = async (
  issue: Issue,
  project: Project,
  configuredAgentNames: string[],
  projectRepository: Pick<
    ProjectRepository,
    'getByUrl' | 'createField' | 'updateAgentList'
  >,
  issueRepository: Pick<IssueRepository, 'setIssueAgentField' | 'removeLabel'>,
  agentDesignationLabelsToKeep?: string[] | null,
  defaultAgentName?: string | null,
): Promise<void> => {
  const agentLabel = issue.labels.find((label) =>
    configuredAgentNames.includes(label),
  );
  if (agentLabel === undefined) {
    if (defaultAgentName && issue.agent === null) {
      const agentOptionId = await ensureAgentOptionAndGetId(
        projectRepository,
        project,
        defaultAgentName,
      );
      if (agentOptionId === null) {
        console.warn(
          `Default agent field option '${defaultAgentName}' could not be resolved for ${issue.url}. Keeping the agent unset.`,
        );
        return;
      }
      await issueRepository.setIssueAgentField(
        issue.url,
        project,
        agentOptionId,
      );
      issue.agent = defaultAgentName;
    }
    return;
  }
  if (issue.agent === agentLabel) {
    return;
  }
  issue.agent = agentLabel;
  const agentOptionId = await ensureAgentOptionAndGetId(
    projectRepository,
    project,
    agentLabel,
  );
  if (agentOptionId === null) {
    console.warn(
      `Agent field option '${agentLabel}' could not be resolved for ${issue.url}. Keeping the label as the agent designation.`,
    );
    return;
  }
  await issueRepository.setIssueAgentField(issue.url, project, agentOptionId);
  if (agentDesignationLabelsToKeep?.includes(agentLabel)) {
    return;
  }
  await issueRepository.removeLabel(issue, agentLabel);
  issue.labels = issue.labels.filter((label) => label !== agentLabel);
};

export class AgentDesignationLabelAdoptUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'createField' | 'updateAgentList'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'setIssueAgentField' | 'removeLabel'
    >,
  ) {}

  run = async (params: {
    project: Project;
    issues: Issue[];
    agents: string[] | null;
    agentDesignationLabelsToKeep?: string[] | null;
    defaultAgentName?: string | null;
  }): Promise<void> => {
    const hasAgents = params.agents && params.agents.length > 0;
    if (!hasAgents && !params.defaultAgentName) {
      return;
    }
    for (const issue of params.issues) {
      if (issue.isClosed) {
        continue;
      }
      await adoptIssueAgentDesignationLabel(
        issue,
        params.project,
        params.agents ?? [],
        this.projectRepository,
        this.issueRepository,
        params.agentDesignationLabelsToKeep,
        params.defaultAgentName,
      );
    }
  };
}
