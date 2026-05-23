import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';

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
    private readonly claudeRepository: Pick<ClaudeRepository, 'getUsage'>,
    private readonly localCommandRunner: LocalCommandRunner,
  ) {}

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
    claudeCodeOauthTokens: string[] | null;
    claudeProxyBaseUrl: string | null;
    allowIssueCacheMinutes: number;
  }): Promise<void> => {
    const claudeUsages = await this.claudeRepository.getUsage();
    const weeklyWindowHours = 168;
    const nonWeeklyUsages = claudeUsages.filter(
      (usage) => usage.hour !== weeklyWindowHours,
    );
    if (
      nonWeeklyUsages.some(
        (usage) =>
          usage.utilizationPercentage > params.utilizationPercentageThreshold,
      )
    ) {
      console.warn(
        'Claude usage limit exceeded. Skipping starting preparation.',
      );
      return;
    }

    let maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? 6;

    const weeklyUsages = claudeUsages.filter(
      (usage) => usage.hour === weeklyWindowHours,
    );
    if (
      weeklyUsages.length > 0 &&
      params.utilizationPercentageThreshold < 100
    ) {
      const maxWeeklyUtilization = Math.max(
        ...weeklyUsages.map((usage) => usage.utilizationPercentage),
      );
      if (maxWeeklyUtilization > params.utilizationPercentageThreshold) {
        const normalizedUtilizationBeyondThreshold =
          (maxWeeklyUtilization - params.utilizationPercentageThreshold) /
          (100 - params.utilizationPercentageThreshold);
        maximumPreparingIssuesCount = Math.floor(
          maximumPreparingIssuesCount *
            Math.pow(1 - normalizedUtilizationBeyondThreshold, 2),
        );
        if (maximumPreparingIssuesCount <= 0) {
          console.warn(
            `Weekly Claude usage (${maxWeeklyUtilization}%) exceeds threshold (${params.utilizationPercentageThreshold}%). Skipping starting preparation.`,
          );
          return;
        }
        console.warn(
          `Weekly Claude usage (${maxWeeklyUtilization}%) exceeds threshold (${params.utilizationPercentageThreshold}%). Reducing maximumPreparingIssuesCount to ${maximumPreparingIssuesCount}.`,
        );
      }
    }
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
      return;
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
      if (!model) {
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
      let spawnEnv: Record<string, string> | undefined;
      if (
        params.claudeCodeOauthTokens !== null &&
        params.claudeCodeOauthTokens.length > 0 &&
        params.claudeProxyBaseUrl !== null
      ) {
        const tokens = params.claudeCodeOauthTokens;
        const selected = tokens[startedInThisRunCount % tokens.length];
        spawnEnv = {
          CLAUDE_CODE_OAUTH_TOKEN: selected,
          ANTHROPIC_BASE_URL: params.claudeProxyBaseUrl,
        };
      }
      await this.localCommandRunner.runCommand(
        'aw',
        awArgs,
        spawnEnv ? { env: spawnEnv } : undefined,
      );
      startedInThisRunCount++;
      updatedCurrentPreparationIssueCount++;
    }
  };
}
