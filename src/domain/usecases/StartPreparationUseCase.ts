import type { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
import type { Issue } from '../entities/Issue';
import { NO_STORY_STORY_NAME } from '../entities/RequiredProjectField';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  PREPARATION_STATUS_NAME,
  TODO_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { isDuplicateWithinWindow } from '../services/commentDeduplication';
import { adoptIssueAgentDesignationLabel } from './AgentDesignationLabelAdoptUseCase';
import type { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import type { GitHubGraphqlRateLimitRepository } from './adapter-interfaces/GitHubGraphqlRateLimitRepository';
import type { IssueLatestSessionBranchRepository } from './adapter-interfaces/IssueLatestSessionBranchRepository';
import type {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';
import type { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import type { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import type { TakeOwnershipSpawnRepository } from './adapter-interfaces/TakeOwnershipSpawnRepository';
import {
  CanonicalPullRequestSelection,
  canonicalPullRequestSelect,
} from './canonicalPullRequestSelect';
import { ensureAgentOptionAndGetId } from './ensureAgentOptionAndGetId';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import { issueReactivationTriggerIsPending } from './issueReactivationTriggerIsPending';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';
import { DEFAULT_SELECTION_WEIGHT } from './OauthTokenSelectUseCase';

export const NORMAL_CONCURRENT_LIMIT = 6;
const SEVEN_DAY_THROTTLE_START_THRESHOLD = 0.8;
const FIVE_HOUR_THROTTLE_START_THRESHOLD = 0.8;
export const DEFAULT_FALLBACK_LLM_MODEL_NAME = 'claude-opus-4-8';
const LLM_AGENT_LABEL_PREFIX = 'llm-agent:';
export const SPAWN_CANDIDATE_BRANCH_SOURCE_CONCURRENCY = 8;

export type SpawnCandidateExclusionReason =
  | 'dependedIssueUrls'
  | 'futureNextActionDate'
  | 'nextActionHourNotReached'
  | 'authorNotAllowed'
  | 'notAssignedToManager';

export type SpawnCandidateBranchSource = {
  openPullRequest: RelatedPullRequest | null;
  relatedOpenPullRequests: RelatedPullRequest[];
};

export const agentNameFromDesignation = (designation: string): string =>
  designation.startsWith(LLM_AGENT_LABEL_PREFIX)
    ? designation.slice(LLM_AGENT_LABEL_PREFIX.length).trim()
    : designation.trim();

export type RotationOrderEntry = {
  name: string;
  fiveHourUtilization: number;
  blocked: boolean;
  rejected: boolean;
  thresholdExcluded: boolean;
  cooldownExcluded: boolean;
};

const canonicalPullRequestAdoptionReasonSentence = ({
  canonicalPullRequest,
  adoptionReason,
}: CanonicalPullRequestSelection): string | null =>
  adoptionReason === 'LATEST_SESSION_BRANCH'
    ? `It was adopted because the latest agent session for this issue has its head branch \`${canonicalPullRequest.branchName}\` checked out.`
    : null;

export class StartPreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'createField' | 'updateAgentList'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'getStoryObjectMap'
      | 'getAllOpened'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'closePullRequest'
      | 'deletePullRequestBranch'
      | 'createCommentByUrl'
      | 'getIssueOrPullRequestComments'
      | 'setIssueAgentField'
      | 'removeLabel'
      | 'get'
    >,
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly claudeTokenUsageRepository: ClaudeTokenUsageRepository,
    private readonly takeOwnershipSpawnRepository: TakeOwnershipSpawnRepository,
    private readonly gitHubGraphqlRateLimitRepository: GitHubGraphqlRateLimitRepository,
    private readonly issueLatestSessionBranchRepository: IssueLatestSessionBranchRepository,
  ) {}

  private isWithinCooldown = (
    usage: ClaudeTokenUsage,
    nowEpochSeconds: number,
  ): boolean => usage.blockedUntilEpoch > nowEpochSeconds;

  private isModelWeeklyLimitRejected = (usage: ClaudeTokenUsage): boolean => {
    const limit = usage.modelWeeklyLimits['seven_day'];
    return limit !== undefined && limit.rejected;
  };

  private selectModelForToken = (
    usage: ClaudeTokenUsage,
    defaultModelName: string | null,
    fallbackModelName: string | null,
  ): string | null => {
    const sevenDayLimit = usage.modelWeeklyLimits['seven_day'];
    if (sevenDayLimit !== undefined && sevenDayLimit.rejected) {
      return null;
    }
    return (
      [defaultModelName, fallbackModelName].find(
        (modelName): modelName is string =>
          modelName !== null && modelName !== '',
      ) ?? null
    );
  };

  private secondsUntilSevenDayReset = (
    usage: ClaudeTokenUsage,
    nowEpochSeconds: number,
  ): number => {
    const limit = usage.modelWeeklyLimits['seven_day'];
    if (limit !== undefined) {
      return limit.resetsAt - nowEpochSeconds;
    }
    return Number.POSITIVE_INFINITY;
  };

  private compareBySevenDayDeadlineThenUtilization = (
    a: ClaudeTokenUsage,
    b: ClaudeTokenUsage,
    nowEpochSeconds: number,
  ): number => {
    const aSecondsUntilReset = this.secondsUntilSevenDayReset(
      a,
      nowEpochSeconds,
    );
    const bSecondsUntilReset = this.secondsUntilSevenDayReset(
      b,
      nowEpochSeconds,
    );
    if (aSecondsUntilReset !== bSecondsUntilReset) {
      return aSecondsUntilReset - bSecondsUntilReset;
    }
    return a.fiveHourUtilization - b.fiveHourUtilization;
  };

  private taperedConcurrentLimit = (
    utilization: number,
    throttleStartThreshold: number,
    normalConcurrentLimit: number,
  ): number => {
    if (utilization < throttleStartThreshold) {
      return normalConcurrentLimit;
    }
    const remaining = (1 - utilization) / (1 - throttleStartThreshold);
    return Math.max(1, Math.ceil(normalConcurrentLimit * remaining));
  };

  getTokenConcurrentLimit = (
    fiveHourUtilization: number,
    sevenDayUtilization: number,
    selectionWeight?: number,
    normalConcurrentLimit: number = NORMAL_CONCURRENT_LIMIT,
  ): number => {
    const sevenDayLimit = this.taperedConcurrentLimit(
      sevenDayUtilization,
      SEVEN_DAY_THROTTLE_START_THRESHOLD,
      normalConcurrentLimit,
    );
    const fiveHourLimit = this.taperedConcurrentLimit(
      fiveHourUtilization,
      FIVE_HOUR_THROTTLE_START_THRESHOLD,
      normalConcurrentLimit,
    );
    const weight = selectionWeight ?? DEFAULT_SELECTION_WEIGHT;
    return Math.max(
      1,
      Math.floor(Math.min(sevenDayLimit, fiveHourLimit) * weight),
    );
  };

  spawnCandidateExclusionReasonOf = (
    issue: Issue,
    allowedIssueAuthors: string[] | null,
    manager: string,
    now: Date,
  ): SpawnCandidateExclusionReason | null => {
    if (issue.dependedIssueUrls.length > 0) {
      return 'dependedIssueUrls';
    }
    if (issueReactivationTriggerIsPending(issue, now)) {
      const startOfTomorrow = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      );
      return issue.nextActionDate !== null &&
        issue.nextActionDate >= startOfTomorrow
        ? 'futureNextActionDate'
        : 'nextActionHourNotReached';
    }
    if (
      !isAuthorAuthorizedForAutoStatusCheck(issue.author, allowedIssueAuthors)
    ) {
      return 'authorNotAllowed';
    }
    if (!issue.assignees.includes(manager)) {
      return 'notAssignedToManager';
    }
    return null;
  };

  private buildIssueUrlsWithOpenPrs = (issues: Issue[]): Set<string> => {
    const issueUrlsWithOpenPrs = new Set<string>();
    for (const issue of issues) {
      if (!issue.isPr || issue.isClosed) {
        continue;
      }
      for (const issueUrl of issue.closingIssueReferenceUrls) {
        issueUrlsWithOpenPrs.add(issueUrl);
      }
    }
    return issueUrlsWithOpenPrs;
  };

  fetchSpawnCandidateBranchSources = async (
    issueUrls: string[],
    issueUrlsWithKnownOpenPrs: ReadonlySet<string>,
  ): Promise<Map<string, SpawnCandidateBranchSource>> => {
    const branchSourceByIssueUrl = new Map<
      string,
      SpawnCandidateBranchSource
    >();
    let nextIndex = 0;
    const fetchSequentially = async (): Promise<void> => {
      while (nextIndex < issueUrls.length) {
        const issueUrl = issueUrls[nextIndex];
        nextIndex += 1;
        if (issueUrl.includes('/pull/')) {
          branchSourceByIssueUrl.set(issueUrl, {
            openPullRequest:
              await this.issueRepository.getOpenPullRequest(issueUrl),
            relatedOpenPullRequests: [],
          });
        } else if (issueUrlsWithKnownOpenPrs.has(issueUrl)) {
          branchSourceByIssueUrl.set(issueUrl, {
            openPullRequest: null,
            relatedOpenPullRequests:
              await this.issueRepository.findRelatedOpenPRs(issueUrl),
          });
        } else {
          branchSourceByIssueUrl.set(issueUrl, {
            openPullRequest: null,
            relatedOpenPullRequests: [],
          });
        }
      }
    };
    await Promise.all(
      Array.from(
        {
          length: Math.min(
            SPAWN_CANDIDATE_BRANCH_SOURCE_CONCURRENCY,
            issueUrls.length,
          ),
        },
        fetchSequentially,
      ),
    );
    return branchSourceByIssueUrl;
  };

  private selectRotationTokens = (
    tokenUsages: ClaudeTokenUsage[],
    utilizationPercentageThreshold: number,
    defaultModelName: string | null,
    fallbackModelName: string | null,
    maxConcurrent: number,
    normalConcurrentLimit: number,
  ): {
    tokens: string[];
    effectiveCap: number;
    tokensWithLimits: Array<{
      token: string;
      model: string;
      limit: number;
      secondsUntilSevenDayReset: number;
    }>;
  } => {
    const nowEpochSeconds = Date.now() / 1000;
    const eligibleTokens = tokenUsages
      .filter((usage) => !usage.blocked)
      .filter((usage) => !usage.fiveHourRejected)
      .filter((usage) => !this.isWithinCooldown(usage, nowEpochSeconds))
      .filter(
        (usage) =>
          usage.fiveHourUtilization * 100 < utilizationPercentageThreshold,
      )
      .flatMap((usage) => {
        const model = this.selectModelForToken(
          usage,
          defaultModelName,
          fallbackModelName,
        );
        if (model === null) return [];
        return [{ usage, model }];
      })
      .sort((a, b) =>
        this.compareBySevenDayDeadlineThenUtilization(
          a.usage,
          b.usage,
          nowEpochSeconds,
        ),
      );

    if (eligibleTokens.length === 0) {
      return { tokens: [], effectiveCap: 0, tokensWithLimits: [] };
    }

    const tokensWithLimits = eligibleTokens.map(({ usage, model }) => ({
      token: usage.token,
      model,
      limit: this.getTokenConcurrentLimit(
        usage.fiveHourUtilization,
        usage.sevenDayUtilization,
        usage.selectionWeight,
        normalConcurrentLimit,
      ),
      secondsUntilSevenDayReset: this.secondsUntilSevenDayReset(
        usage,
        nowEpochSeconds,
      ),
    }));

    const totalCapacity = tokensWithLimits.reduce((sum, t) => sum + t.limit, 0);
    const effectiveCap = Math.min(maxConcurrent, totalCapacity);

    const maxLimit = Math.max(...tokensWithLimits.map((t) => t.limit));
    const rotationList: string[] = [];
    for (let round = 0; round < maxLimit; round++) {
      for (const t of tokensWithLimits) {
        if (t.limit > round) {
          rotationList.push(t.token);
        }
      }
    }

    return { tokens: rotationList, effectiveCap, tokensWithLimits };
  };

  buildRotationOrder = (
    tokenUsages: ClaudeTokenUsage[],
    utilizationPercentageThreshold: number,
  ): RotationOrderEntry[] => {
    const nowEpochSeconds = Date.now() / 1000;
    const selectedTokens = tokenUsages
      .filter((usage) => !usage.blocked)
      .filter((usage) => !usage.fiveHourRejected)
      .filter((usage) => !this.isWithinCooldown(usage, nowEpochSeconds))
      .filter((usage) => !this.isModelWeeklyLimitRejected(usage))
      .filter(
        (usage) =>
          usage.fiveHourUtilization * 100 < utilizationPercentageThreshold,
      )
      .sort((a, b) =>
        this.compareBySevenDayDeadlineThenUtilization(a, b, nowEpochSeconds),
      );
    const selectedTokenValues = new Set(selectedTokens.map((u) => u.token));
    const excluded: RotationOrderEntry[] = tokenUsages
      .filter((usage) => !selectedTokenValues.has(usage.token))
      .map((usage) => ({
        name: usage.name ?? '',
        fiveHourUtilization: usage.fiveHourUtilization,
        blocked: usage.blocked,
        rejected: usage.fiveHourRejected,
        thresholdExcluded:
          !usage.blocked &&
          !usage.fiveHourRejected &&
          !this.isWithinCooldown(usage, nowEpochSeconds) &&
          !this.isModelWeeklyLimitRejected(usage) &&
          usage.fiveHourUtilization * 100 >= utilizationPercentageThreshold,
        cooldownExcluded:
          !usage.blocked &&
          !usage.fiveHourRejected &&
          this.isWithinCooldown(usage, nowEpochSeconds),
      }));
    const selectedEntries: RotationOrderEntry[] = selectedTokens.map(
      (usage) => ({
        name: usage.name ?? '',
        fiveHourUtilization: usage.fiveHourUtilization,
        blocked: false,
        rejected: false,
        thresholdExcluded: false,
        cooldownExcluded: false,
      }),
    );
    return [...selectedEntries, ...excluded];
  };

  run = async (params: {
    projectUrl: string;
    defaultAgentName: string;
    defaultLlmModelName: string | null;
    fallbackLlmModelName: string | null;
    defaultLlmAgentName: string | null;
    configFilePath: string;
    maximumPreparingIssuesCount: number | null;
    utilizationPercentageThreshold: number;
    allowedIssueAuthors: string[] | null;
    manager: string;
    codexHomeCandidates: string[] | null;
    labelsAsLlmAgentName: string[] | null;
    agents?: string[] | null;
    normalConcurrentLimit?: number;
    maxConcurrentWorkers?: number | null;
    graphqlRateLimitFloor?: number | null;
  }): Promise<{ rotationOrder: RotationOrderEntry[] | null }> => {
    const normalConcurrentLimit =
      params.normalConcurrentLimit ?? NORMAL_CONCURRENT_LIMIT;
    const tokenUsages =
      await this.claudeTokenUsageRepository.getAvailableTokenUsages();
    let rotationTokens: string[] | null = null;
    let proxyBaseUrl: string | null = null;
    let selectedTokensWithLimits: Array<{
      token: string;
      model: string;
      limit: number;
      secondsUntilSevenDayReset: number;
    }> = [];
    let tokenInFlightCounts: Record<string, number> = {};
    const rotationOrder: RotationOrderEntry[] | null =
      tokenUsages.length > 0
        ? this.buildRotationOrder(
            tokenUsages,
            params.utilizationPercentageThreshold,
          )
        : null;
    const maximumPreparingIssuesCount =
      params.maximumPreparingIssuesCount ?? NORMAL_CONCURRENT_LIMIT;
    let effectiveMaxPreparingIssuesCount = maximumPreparingIssuesCount;
    const fallbackLlmModelName =
      params.fallbackLlmModelName ?? DEFAULT_FALLBACK_LLM_MODEL_NAME;
    if (tokenUsages.length > 0) {
      const {
        tokens: selectedTokens,
        effectiveCap: selectedCap,
        tokensWithLimits: selectedTokensWithLimitsLocal,
      } = this.selectRotationTokens(
        tokenUsages,
        params.utilizationPercentageThreshold,
        params.defaultLlmModelName,
        fallbackLlmModelName,
        maximumPreparingIssuesCount,
        normalConcurrentLimit,
      );
      if (selectedTokens.length === 0) {
        console.warn(
          `All ${tokenUsages.length} configured Claude OAuth token(s) are unavailable (blocked, 5h-window rejected, within cooldown, weekly limits for every candidate model exhausted, or 5h utilization >= ${params.utilizationPercentageThreshold}%). Skipping starting preparation.`,
        );
        return { rotationOrder };
      }
      await this.claudeTokenUsageRepository.ensureObservable();
      tokenInFlightCounts =
        await this.claudeTokenUsageRepository.getTokenInFlightCounts();
      rotationTokens = selectedTokens;
      selectedTokensWithLimits = selectedTokensWithLimitsLocal;
      effectiveMaxPreparingIssuesCount = selectedCap;
      proxyBaseUrl = this.claudeTokenUsageRepository.proxyBaseUrl();
    }

    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const storyObjectMap =
      await this.issueRepository.getStoryObjectMap(project);

    const allOpenedIssues = Array.from(storyObjectMap.values()).flatMap(
      (storyObject) => storyObject.issues,
    );
    const preparationStatusOption = project.status.statuses.find(
      (s) => s.name === PREPARATION_STATUS_NAME,
    );
    if (!preparationStatusOption) {
      console.error(
        `Preparation status option '${PREPARATION_STATUS_NAME}' not found in project.`,
      );
      return { rotationOrder };
    }
    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    const todoByHumanStatusOption = project.status.statuses.find(
      (s) => s.name === TODO_STATUS_NAME,
    );

    const runningIssueUrls = new Set(
      this.takeOwnershipSpawnRepository.listRunningIssueUrls(),
    );
    const allProjectOpenIssues =
      await this.issueRepository.getAllOpened(project);
    const currentPreparationIssueCount = allOpenedIssues.filter(
      (issue) => issue.status === PREPARATION_STATUS_NAME,
    ).length;
    let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
    let startedInThisRunCount = 0;
    const spawnedInThisRunByToken: Record<string, number> = {};
    let tokenInFlightCountsRefreshed = false;
    const exclusionCounts = {
      dependedIssueUrls: 0,
      futureNextActionDate: 0,
      nextActionHourNotReached: 0,
      authorNotAllowed: 0,
      notAssignedToManager: 0,
    };

    const now = new Date();

    const isUnstoriedAwaitingWorkspaceIssue = (issue: Issue): boolean =>
      issue.story === null || issue.story.startsWith(NO_STORY_STORY_NAME);

    const storiedAwaitingWorkspaceIssues = allOpenedIssues.filter(
      (issue) =>
        issue.status === AWAITING_WORKSPACE_STATUS_NAME &&
        !issue.isClosed &&
        !isUnstoriedAwaitingWorkspaceIssue(issue),
    );
    const unstoriedAwaitingWorkspaceIssuesOldestFirst = allProjectOpenIssues
      .filter(
        (issue) =>
          issue.status === AWAITING_WORKSPACE_STATUS_NAME &&
          !issue.isClosed &&
          isUnstoriedAwaitingWorkspaceIssue(issue),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const nextEligibleUnstoriedIssueIndex =
      unstoriedAwaitingWorkspaceIssuesOldestFirst.findIndex(
        (issue) =>
          this.spawnCandidateExclusionReasonOf(
            issue,
            params.allowedIssueAuthors,
            params.manager,
            now,
          ) === null,
      );
    const awaitingWorkspaceIssues: Issue[] =
      nextEligibleUnstoriedIssueIndex === -1
        ? [
            ...storiedAwaitingWorkspaceIssues,
            ...unstoriedAwaitingWorkspaceIssuesOldestFirst,
          ]
        : [
            unstoriedAwaitingWorkspaceIssuesOldestFirst[
              nextEligibleUnstoriedIssueIndex
            ],
            ...storiedAwaitingWorkspaceIssues,
            ...unstoriedAwaitingWorkspaceIssuesOldestFirst.slice(
              0,
              nextEligibleUnstoriedIssueIndex,
            ),
            ...unstoriedAwaitingWorkspaceIssuesOldestFirst.slice(
              nextEligibleUnstoriedIssueIndex + 1,
            ),
          ];

    const maxConcurrentWorkers = params.maxConcurrentWorkers ?? null;
    const graphqlRateLimitFloor = params.graphqlRateLimitFloor ?? null;

    if (graphqlRateLimitFloor !== null) {
      const graphqlRemaining =
        await this.gitHubGraphqlRateLimitRepository.getRemainingRequestCount();
      if (
        graphqlRemaining !== null &&
        graphqlRemaining < graphqlRateLimitFloor
      ) {
        console.warn(
          `GraphQL rate limit low (${graphqlRemaining} remaining, floor: ${graphqlRateLimitFloor}); skipping preparation cycle.`,
        );
        return { rotationOrder };
      }
      if (graphqlRemaining === null) {
        console.warn(
          'GraphQL rate limit check failed; proceeding with spawning.',
        );
      }
    }

    const issueUrlsWithOpenPrs =
      this.buildIssueUrlsWithOpenPrs(allOpenedIssues);
    const branchSourceByIssueUrl = await this.fetchSpawnCandidateBranchSources(
      awaitingWorkspaceIssues
        .filter(
          (issue) =>
            !runningIssueUrls.has(issue.url) &&
            this.spawnCandidateExclusionReasonOf(
              issue,
              params.allowedIssueAuthors,
              params.manager,
              now,
            ) === null,
        )
        .map((issue) => issue.url)
        .slice(
          0,
          Math.max(
            0,
            effectiveMaxPreparingIssuesCount - currentPreparationIssueCount,
          ),
        ),
      issueUrlsWithOpenPrs,
    );

    if (
      todoByHumanStatusOption &&
      params.allowedIssueAuthors !== null &&
      params.allowedIssueAuthors.length > 0
    ) {
      for (const issue of awaitingWorkspaceIssues) {
        if (runningIssueUrls.has(issue.url)) continue;
        const exclusionReason = this.spawnCandidateExclusionReasonOf(
          issue,
          params.allowedIssueAuthors,
          params.manager,
          now,
        );
        if (exclusionReason !== 'authorNotAllowed') continue;
        const commentBody = `authorNotAllowed: 著者 ${issue.author} は allowedIssueAuthors に含まれていないため、自動スポーンできません。オーナーの確認が必要です。`;
        const existingComments =
          await this.issueRepository.getIssueOrPullRequestComments(issue.url);
        if (
          !isDuplicateWithinWindow(
            commentBody,
            existingComments.map((c) => ({
              text: c.body,
              createdAt: c.createdAt,
            })),
            now,
          )
        ) {
          await this.issueRepository.createCommentByUrl(issue.url, commentBody);
        }
        const staleness = await issueSnapshotStalenessCheck({
          issueRepository: this.issueRepository,
          project,
          snapshotIssue: issue,
          checkedFieldNames: ['status', 'isClosed'],
          skippedWriteDescription: `the Todo by human status write for an author-not-allowed issue`,
        });
        if (staleness.type !== 'current') {
          continue;
        }
        await this.issueRepository.updateStatus(
          project,
          issue,
          todoByHumanStatusOption.id,
        );
      }
    }

    for (
      let i = 0;
      i < awaitingWorkspaceIssues.length &&
      updatedCurrentPreparationIssueCount < effectiveMaxPreparingIssuesCount;
      i++
    ) {
      const issue = awaitingWorkspaceIssues[i];
      if (issue.dependedIssueUrls.length > 0) {
        exclusionCounts.dependedIssueUrls++;
        continue;
      }
      if (runningIssueUrls.has(issue.url)) {
        console.warn(`Skipping ${issue.url}: worker already running.`);
        continue;
      }
      if (maxConcurrentWorkers !== null) {
        const activeWorkerCount = runningIssueUrls.size + startedInThisRunCount;
        if (activeWorkerCount >= maxConcurrentWorkers) {
          console.warn(
            `Spawn cap reached (${activeWorkerCount}/${maxConcurrentWorkers} active workers); skipping remaining candidates.`,
          );
          break;
        }
      }
      const exclusionReason = this.spawnCandidateExclusionReasonOf(
        issue,
        params.allowedIssueAuthors,
        params.manager,
        now,
      );
      if (exclusionReason !== null) {
        exclusionCounts[exclusionReason]++;
        continue;
      }
      const branchSource = branchSourceByIssueUrl.get(issue.url);
      if (branchSource === undefined) {
        console.error(
          `Skipping ${issue.url}: no branch source was prefetched for this spawn candidate.`,
        );
        continue;
      }
      await adoptIssueAgentDesignationLabel(
        issue,
        project,
        params.agents ?? [],
        this.projectRepository,
        this.issueRepository,
      );
      const isNoStory = isUnstoriedAwaitingWorkspaceIssue(issue);
      const agent =
        (isNoStory && issue.agent === null
          ? null
          : agentNameFromDesignation(issue.agent ?? '')) ||
        params.defaultAgentName;
      if (issue.agent === null && !isNoStory) {
        const staleness = await issueSnapshotStalenessCheck({
          issueRepository: this.issueRepository,
          project,
          snapshotIssue: issue,
          checkedFieldNames: ['agent'],
          skippedWriteDescription: `the default Agent write for a spawn candidate`,
        });
        if (staleness.type === 'current') {
          const agentOptionId = await ensureAgentOptionAndGetId(
            this.projectRepository,
            project,
            agent,
          );
          if (agentOptionId !== null) {
            await this.issueRepository.setIssueAgentField(
              issue.url,
              project,
              agentOptionId,
            );
          }
        }
      }
      const labelModelName = issue.labels
        .find((label: string) => label.startsWith('llm-model:'))
        ?.replace('llm-model:', '')
        .trim();
      if (
        !labelModelName &&
        !params.defaultLlmModelName &&
        rotationTokens === null
      ) {
        console.error(
          `No LLM model configured for issue ${issue.url}. Provide --defaultLlmModelName or add an llm-model: label.`,
        );
        continue;
      }
      const isPrUrl = issue.url.includes('/pull/');
      let branchName: string;
      if (isPrUrl) {
        const pr = branchSource.openPullRequest;
        if (pr === null) {
          console.warn(
            `Skipping non-OPEN PR ${issue.url}: wrapper requires an open PR.`,
          );
          continue;
        }
        if (pr.branchName === null) {
          console.warn(`Skipping PR ${issue.url}: head branch is unavailable.`);
          continue;
        }
        branchName = pr.branchName;
      } else {
        const relatedPRs = branchSource.relatedOpenPullRequests;
        const sameRepoRelatedPRs = relatedPRs.filter((pr) => {
          const match = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\//.exec(pr.url);
          return match === null || match[1] === issue.nameWithOwner;
        });
        if (sameRepoRelatedPRs.length > 1) {
          const latestSessionBranchName =
            await this.issueLatestSessionBranchRepository.findBranchNameByIssue(
              issue,
            );
          const canonicalPullRequestSelection = canonicalPullRequestSelect(
            [sameRepoRelatedPRs[0], ...sameRepoRelatedPRs.slice(1)],
            latestSessionBranchName,
          );
          const canonicalPR =
            canonicalPullRequestSelection.canonicalPullRequest;
          const duplicatePRs =
            canonicalPullRequestSelection.duplicatePullRequests;
          const adoptionReasonSentence =
            canonicalPullRequestAdoptionReasonSentence(
              canonicalPullRequestSelection,
            );
          for (const duplicatePR of duplicatePRs) {
            await this.issueRepository.closePullRequest(duplicatePR.url);
            if (duplicatePR.branchName !== null) {
              await this.issueRepository.deletePullRequestBranch(
                duplicatePR.url,
                duplicatePR.branchName,
              );
            }
            const duplicatePrCommentBody = [
              `This PR was automatically closed to resolve multiple-open-PR ambiguity for issue ${issue.url}. The adopted canonical PR is ${canonicalPR.url}.`,
              ...(adoptionReasonSentence === null
                ? []
                : [adoptionReasonSentence]),
            ].join(' ');
            const duplicatePrExistingComments =
              await this.issueRepository.getIssueOrPullRequestComments(
                duplicatePR.url,
              );
            if (
              !isDuplicateWithinWindow(
                duplicatePrCommentBody,
                duplicatePrExistingComments.map((c) => ({
                  text: c.body,
                  createdAt: c.createdAt,
                })),
                new Date(),
              )
            ) {
              await this.issueRepository.createCommentByUrl(
                duplicatePR.url,
                duplicatePrCommentBody,
              );
            }
          }
          const removedPrUrls = duplicatePRs.map((pr) => pr.url).join(', ');
          const issueCommentBody = [
            `${duplicatePRs.length} duplicate PR(s) were automatically closed to resolve multiple-open-PR ambiguity.\n\nRemoved PRs: ${removedPrUrls}\nAdopted PR: ${canonicalPR.url}`,
            ...(adoptionReasonSentence === null
              ? []
              : [adoptionReasonSentence]),
          ].join('\n');
          const issueExistingComments =
            await this.issueRepository.getIssueOrPullRequestComments(issue.url);
          if (
            !isDuplicateWithinWindow(
              issueCommentBody,
              issueExistingComments.map((c) => ({
                text: c.body,
                createdAt: c.createdAt,
              })),
              new Date(),
            )
          ) {
            await this.issueRepository.createCommentByUrl(
              issue.url,
              issueCommentBody,
            );
          }
          if (canonicalPR.branchName === null) {
            console.warn(
              `Skipping issue ${issue.url}: adopted canonical PR has unavailable head branch.`,
            );
            continue;
          }
          branchName = canonicalPR.branchName;
        } else if (sameRepoRelatedPRs.length === 1) {
          if (sameRepoRelatedPRs[0].branchName === null) {
            console.warn(
              `Skipping issue ${issue.url}: related open PR has unavailable head branch.`,
            );
            continue;
          }
          branchName = sameRepoRelatedPRs[0].branchName;
        } else {
          branchName = `i${issue.number}`;
        }
      }

      if (!/^[\w./-]+$/.test(branchName)) {
        console.error(
          `Skipping issue ${issue.url}: branch name contains unexpected characters: ${branchName}`,
        );
        continue;
      }

      const refetchedIssue = await this.issueRepository.get(issue.url, project);
      if (
        refetchedIssue === null ||
        refetchedIssue.dependedIssueUrls.length > 0 ||
        refetchedIssue.status !== AWAITING_WORKSPACE_STATUS_NAME
      ) {
        console.warn(
          `Skipping ${issue.url}: re-fetch shows issue is no longer eligible for spawning.`,
        );
        continue;
      }

      await this.issueRepository.updateStatus(
        project,
        issue,
        preparationStatusOption.id,
      );
      issue.status = PREPARATION_STATUS_NAME;

      const revertToAwaitingWorkspace = async (
        reason: string,
      ): Promise<void> => {
        console.error(
          `Reverting ${issue.url} to ${AWAITING_WORKSPACE_STATUS_NAME} because no worker was spawned: ${reason}`,
        );
        if (!awaitingWorkspaceStatusOption) {
          console.error(
            `Awaiting Workspace status option '${AWAITING_WORKSPACE_STATUS_NAME}' not found in project. ${issue.url} stays in ${PREPARATION_STATUS_NAME} without a worker.`,
          );
          return;
        }
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
        issue.status = AWAITING_WORKSPACE_STATUS_NAME;
      };

      let spawnEnv: Record<string, string> | undefined;
      let routedModelName: string | null = null;
      let selectedTokenName: string | null = null;
      if (rotationTokens !== null && proxyBaseUrl !== null) {
        const tokenWithSoonestResetAmongAvailableOf = ():
          { token: string; model: string } | undefined =>
          selectedTokensWithLimits
            .map((t) => ({
              token: t.token,
              model: t.model,
              remaining:
                t.limit -
                (tokenInFlightCounts[t.token] ?? 0) -
                (spawnedInThisRunByToken[t.token] ?? 0),
              secondsUntilSevenDayReset: t.secondsUntilSevenDayReset,
            }))
            .filter((t) => t.remaining > 0)
            .sort((a, b) => {
              if (a.secondsUntilSevenDayReset !== b.secondsUntilSevenDayReset) {
                return (
                  a.secondsUntilSevenDayReset - b.secondsUntilSevenDayReset
                );
              }
              return b.remaining - a.remaining;
            })[0];
        let tokenWithSoonestResetAmongAvailable =
          tokenWithSoonestResetAmongAvailableOf();
        if (
          tokenWithSoonestResetAmongAvailable === undefined &&
          !tokenInFlightCountsRefreshed
        ) {
          tokenInFlightCountsRefreshed = true;
          tokenInFlightCounts =
            await this.claudeTokenUsageRepository.getTokenInFlightCounts();
          tokenWithSoonestResetAmongAvailable =
            tokenWithSoonestResetAmongAvailableOf();
        }
        if (tokenWithSoonestResetAmongAvailable === undefined) {
          await revertToAwaitingWorkspace(
            'every Claude OAuth token reached its concurrent worker limit',
          );
          break;
        }
        const selected = tokenWithSoonestResetAmongAvailable.token;
        routedModelName = tokenWithSoonestResetAmongAvailable.model;
        selectedTokenName = selected;
        spawnEnv = {
          CLAUDE_CODE_OAUTH_TOKEN: selected,
          ANTHROPIC_BASE_URL: proxyBaseUrl,
        };
      }
      const model =
        labelModelName || routedModelName || params.defaultLlmModelName;
      if (!model) {
        console.error(
          `No LLM model configured for issue ${issue.url}. Provide --defaultLlmModelName or add an llm-model: label.`,
        );
        await revertToAwaitingWorkspace('no LLM model is configured');
        continue;
      }
      const awArgs: string[] = [
        issue.url,
        agent,
        model,
        '--configFilePath',
        params.configFilePath,
        '--branch',
        branchName,
      ];
      if (
        params.codexHomeCandidates !== null &&
        params.codexHomeCandidates.length > 0
      ) {
        const codexHome =
          params.codexHomeCandidates[
            startedInThisRunCount % params.codexHomeCandidates.length
          ];
        awArgs.push('--codexHome', codexHome);
      }
      const spawnResult = await this.localCommandRunner.runCommand(
        'aw',
        awArgs,
        spawnEnv ? { env: spawnEnv } : undefined,
      );
      if (spawnResult.exitCode !== 0) {
        await revertToAwaitingWorkspace(
          `aw exited with ${spawnResult.exitCode}. stdout: ${spawnResult.stdout} stderr: ${spawnResult.stderr}`,
        );
        continue;
      }
      if (selectedTokenName !== null) {
        spawnedInThisRunByToken[selectedTokenName] =
          (spawnedInThisRunByToken[selectedTokenName] ?? 0) + 1;
      }
      startedInThisRunCount++;
      updatedCurrentPreparationIssueCount++;
    }
    console.log(
      `Spawn candidate exclusion summary for ${params.projectUrl}: dependedIssueUrls=${exclusionCounts.dependedIssueUrls}, futureNextActionDate=${exclusionCounts.futureNextActionDate}, nextActionHourNotReached=${exclusionCounts.nextActionHourNotReached}, authorNotAllowed=${exclusionCounts.authorNotAllowed}, notAssignedToManager=${exclusionCounts.notAssignedToManager}`,
    );
    return { rotationOrder };
  };
}
