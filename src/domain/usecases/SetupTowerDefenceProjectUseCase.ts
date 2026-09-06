import { FieldOption } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { StatusDefaultRepository } from './adapter-interfaces/StatusDefaultRepository';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
  LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
  LEGACY_IN_TMUX_STATUS_NAME,
  LEGACY_TODO_STATUS_NAME,
  PC_TODO_STATUS_NAME,
  REQUIRED_WORKFLOW_STATUSES,
  TODO_STATUS_NAME,
  WorkflowStatusDefinition,
} from '../entities/WorkflowStatus';

export class SetupTowerDefenceProjectUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'updateStatusList'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllIssues' | 'updateStatus'
    >,
    private readonly statusDefaultRepository: Pick<
      StatusDefaultRepository,
      'setStatusFieldDefault'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'createComment'
    >,
  ) {}

  private static readonly LEGACY_STATUS_NAMES: Readonly<
    Record<string, string>
  > = {
    [AWAITING_WORKSPACE_STATUS_NAME]: LEGACY_TODO_STATUS_NAME,
    [TODO_STATUS_NAME]: LEGACY_TODO_STATUS_NAME,
    [IN_TMUX_STATUS_NAME]: LEGACY_IN_TMUX_STATUS_NAME,
  };

  private static readonly UNREAD_MIGRATED_STATUS_NAME = 'Unread' as const;

  private static readonly MIGRATED_FROM_NAMES: ReadonlySet<string> = new Set([
    LEGACY_TODO_STATUS_NAME,
    LEGACY_IN_TMUX_STATUS_NAME,
    PC_TODO_STATUS_NAME,
    LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
    SetupTowerDefenceProjectUseCase.UNREAD_MIGRATED_STATUS_NAME,
    AWAITING_OWNER_STATUS_NAME,
  ]);

  run = async (params: { projectUrl: string }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const existing = project.status.statuses;
    const awaitingWorkspaceStatus = existing.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );

    let issuesPromise: ReturnType<IssueRepository['getAllIssues']> | null =
      null;
    const fetchIssues = () => {
      if (!issuesPromise) {
        issuesPromise = this.issueRepository.getAllIssues(project.id);
      }
      return issuesPromise;
    };

    const awaitingOwnerStatus = existing.find(
      (s) => s.name === AWAITING_OWNER_STATUS_NAME,
    );
    if (awaitingOwnerStatus && awaitingWorkspaceStatus) {
      const { issues } = await fetchIssues();
      const awaitingOwnerIssues = issues.filter(
        (issue) => issue.status === AWAITING_OWNER_STATUS_NAME,
      );
      for (const issue of awaitingOwnerIssues) {
        await this.issueCommentRepository.createComment(
          issue,
          'Auto Status Check: AWAITING_OWNER_REVERTED\nThe "Awaiting Owner" status was added to this project by an agent without authorization and has been removed. This issue has been moved to Awaiting Workspace for agent reprocessing.',
        );
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatus.id,
        );
      }
    }

    const unreadStatus = existing.find(
      (s) =>
        s.name === SetupTowerDefenceProjectUseCase.UNREAD_MIGRATED_STATUS_NAME,
    );
    if (unreadStatus && awaitingWorkspaceStatus) {
      const { issues } = await fetchIssues();
      const unreadIssues = issues.filter(
        (issue) =>
          issue.status ===
          SetupTowerDefenceProjectUseCase.UNREAD_MIGRATED_STATUS_NAME,
      );
      for (const issue of unreadIssues) {
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatus.id,
        );
      }
    }

    const awaitingTaskBreakdownStatus = existing.find(
      (s) => s.name === LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
    );
    if (awaitingTaskBreakdownStatus) {
      const todoStatus = existing.find((s) => s.name === TODO_STATUS_NAME);
      if (todoStatus) {
        const { issues } = await fetchIssues();
        const awaitingTaskBreakdownIssues = issues.filter(
          (issue) =>
            issue.status === LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
        );
        for (const issue of awaitingTaskBreakdownIssues) {
          await this.issueRepository.updateStatus(
            project,
            issue,
            todoStatus.id,
          );
        }
      }
    }

    if (awaitingWorkspaceStatus) {
      const { issues } = await fetchIssues();
      const limboIssues = issues.filter(
        (issue) =>
          issue.state === 'OPEN' &&
          (issue.status === DONE_STATUS_NAME || issue.status === null),
      );
      for (const issue of limboIssues) {
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatus.id,
        );
      }
    }

    const awaitingWorkspaceOptionId: string | undefined =
      awaitingWorkspaceStatus?.id;

    const hasMigratedFromName = existing.some((s) =>
      SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES.has(s.name),
    );
    if (
      !hasMigratedFromName &&
      SetupTowerDefenceProjectUseCase.hasRequiredStatusesInCanonicalOrder(
        existing,
      )
    ) {
      if (awaitingWorkspaceOptionId !== undefined) {
        await this.statusDefaultRepository.setStatusFieldDefault(
          project,
          awaitingWorkspaceOptionId,
        );
      }
      return;
    }

    const requiredNames = new Set(
      REQUIRED_WORKFLOW_STATUSES.map((s) => s.name),
    );
    const others = existing.filter(
      (status) =>
        !requiredNames.has(status.name) &&
        !SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES.has(status.name),
    );

    const reusedOptionIds = new Set<FieldOption['id']>();
    const newStatusList: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[] = [
      ...REQUIRED_WORKFLOW_STATUSES.map((required) => {
        const legacyName =
          SetupTowerDefenceProjectUseCase.LEGACY_STATUS_NAMES[required.name];
        const found =
          existing.find((status) => status.name === required.name) ??
          (legacyName !== undefined
            ? existing.find(
                (status) =>
                  status.name === legacyName && !reusedOptionIds.has(status.id),
              )
            : undefined);
        if (found) {
          reusedOptionIds.add(found.id);
        }
        return {
          id: found ? found.id : null,
          name: required.name,
          color: required.color,
          description: '',
        };
      }),
      ...others.map((other) => ({
        id: other.id,
        name: other.name,
        color: other.color,
        description: other.description,
      })),
    ];

    await this.projectRepository.updateStatusList(project, newStatusList);

    if (awaitingWorkspaceOptionId !== undefined) {
      await this.statusDefaultRepository.setStatusFieldDefault(
        project,
        awaitingWorkspaceOptionId,
      );
    }
  };

  private static hasRequiredStatusesInCanonicalOrder = (
    existing: FieldOption[],
  ): boolean => {
    if (existing.length < REQUIRED_WORKFLOW_STATUSES.length) {
      return false;
    }
    return REQUIRED_WORKFLOW_STATUSES.every(
      (required: WorkflowStatusDefinition, index: number) => {
        const actual = existing[index];
        return (
          actual.name === required.name &&
          actual.color === required.color &&
          actual.description === ''
        );
      },
    );
  };
}
