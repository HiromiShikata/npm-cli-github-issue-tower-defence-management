import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';

const MAXIMUM_PREPARING_PROCESS_COUNT_PER_TOKEN = 6;
const PROCESS_COUNT_DECAY_START_UTILIZATION = 0.8;
const PROCESS_COUNT_ZERO_UTILIZATION = 0.95;
const PROCESS_COUNT_DECAY_STEEPNESS = 2;

type RotationToken = {
  token: string;
  model: string;
  maximumPreparingProcessCount: number;
};

export type RotationOrderEntry = {
  name: string;
  fiveHourUtilization: number;
  blocked: boolean;
  rejected: boolean;
  thresholdExcluded: boolean;
};

export class StartPreparationUseCase {
  constructor(
    private readonly projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'getStoryObjectMap'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'closePullRequest'
      | 'deletePullRequestBranch'
      | 'createCommentByUrl'
    >,
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly claudeTokenUsageRepository: ClaudeTokenUsageRepository,
  ) {}

  private readonly KNOWN_MODEL_SPECIFIC_LIMIT_TYPES = [
    'seven_day_sonnet',
    'seven_day_opus',
  ];

  private weeklyLimitTypeForModel = (modelName: string | null): string => {
    const normalized = (modelName ?? '').toLowerCase();
    if (normalized.includes('sonnet')) return 'seven_day_sonnet';
    if (normalized.includes('opus')) return 'seven_day_opus';
    return 'seven_day';
  };

  private deriveFallbackModelName = (
    limitType: string,
    defaultModelName: string,
  ): string => {
    if (limitType === this.weeklyLimitTypeForModel(defaultModelName)) {
      return defaultModelName;
    }
    if (
      limitType === 'seven_day_opus' &&
      defaultModelName.toLowerCase().includes('sonnet')
    ) {
      return defaultModelName.replace(/sonnet/gi, 'opus');
    }
    if (
      limitType === 'seven_day_sonnet' &&
      defaultModelName.toLowerCase().includes('opus')
    ) {
      return defaultModelName.replace(/opus/gi, 'sonnet');
    }
    return defaultModelName;
  };

  private selectModelForToken = (
    usage: ClaudeTokenUsage,
    defaultModelName: string | null,
  ): string | null => {
    const generalLimit = usage.modelWeeklyLimits['seven_day'];
    if (generalLimit !== undefined && generalLimit.rejected) return null;

    if (defaultModelName === null) return null;

    const defaultLimitType = this.weeklyLimitTypeForModel(defaultModelName);
    const candidateLimitTypes = [
      defaultLimitType,
      ...this.KNOWN_MODEL_SPECIFIC_LIMIT_TYPES.filter(
        (t) => t !== defaultLimitType,
      ),
    ];

    for (const limitType of candidateLimitTypes) {
      const limit = usage.modelWeeklyLimits[limitType];
      if (limit === undefined || !limit.rejected) {
        return this.deriveFallbackModelName(limitType, defaultModelName);
      }
    }

    return null;
  };

  private maximumPreparingProcessCountForToken = (
    fiveHourUtilization: number,
  ): number => {
    if (fiveHourUtilization <= PROCESS_COUNT_DECAY_START_UTILIZATION) {
      return MAXIMUM_PREPARING_PROCESS_COUNT_PER_TOKEN;
    }
    if (fiveHourUtilization >= PROCESS_COUNT_ZERO_UTILIZATION) {
      return 0;
    }
    const decayProgress =
      (fiveHourUtilization - PROCESS_COUNT_DECAY_START_UTILIZATION) /
      (PROCESS_COUNT_ZERO_UTILIZATION - PROCESS_COUNT_DECAY_START_UTILIZATION);
    const minimumMultiplier = Math.exp(-PROCESS_COUNT_DECAY_STEEPNESS);
    const remainingRatio =
      (Math.exp(-PROCESS_COUNT_DECAY_STEEPNESS * decayProgress) -
        minimumMultiplier) /
      (1 - minimumMultiplier);
    return Math.max(
      1,
      Math.floor(MAXIMUM_PREPARING_PROCESS_COUNT_PER_TOKEN * remainingRatio),
    );
  };

  private selectRotationTokens = (
    tokenUsages: ClaudeTokenUsage[],
    modelName: string | null,
  ): RotationToken[] => {
    return tokenUsages
      .filter((usage) => !usage.blocked)
      .filter((usage) => !usage.rejected)
      .flatMap((usage) => {
        const selectedModel = this.selectModelForToken(usage, modelName);
        if (selectedModel === null) return [];
        return [
          {
            token: usage.token,
            model: selectedModel,
            fiveHourUtilization: usage.fiveHourUtilization,
            maximumPreparingProcessCount:
              this.maximumPreparingProcessCountForToken(
                usage.fiveHourUtilization,
              ),
          },
        ];
      })
      .filter((usage) => usage.maximumPreparingProcessCount > 0)
      .sort((a, b) => a.fiveHourUtilization - b.fiveHourUtilization)
      .map((usage) => ({
        token: usage.token,
        model: usage.model,
        maximumPreparingProcessCount: usage.maximumPreparingProcessCount,
      }));
  };

  private createRotationTokenSlots = (
    rotationTokens: RotationToken[],
  ): Array<{ token: string; model: string }> => {
    const slotCount = Math.max(
      ...rotationTokens.map((token) => token.maximumPreparingProcessCount),
    );
    const tokenSlots: Array<{ token: string; model: string }> = [];
    for (let i = 0; i < slotCount; i++) {
      tokenSlots.push(
        ...rotationTokens
          .filter((token) => i < token.maximumPreparingProcessCount)
          .map((token) => ({ token: token.token, model: token.model })),
      );
    }
    return tokenSlots;
  };

  private resolveMaximumPreparingIssuesCount = (
    configuredMaximumPreparingIssuesCount: number | null,
    rotationTokenSlots: Array<{ token: string; model: string }> | null,
  ): number => {
    if (rotationTokenSlots === null) {
      return configuredMaximumPreparingIssuesCount ?? 6;
    }
    return Math.min(
      configuredMaximumPreparingIssuesCount ?? rotationTokenSlots.length,
      rotationTokenSlots.length,
    );
  };

  buildRotationOrder = (
    tokenUsages: ClaudeTokenUsage[],
    utilizationPercentageThreshold: number,
    modelName: string | null,
  ): RotationOrderEntry[] => {
    const weeklyLimitType = this.weeklyLimitTypeForModel(modelName);
    const isWeeklyLimitRejected = (usage: ClaudeTokenUsage): boolean =>
      usage.modelWeeklyLimits[weeklyLimitType]?.rejected === true ||
      usage.modelWeeklyLimits['seven_day']?.rejected === true;
    const selectedTokens = tokenUsages
      .filter((usage) => !usage.blocked)
      .filter((usage) => !usage.rejected)
      .filter((usage) => !isWeeklyLimitRejected(usage))
      .filter(
        (usage) =>
          this.maximumPreparingProcessCountForToken(usage.fiveHourUtilization) >
          0,
      )
      .sort((a, b) => a.fiveHourUtilization - b.fiveHourUtilization);
    const selectedTokenValues = new Set(selectedTokens.map((u) => u.token));
    const excluded: RotationOrderEntry[] = tokenUsages
      .filter((usage) => !selectedTokenValues.has(usage.token))
      .map((usage) => ({
        name: usage.name ?? '',
        fiveHourUtilization: usage.fiveHourUtilization,
        blocked: usage.blocked,
        rejected: usage.rejected,
        thresholdExcluded:
          !usage.blocked &&
          !usage.rejected &&
          !isWeeklyLimitRejected(usage) &&
          this.maximumPreparingProcessCountForToken(
            usage.fiveHourUtilization,
          ) === 0,
      }));
    const selectedEntries: RotationOrderEntry[] = selectedTokens.map(
      (usage) => ({
        name: usage.name ?? '',
        fiveHourUtilization: usage.fiveHourUtilization,
        blocked: false,
        rejected: false,
        thresholdExcluded: false,
      }),
    );
    return [...selectedEntries, ...excluded];
  };

  run = async (params: {
    projectUrl: string;
    defaultAgentName: string;
    defaultLlmModelName: string | null;
    defaultLlmAgentName: string | null;
    configFilePath: string;
    maximumPreparingIssuesCount: number | null;
    utilizationPercentageThreshold: number;
    allowedIssueAuthors: string[] | null;
    codexHomeCandidates: string[] | null;
    allowIssueCacheMinutes: number;
  }): Promise<{ rotationOrder: RotationOrderEntry[] | null }> => {
    const tokenUsages =
      await this.claudeTokenUsageRepository.getAvailableTokenUsages();
    let rotationTokenSlots: Array<{ token: string; model: string }> | null =
      null;
    let proxyBaseUrl: string | null = null;
    const rotationOrder: RotationOrderEntry[] | null =
      tokenUsages.length > 0
        ? this.buildRotationOrder(
            tokenUsages,
            params.utilizationPercentageThreshold,
            params.defaultLlmModelName,
          )
        : null;
    if (tokenUsages.length > 0) {
      const ranked = this.selectRotationTokens(
        tokenUsages,
        params.defaultLlmModelName,
      );
      if (ranked.length === 0) {
        console.warn(
          `All ${tokenUsages.length} configured Claude OAuth token(s) are unavailable (blocked, rejected, all model weekly limits exhausted, or 5h utilization >= 95%). Skipping starting preparation.`,
        );
        return { rotationOrder };
      }
      await this.claudeTokenUsageRepository.ensureObservable();
      rotationTokenSlots = this.createRotationTokenSlots(ranked);
      proxyBaseUrl = this.claudeTokenUsageRepository.proxyBaseUrl();
    }
    const maximumPreparingIssuesCount = this.resolveMaximumPreparingIssuesCount(
      params.maximumPreparingIssuesCount,
      rotationTokenSlots,
    );

    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const storyObjectMap = await this.issueRepository.getStoryObjectMap(
      project,
      params.allowIssueCacheMinutes,
    );

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

    const awaitingWorkspaceIssues = allOpenedIssues
      .filter(
        (issue) =>
          issue.status === AWAITING_WORKSPACE_STATUS_NAME && !issue.isClosed,
      )
      .map((issue) => ({ ...issue }));
    const currentPreparationIssueCount = allOpenedIssues.filter(
      (issue) => issue.status === PREPARATION_STATUS_NAME,
    ).length;
    let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
    let startedInThisRunCount = 0;

    const now = new Date();
    const currentHour = now.getHours();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrowStart = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      todayStart.getDate() + 1,
    );

    for (
      let i = 0;
      i < awaitingWorkspaceIssues.length &&
      updatedCurrentPreparationIssueCount < maximumPreparingIssuesCount;
      i++
    ) {
      const issue = awaitingWorkspaceIssues[i];
      if (issue.dependedIssueUrls.length > 0) {
        continue;
      }
      if (
        issue.nextActionDate !== null &&
        issue.nextActionDate >= tomorrowStart
      ) {
        continue;
      }
      if (issue.nextActionHour !== null && currentHour < issue.nextActionHour) {
        continue;
      }
      if (
        params.allowedIssueAuthors !== null &&
        !params.allowedIssueAuthors.includes(issue.author)
      ) {
        if (issue.author === '') {
          console.warn(
            `Skipping issue ${issue.url}: author is unknown (empty string); deny-by-default when allowedIssueAuthors is configured.`,
          );
        } else {
          console.warn(
            `Skipping issue ${issue.url}: author '${issue.author}' is not in the allowedIssueAuthors list.`,
          );
        }
        continue;
      }
      const agent =
        issue.labels
          .find((label: string) => label.startsWith('llm-agent:'))
          ?.replace('llm-agent:', '')
          .trim() ||
        issue.labels
          .find((label: string) => label.startsWith('category:'))
          ?.replace('category:', '')
          .trim() ||
        params.defaultLlmAgentName ||
        params.defaultAgentName;
      const model =
        issue.labels
          .find((label: string) => label.startsWith('llm-model:'))
          ?.replace('llm-model:', '')
          .trim() || params.defaultLlmModelName;
      if (!model && rotationTokenSlots === null) {
        console.error(
          `No LLM model configured for issue ${issue.url}. Provide --defaultLlmModelName or add an llm-model: label.`,
        );
        continue;
      }
      const isPrUrl = issue.url.includes('/pull/');
      let branchName: string;
      if (isPrUrl) {
        const pr = await this.issueRepository.getOpenPullRequest(issue.url);
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
        const relatedPRs = await this.issueRepository.findRelatedOpenPRs(
          issue.url,
        );
        if (relatedPRs.length > 1) {
          const sortedPRs = [...relatedPRs].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          );
          const canonicalPR = sortedPRs[0];
          const duplicatePRs = sortedPRs.slice(1);
          for (const duplicatePR of duplicatePRs) {
            await this.issueRepository.closePullRequest(duplicatePR.url);
            if (duplicatePR.branchName !== null) {
              await this.issueRepository.deletePullRequestBranch(
                duplicatePR.url,
                duplicatePR.branchName,
              );
            }
            await this.issueRepository.createCommentByUrl(
              duplicatePR.url,
              `This PR was automatically closed to resolve multiple-open-PR ambiguity for issue ${issue.url}. The adopted canonical PR is ${canonicalPR.url}.`,
            );
          }
          const removedPrUrls = duplicatePRs.map((pr) => pr.url).join(', ');
          await this.issueRepository.createCommentByUrl(
            issue.url,
            `${duplicatePRs.length} duplicate PR(s) were automatically closed to resolve multiple-open-PR ambiguity.\n\nRemoved PRs: ${removedPrUrls}\nAdopted PR: ${canonicalPR.url}`,
          );
          if (canonicalPR.branchName === null) {
            console.warn(
              `Skipping issue ${issue.url}: adopted canonical PR has unavailable head branch.`,
            );
            continue;
          }
          branchName = canonicalPR.branchName;
        } else if (relatedPRs.length === 1) {
          if (relatedPRs[0].branchName === null) {
            console.warn(
              `Skipping issue ${issue.url}: related open PR has unavailable head branch.`,
            );
            continue;
          }
          branchName = relatedPRs[0].branchName;
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

      await this.issueRepository.updateStatus(
        project,
        issue,
        preparationStatusOption.id,
      );
      issue.status = PREPARATION_STATUS_NAME;

      let spawnEnv: Record<string, string> | undefined;
      let spawnModel = model ?? '';
      if (rotationTokenSlots !== null && proxyBaseUrl !== null) {
        const selected =
          rotationTokenSlots[
            (currentPreparationIssueCount + startedInThisRunCount) %
              rotationTokenSlots.length
          ];
        spawnModel = selected.model;
        spawnEnv = {
          CLAUDE_CODE_OAUTH_TOKEN: selected.token,
          ANTHROPIC_BASE_URL: proxyBaseUrl,
        };
      }

      const awArgs: string[] = [
        issue.url,
        agent,
        spawnModel,
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
      await this.localCommandRunner.runCommand(
        'aw',
        awArgs,
        spawnEnv ? { env: spawnEnv } : undefined,
      );
      startedInThisRunCount++;
      updatedCurrentPreparationIssueCount++;
    }
    return { rotationOrder };
  };
}
