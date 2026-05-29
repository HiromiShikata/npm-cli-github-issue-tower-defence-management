"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const SEVEN_DAY_NORMAL_CONCURRENT_LIMIT = 6;
const SEVEN_DAY_THROTTLE_START_THRESHOLD = 0.8;
class StartPreparationUseCase {
    constructor(projectRepository, issueRepository, localCommandRunner, claudeTokenUsageRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.claudeTokenUsageRepository = claudeTokenUsageRepository;
        this.weeklyLimitTypeForModel = (modelName) => {
            const normalized = (modelName ?? '').toLowerCase();
            if (normalized.includes('sonnet'))
                return 'seven_day_sonnet';
            if (normalized.includes('opus'))
                return 'seven_day_opus';
            return 'seven_day';
        };
        this.isModelWeeklyLimitRejected = (usage, weeklyLimitType) => {
            const specific = usage.modelWeeklyLimits[weeklyLimitType];
            if (specific !== undefined && specific.rejected)
                return true;
            const general = usage.modelWeeklyLimits['seven_day'];
            return general !== undefined && general.rejected;
        };
        this.secondsUntilSevenDayReset = (usage, weeklyLimitType, nowEpochSeconds) => {
            const specific = usage.modelWeeklyLimits[weeklyLimitType];
            if (specific !== undefined) {
                return specific.resetsAt - nowEpochSeconds;
            }
            const general = usage.modelWeeklyLimits['seven_day'];
            if (general !== undefined) {
                return general.resetsAt - nowEpochSeconds;
            }
            return Number.POSITIVE_INFINITY;
        };
        this.compareBySevenDayDeadlineThenUtilization = (a, b, weeklyLimitType, nowEpochSeconds) => {
            const aSecondsUntilReset = this.secondsUntilSevenDayReset(a, weeklyLimitType, nowEpochSeconds);
            const bSecondsUntilReset = this.secondsUntilSevenDayReset(b, weeklyLimitType, nowEpochSeconds);
            if (aSecondsUntilReset !== bSecondsUntilReset) {
                return aSecondsUntilReset - bSecondsUntilReset;
            }
            return a.fiveHourUtilization - b.fiveHourUtilization;
        };
        this.getTokenConcurrentLimit = (sevenDayUtilization) => {
            if (sevenDayUtilization < SEVEN_DAY_THROTTLE_START_THRESHOLD) {
                return SEVEN_DAY_NORMAL_CONCURRENT_LIMIT;
            }
            const remaining = (1 - sevenDayUtilization) / (1 - SEVEN_DAY_THROTTLE_START_THRESHOLD);
            return Math.max(1, Math.ceil(SEVEN_DAY_NORMAL_CONCURRENT_LIMIT * remaining));
        };
        this.selectRotationTokens = (tokenUsages, utilizationPercentageThreshold, modelName, maxConcurrent) => {
            const weeklyLimitType = this.weeklyLimitTypeForModel(modelName);
            const nowEpochSeconds = Date.now() / 1000;
            const eligibleTokens = tokenUsages
                .filter((usage) => !usage.blocked)
                .filter((usage) => !usage.rejected)
                .filter((usage) => !this.isModelWeeklyLimitRejected(usage, weeklyLimitType))
                .filter((usage) => usage.fiveHourUtilization * 100 < utilizationPercentageThreshold)
                .sort((a, b) => this.compareBySevenDayDeadlineThenUtilization(a, b, weeklyLimitType, nowEpochSeconds));
            if (eligibleTokens.length === 0) {
                return { tokens: [], effectiveCap: 0 };
            }
            const tokensWithLimits = eligibleTokens.map((usage) => ({
                token: usage.token,
                limit: this.getTokenConcurrentLimit(usage.sevenDayUtilization),
            }));
            const totalCapacity = tokensWithLimits.reduce((sum, t) => sum + t.limit, 0);
            const effectiveCap = Math.min(maxConcurrent, totalCapacity);
            const maxLimit = Math.max(...tokensWithLimits.map((t) => t.limit));
            const rotationList = [];
            for (let round = 0; round < maxLimit; round++) {
                for (const t of tokensWithLimits) {
                    if (t.limit > round) {
                        rotationList.push(t.token);
                    }
                }
            }
            return { tokens: rotationList, effectiveCap };
        };
        this.buildRotationOrder = (tokenUsages, utilizationPercentageThreshold, modelName) => {
            const weeklyLimitType = this.weeklyLimitTypeForModel(modelName);
            const nowEpochSeconds = Date.now() / 1000;
            const selectedTokens = tokenUsages
                .filter((usage) => !usage.blocked)
                .filter((usage) => !usage.rejected)
                .filter((usage) => !this.isModelWeeklyLimitRejected(usage, weeklyLimitType))
                .filter((usage) => usage.fiveHourUtilization * 100 < utilizationPercentageThreshold)
                .sort((a, b) => this.compareBySevenDayDeadlineThenUtilization(a, b, weeklyLimitType, nowEpochSeconds));
            const selectedTokenValues = new Set(selectedTokens.map((u) => u.token));
            const excluded = tokenUsages
                .filter((usage) => !selectedTokenValues.has(usage.token))
                .map((usage) => ({
                name: usage.name ?? '',
                fiveHourUtilization: usage.fiveHourUtilization,
                blocked: usage.blocked,
                rejected: usage.rejected,
                thresholdExcluded: !usage.blocked &&
                    !usage.rejected &&
                    !this.isModelWeeklyLimitRejected(usage, weeklyLimitType) &&
                    usage.fiveHourUtilization * 100 >= utilizationPercentageThreshold,
            }));
            const selectedEntries = selectedTokens.map((usage) => ({
                name: usage.name ?? '',
                fiveHourUtilization: usage.fiveHourUtilization,
                blocked: false,
                rejected: false,
                thresholdExcluded: false,
            }));
            return [...selectedEntries, ...excluded];
        };
        this.run = async (params) => {
            const tokenUsages = await this.claudeTokenUsageRepository.getAvailableTokenUsages();
            let rotationTokens = null;
            let proxyBaseUrl = null;
            const rotationOrder = tokenUsages.length > 0
                ? this.buildRotationOrder(tokenUsages, params.utilizationPercentageThreshold, params.defaultLlmModelName)
                : null;
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? SEVEN_DAY_NORMAL_CONCURRENT_LIMIT;
            let effectiveMaxPreparingIssuesCount = maximumPreparingIssuesCount;
            if (tokenUsages.length > 0) {
                const { tokens: ranked, effectiveCap } = this.selectRotationTokens(tokenUsages, params.utilizationPercentageThreshold, params.defaultLlmModelName, maximumPreparingIssuesCount);
                if (ranked.length === 0) {
                    console.warn(`All ${tokenUsages.length} configured Claude OAuth token(s) are unavailable (blocked, rejected, weekly limit for ${this.weeklyLimitTypeForModel(params.defaultLlmModelName)} exhausted, or 5h utilization >= ${params.utilizationPercentageThreshold}%). Skipping starting preparation.`);
                    return { rotationOrder };
                }
                await this.claudeTokenUsageRepository.ensureObservable();
                rotationTokens = ranked;
                effectiveMaxPreparingIssuesCount = effectiveCap;
                proxyBaseUrl = this.claudeTokenUsageRepository.proxyBaseUrl();
            }
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const storyObjectMap = await this.issueRepository.getStoryObjectMap(project, params.allowIssueCacheMinutes);
            const allOpenedIssues = Array.from(storyObjectMap.values()).flatMap((storyObject) => storyObject.issues);
            const preparationStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.PREPARATION_STATUS_NAME);
            if (!preparationStatusOption) {
                console.error(`Preparation status option '${WorkflowStatus_1.PREPARATION_STATUS_NAME}' not found in project.`);
                return { rotationOrder };
            }
            const awaitingWorkspaceIssues = allOpenedIssues
                .filter((issue) => issue.status === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME && !issue.isClosed)
                .map((issue) => ({ ...issue }));
            const currentPreparationIssueCount = allOpenedIssues.filter((issue) => issue.status === WorkflowStatus_1.PREPARATION_STATUS_NAME).length;
            let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
            let startedInThisRunCount = 0;
            const now = new Date();
            const currentHour = now.getHours();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1);
            for (let i = 0; i < awaitingWorkspaceIssues.length &&
                updatedCurrentPreparationIssueCount < effectiveMaxPreparingIssuesCount; i++) {
                const issue = awaitingWorkspaceIssues[i];
                if (issue.dependedIssueUrls.length > 0) {
                    continue;
                }
                if (issue.nextActionDate !== null &&
                    issue.nextActionDate >= tomorrowStart) {
                    continue;
                }
                if (issue.nextActionHour !== null && currentHour < issue.nextActionHour) {
                    continue;
                }
                if (params.allowedIssueAuthors !== null &&
                    !params.allowedIssueAuthors.includes(issue.author)) {
                    continue;
                }
                const agent = issue.labels
                    .find((label) => label.startsWith('llm-agent:'))
                    ?.replace('llm-agent:', '')
                    .trim() ||
                    issue.labels
                        .find((label) => label.startsWith('category:'))
                        ?.replace('category:', '')
                        .trim() ||
                    params.defaultLlmAgentName ||
                    params.defaultAgentName;
                const model = issue.labels
                    .find((label) => label.startsWith('llm-model:'))
                    ?.replace('llm-model:', '')
                    .trim() || params.defaultLlmModelName;
                if (!model) {
                    console.error(`No LLM model configured for issue ${issue.url}. Provide --defaultLlmModelName or add an llm-model: label.`);
                    continue;
                }
                const isPrUrl = issue.url.includes('/pull/');
                let branchName;
                if (isPrUrl) {
                    const pr = await this.issueRepository.getOpenPullRequest(issue.url);
                    if (pr === null) {
                        console.warn(`Skipping non-OPEN PR ${issue.url}: wrapper requires an open PR.`);
                        continue;
                    }
                    if (pr.branchName === null) {
                        console.warn(`Skipping PR ${issue.url}: head branch is unavailable.`);
                        continue;
                    }
                    branchName = pr.branchName;
                }
                else {
                    const relatedPRs = await this.issueRepository.findRelatedOpenPRs(issue.url);
                    if (relatedPRs.length > 1) {
                        const sortedPRs = [...relatedPRs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                        const canonicalPR = sortedPRs[0];
                        const duplicatePRs = sortedPRs.slice(1);
                        for (const duplicatePR of duplicatePRs) {
                            await this.issueRepository.closePullRequest(duplicatePR.url);
                            if (duplicatePR.branchName !== null) {
                                await this.issueRepository.deletePullRequestBranch(duplicatePR.url, duplicatePR.branchName);
                            }
                            await this.issueRepository.createCommentByUrl(duplicatePR.url, `This PR was automatically closed to resolve multiple-open-PR ambiguity for issue ${issue.url}. The adopted canonical PR is ${canonicalPR.url}.`);
                        }
                        const removedPrUrls = duplicatePRs.map((pr) => pr.url).join(', ');
                        await this.issueRepository.createCommentByUrl(issue.url, `${duplicatePRs.length} duplicate PR(s) were automatically closed to resolve multiple-open-PR ambiguity.\n\nRemoved PRs: ${removedPrUrls}\nAdopted PR: ${canonicalPR.url}`);
                        if (canonicalPR.branchName === null) {
                            console.warn(`Skipping issue ${issue.url}: adopted canonical PR has unavailable head branch.`);
                            continue;
                        }
                        branchName = canonicalPR.branchName;
                    }
                    else if (relatedPRs.length === 1) {
                        if (relatedPRs[0].branchName === null) {
                            console.warn(`Skipping issue ${issue.url}: related open PR has unavailable head branch.`);
                            continue;
                        }
                        branchName = relatedPRs[0].branchName;
                    }
                    else {
                        branchName = `i${issue.number}`;
                    }
                }
                if (!/^[\w./-]+$/.test(branchName)) {
                    console.error(`Skipping issue ${issue.url}: branch name contains unexpected characters: ${branchName}`);
                    continue;
                }
                await this.issueRepository.updateStatus(project, issue, preparationStatusOption.id);
                issue.status = WorkflowStatus_1.PREPARATION_STATUS_NAME;
                const awArgs = [
                    issue.url,
                    agent,
                    model,
                    '--configFilePath',
                    params.configFilePath,
                    '--branch',
                    branchName,
                ];
                if (params.codexHomeCandidates !== null &&
                    params.codexHomeCandidates.length > 0) {
                    const codexHome = params.codexHomeCandidates[startedInThisRunCount % params.codexHomeCandidates.length];
                    awArgs.push('--codexHome', codexHome);
                }
                let spawnEnv;
                if (rotationTokens !== null && proxyBaseUrl !== null) {
                    const selected = rotationTokens[(currentPreparationIssueCount + startedInThisRunCount) %
                        rotationTokens.length];
                    spawnEnv = {
                        CLAUDE_CODE_OAUTH_TOKEN: selected,
                        ANTHROPIC_BASE_URL: proxyBaseUrl,
                    };
                }
                await this.localCommandRunner.runCommand('aw', awArgs, spawnEnv ? { env: spawnEnv } : undefined);
                startedInThisRunCount++;
                updatedCurrentPreparationIssueCount++;
            }
            return { rotationOrder };
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map