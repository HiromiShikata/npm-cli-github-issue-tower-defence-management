"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = exports.DEFAULT_FALLBACK_LLM_MODEL_NAME = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const NORMAL_CONCURRENT_LIMIT = 6;
const SEVEN_DAY_THROTTLE_START_THRESHOLD = 0.8;
const FIVE_HOUR_THROTTLE_START_THRESHOLD = 0.8;
exports.DEFAULT_FALLBACK_LLM_MODEL_NAME = 'claude-opus-4-8';
class StartPreparationUseCase {
    constructor(projectRepository, issueRepository, localCommandRunner, claudeTokenUsageRepository, takeOwnershipSpawnRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.claudeTokenUsageRepository = claudeTokenUsageRepository;
        this.takeOwnershipSpawnRepository = takeOwnershipSpawnRepository;
        this.weeklyLimitTypeForModel = (modelName) => {
            const normalized = (modelName ?? '').toLowerCase();
            if (normalized.includes('sonnet'))
                return 'seven_day_sonnet';
            if (normalized.includes('opus'))
                return 'seven_day_opus';
            return 'seven_day';
        };
        this.isWithinCooldown = (usage, nowEpochSeconds) => usage.blockedUntilEpoch > nowEpochSeconds;
        this.isModelWeeklyLimitRejected = (usage, weeklyLimitType) => {
            const specific = usage.modelWeeklyLimits[weeklyLimitType];
            if (specific !== undefined && specific.rejected)
                return true;
            const general = usage.modelWeeklyLimits['seven_day'];
            return general !== undefined && general.rejected;
        };
        this.selectModelForToken = (usage, defaultModelName, fallbackModelName) => {
            const generalWeeklyLimit = usage.modelWeeklyLimits['seven_day'];
            if (generalWeeklyLimit !== undefined && generalWeeklyLimit.rejected) {
                return null;
            }
            const candidateModelNames = [defaultModelName, fallbackModelName].filter((modelName) => modelName !== null && modelName !== '');
            for (const candidateModelName of candidateModelNames) {
                const weeklyLimitType = this.weeklyLimitTypeForModel(candidateModelName);
                const specificWeeklyLimit = usage.modelWeeklyLimits[weeklyLimitType];
                if (specificWeeklyLimit === undefined || !specificWeeklyLimit.rejected) {
                    return candidateModelName;
                }
            }
            return null;
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
        this.compareBySevenDayDeadlineThenUtilization = (a, aWeeklyLimitType, b, bWeeklyLimitType, nowEpochSeconds) => {
            const aSecondsUntilReset = this.secondsUntilSevenDayReset(a, aWeeklyLimitType, nowEpochSeconds);
            const bSecondsUntilReset = this.secondsUntilSevenDayReset(b, bWeeklyLimitType, nowEpochSeconds);
            if (aSecondsUntilReset !== bSecondsUntilReset) {
                return aSecondsUntilReset - bSecondsUntilReset;
            }
            return a.fiveHourUtilization - b.fiveHourUtilization;
        };
        this.taperedConcurrentLimit = (utilization, throttleStartThreshold) => {
            if (utilization < throttleStartThreshold) {
                return NORMAL_CONCURRENT_LIMIT;
            }
            const remaining = (1 - utilization) / (1 - throttleStartThreshold);
            return Math.max(1, Math.ceil(NORMAL_CONCURRENT_LIMIT * remaining));
        };
        this.getTokenConcurrentLimit = (fiveHourUtilization, sevenDayUtilization) => {
            const sevenDayLimit = this.taperedConcurrentLimit(sevenDayUtilization, SEVEN_DAY_THROTTLE_START_THRESHOLD);
            const fiveHourLimit = this.taperedConcurrentLimit(fiveHourUtilization, FIVE_HOUR_THROTTLE_START_THRESHOLD);
            return Math.min(sevenDayLimit, fiveHourLimit);
        };
        this.selectRotationTokens = (tokenUsages, utilizationPercentageThreshold, defaultModelName, fallbackModelName, maxConcurrent) => {
            const nowEpochSeconds = Date.now() / 1000;
            const eligibleTokens = tokenUsages
                .filter((usage) => !usage.blocked)
                .filter((usage) => !usage.fiveHourRejected)
                .filter((usage) => !this.isWithinCooldown(usage, nowEpochSeconds))
                .filter((usage) => usage.fiveHourUtilization * 100 < utilizationPercentageThreshold)
                .flatMap((usage) => {
                const model = this.selectModelForToken(usage, defaultModelName, fallbackModelName);
                if (model === null)
                    return [];
                return [{ usage, model }];
            })
                .sort((a, b) => this.compareBySevenDayDeadlineThenUtilization(a.usage, this.weeklyLimitTypeForModel(a.model), b.usage, this.weeklyLimitTypeForModel(b.model), nowEpochSeconds));
            if (eligibleTokens.length === 0) {
                return { tokens: [], effectiveCap: 0, tokensWithLimits: [] };
            }
            const tokensWithLimits = eligibleTokens.map(({ usage, model }) => ({
                token: usage.token,
                model,
                limit: this.getTokenConcurrentLimit(usage.fiveHourUtilization, usage.sevenDayUtilization),
                secondsUntilSevenDayReset: this.secondsUntilSevenDayReset(usage, this.weeklyLimitTypeForModel(model), nowEpochSeconds),
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
            return { tokens: rotationList, effectiveCap, tokensWithLimits };
        };
        this.buildRotationOrder = (tokenUsages, utilizationPercentageThreshold, modelName) => {
            const weeklyLimitType = this.weeklyLimitTypeForModel(modelName);
            const nowEpochSeconds = Date.now() / 1000;
            const selectedTokens = tokenUsages
                .filter((usage) => !usage.blocked)
                .filter((usage) => !usage.fiveHourRejected)
                .filter((usage) => !this.isWithinCooldown(usage, nowEpochSeconds))
                .filter((usage) => !this.isModelWeeklyLimitRejected(usage, weeklyLimitType))
                .filter((usage) => usage.fiveHourUtilization * 100 < utilizationPercentageThreshold)
                .sort((a, b) => this.compareBySevenDayDeadlineThenUtilization(a, weeklyLimitType, b, weeklyLimitType, nowEpochSeconds));
            const selectedTokenValues = new Set(selectedTokens.map((u) => u.token));
            const excluded = tokenUsages
                .filter((usage) => !selectedTokenValues.has(usage.token))
                .map((usage) => ({
                name: usage.name ?? '',
                fiveHourUtilization: usage.fiveHourUtilization,
                blocked: usage.blocked,
                rejected: usage.fiveHourRejected,
                thresholdExcluded: !usage.blocked &&
                    !usage.fiveHourRejected &&
                    !this.isWithinCooldown(usage, nowEpochSeconds) &&
                    !this.isModelWeeklyLimitRejected(usage, weeklyLimitType) &&
                    usage.fiveHourUtilization * 100 >= utilizationPercentageThreshold,
                cooldownExcluded: !usage.blocked &&
                    !usage.fiveHourRejected &&
                    this.isWithinCooldown(usage, nowEpochSeconds),
            }));
            const selectedEntries = selectedTokens.map((usage) => ({
                name: usage.name ?? '',
                fiveHourUtilization: usage.fiveHourUtilization,
                blocked: false,
                rejected: false,
                thresholdExcluded: false,
                cooldownExcluded: false,
            }));
            return [...selectedEntries, ...excluded];
        };
        this.run = async (params) => {
            const tokenUsages = await this.claudeTokenUsageRepository.getAvailableTokenUsages();
            let rotationTokens = null;
            let proxyBaseUrl = null;
            let selectedTokensWithLimits = [];
            let tokenInFlightCounts = {};
            const rotationOrder = tokenUsages.length > 0
                ? this.buildRotationOrder(tokenUsages, params.utilizationPercentageThreshold, params.defaultLlmModelName)
                : null;
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? NORMAL_CONCURRENT_LIMIT;
            let effectiveMaxPreparingIssuesCount = maximumPreparingIssuesCount;
            const fallbackLlmModelName = params.fallbackLlmModelName ?? exports.DEFAULT_FALLBACK_LLM_MODEL_NAME;
            if (tokenUsages.length > 0) {
                const { tokens: selectedTokens, effectiveCap: selectedCap, tokensWithLimits: selectedTokensWithLimitsLocal, } = this.selectRotationTokens(tokenUsages, params.utilizationPercentageThreshold, params.defaultLlmModelName, fallbackLlmModelName, maximumPreparingIssuesCount);
                if (selectedTokens.length === 0) {
                    console.warn(`All ${tokenUsages.length} configured Claude OAuth token(s) are unavailable (blocked, 5h-window rejected, within cooldown, weekly limits for every candidate model exhausted, or 5h utilization >= ${params.utilizationPercentageThreshold}%). Skipping starting preparation.`);
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
            const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
            const allOpenedIssues = Array.from(storyObjectMap.values()).flatMap((storyObject) => storyObject.issues);
            const preparationStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.PREPARATION_STATUS_NAME);
            if (!preparationStatusOption) {
                console.error(`Preparation status option '${WorkflowStatus_1.PREPARATION_STATUS_NAME}' not found in project.`);
                return { rotationOrder };
            }
            const runningIssueUrls = new Set(this.takeOwnershipSpawnRepository.listRunningIssueUrls());
            const awaitingWorkspaceIssues = allOpenedIssues
                .filter((issue) => issue.status === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME && !issue.isClosed)
                .map((issue) => ({ ...issue }));
            const allProjectOpenIssues = await this.issueRepository.getAllOpened(project);
            const storyUnsetAwaitingWorkspaceIssueUrls = allProjectOpenIssues
                .filter((issue) => issue.status === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME &&
                !issue.isClosed &&
                issue.story === null)
                .map((issue) => issue.url);
            if (storyUnsetAwaitingWorkspaceIssueUrls.length > 0) {
                console.warn(`Awaiting Workspace issue(s) invisible to spawn candidate selection because Story is unset: ${storyUnsetAwaitingWorkspaceIssueUrls.join(', ')}`);
            }
            const currentPreparationIssueCount = allOpenedIssues.filter((issue) => issue.status === WorkflowStatus_1.PREPARATION_STATUS_NAME).length;
            let updatedCurrentPreparationIssueCount = currentPreparationIssueCount;
            let startedInThisRunCount = 0;
            const spawnedInThisRunByToken = {};
            const exclusionCounts = {
                dependedIssueUrls: 0,
                futureNextActionDate: 0,
                nextActionHourNotReached: 0,
                authorNotAllowed: 0,
            };
            const now = new Date();
            const currentHour = now.getHours();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1);
            for (let i = 0; i < awaitingWorkspaceIssues.length &&
                updatedCurrentPreparationIssueCount < effectiveMaxPreparingIssuesCount; i++) {
                const issue = awaitingWorkspaceIssues[i];
                if (issue.dependedIssueUrls.length > 0) {
                    exclusionCounts.dependedIssueUrls++;
                    continue;
                }
                if (runningIssueUrls.has(issue.url)) {
                    console.log(`Skipping ${issue.url}: worker already running.`);
                    continue;
                }
                if (issue.nextActionDate !== null &&
                    issue.nextActionDate >= tomorrowStart) {
                    exclusionCounts.futureNextActionDate++;
                    continue;
                }
                if (issue.nextActionHour !== null && currentHour < issue.nextActionHour) {
                    exclusionCounts.nextActionHourNotReached++;
                    continue;
                }
                if (params.allowedIssueAuthors === null ||
                    params.allowedIssueAuthors.length === 0 ||
                    !params.allowedIssueAuthors.includes(issue.author)) {
                    exclusionCounts.authorNotAllowed++;
                    continue;
                }
                const mappedAgentFromLabel = params.labelsAsLlmAgentName !== null
                    ? issue.labels.find((label) => params.labelsAsLlmAgentName !== null
                        ? params.labelsAsLlmAgentName.includes(label)
                        : false)
                    : undefined;
                const agent = issue.labels
                    .find((label) => label.startsWith('llm-agent:'))
                    ?.replace('llm-agent:', '')
                    .trim() ||
                    mappedAgentFromLabel ||
                    issue.labels
                        .find((label) => label.startsWith('category:'))
                        ?.replace('category:', '')
                        .trim() ||
                    params.defaultLlmAgentName ||
                    params.defaultAgentName;
                const labelModelName = issue.labels
                    .find((label) => label.startsWith('llm-model:'))
                    ?.replace('llm-model:', '')
                    .trim();
                if (!labelModelName &&
                    !params.defaultLlmModelName &&
                    rotationTokens === null) {
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
                let spawnEnv;
                let routedModelName = null;
                if (rotationTokens !== null && proxyBaseUrl !== null) {
                    const tokenWithSoonestResetAmongAvailable = selectedTokensWithLimits
                        .map((t) => ({
                        token: t.token,
                        model: t.model,
                        remaining: t.limit -
                            (tokenInFlightCounts[t.token] ?? 0) -
                            (spawnedInThisRunByToken[t.token] ?? 0),
                        secondsUntilSevenDayReset: t.secondsUntilSevenDayReset,
                    }))
                        .filter((t) => t.remaining > 0)
                        .sort((a, b) => {
                        if (a.secondsUntilSevenDayReset !== b.secondsUntilSevenDayReset) {
                            return a.secondsUntilSevenDayReset - b.secondsUntilSevenDayReset;
                        }
                        return b.remaining - a.remaining;
                    })[0];
                    if (tokenWithSoonestResetAmongAvailable === undefined) {
                        break;
                    }
                    const selected = tokenWithSoonestResetAmongAvailable.token;
                    routedModelName = tokenWithSoonestResetAmongAvailable.model;
                    spawnedInThisRunByToken[selected] =
                        (spawnedInThisRunByToken[selected] ?? 0) + 1;
                    spawnEnv = {
                        CLAUDE_CODE_OAUTH_TOKEN: selected,
                        ANTHROPIC_BASE_URL: proxyBaseUrl,
                    };
                }
                const model = labelModelName || routedModelName || params.defaultLlmModelName;
                if (!model) {
                    console.error(`No LLM model configured for issue ${issue.url}. Provide --defaultLlmModelName or add an llm-model: label.`);
                    continue;
                }
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
                await this.localCommandRunner.runCommand('aw', awArgs, spawnEnv ? { env: spawnEnv } : undefined);
                startedInThisRunCount++;
                updatedCurrentPreparationIssueCount++;
            }
            console.log(`Spawn candidate exclusion summary for ${params.projectUrl}: dependedIssueUrls=${exclusionCounts.dependedIssueUrls}, futureNextActionDate=${exclusionCounts.futureNextActionDate}, nextActionHourNotReached=${exclusionCounts.nextActionHourNotReached}, authorNotAllowed=${exclusionCounts.authorNotAllowed}`);
            return { rotationOrder };
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map