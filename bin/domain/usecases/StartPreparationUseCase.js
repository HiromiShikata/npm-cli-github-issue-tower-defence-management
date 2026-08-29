"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPreparationUseCase = exports.agentNameFromDesignation = exports.SPAWN_CANDIDATE_BRANCH_SOURCE_CONCURRENCY = exports.DEFAULT_FALLBACK_LLM_MODEL_NAME = exports.NORMAL_CONCURRENT_LIMIT = void 0;
const OauthTokenSelectUseCase_1 = require("./OauthTokenSelectUseCase");
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const RequiredProjectField_1 = require("../entities/RequiredProjectField");
const AgentDesignationLabelAdoptUseCase_1 = require("./AgentDesignationLabelAdoptUseCase");
const issueReactivationTriggerIsPending_1 = require("./issueReactivationTriggerIsPending");
const ensureAgentOptionAndGetId_1 = require("./ensureAgentOptionAndGetId");
const isAuthorAuthorizedForAutoStatusCheck_1 = require("./isAuthorAuthorizedForAutoStatusCheck");
exports.NORMAL_CONCURRENT_LIMIT = 6;
const SEVEN_DAY_THROTTLE_START_THRESHOLD = 0.8;
const FIVE_HOUR_THROTTLE_START_THRESHOLD = 0.8;
exports.DEFAULT_FALLBACK_LLM_MODEL_NAME = 'claude-opus-4-8';
const LLM_AGENT_LABEL_PREFIX = 'llm-agent:';
exports.SPAWN_CANDIDATE_BRANCH_SOURCE_CONCURRENCY = 8;
const agentNameFromDesignation = (designation) => designation.startsWith(LLM_AGENT_LABEL_PREFIX)
    ? designation.slice(LLM_AGENT_LABEL_PREFIX.length).trim()
    : designation.trim();
exports.agentNameFromDesignation = agentNameFromDesignation;
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
        this.taperedConcurrentLimit = (utilization, throttleStartThreshold, normalConcurrentLimit) => {
            if (utilization < throttleStartThreshold) {
                return normalConcurrentLimit;
            }
            const remaining = (1 - utilization) / (1 - throttleStartThreshold);
            return Math.max(1, Math.ceil(normalConcurrentLimit * remaining));
        };
        this.getTokenConcurrentLimit = (fiveHourUtilization, sevenDayUtilization, selectionWeight, normalConcurrentLimit = exports.NORMAL_CONCURRENT_LIMIT) => {
            const sevenDayLimit = this.taperedConcurrentLimit(sevenDayUtilization, SEVEN_DAY_THROTTLE_START_THRESHOLD, normalConcurrentLimit);
            const fiveHourLimit = this.taperedConcurrentLimit(fiveHourUtilization, FIVE_HOUR_THROTTLE_START_THRESHOLD, normalConcurrentLimit);
            const weight = selectionWeight ?? OauthTokenSelectUseCase_1.DEFAULT_SELECTION_WEIGHT;
            return Math.max(1, Math.floor(Math.min(sevenDayLimit, fiveHourLimit) * weight));
        };
        this.spawnCandidateExclusionReasonOf = (issue, allowedIssueAuthors, manager, now) => {
            if (issue.dependedIssueUrls.length > 0) {
                return 'dependedIssueUrls';
            }
            if ((0, issueReactivationTriggerIsPending_1.issueReactivationTriggerIsPending)(issue, now)) {
                const startOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
                return issue.nextActionDate !== null &&
                    issue.nextActionDate >= startOfTomorrow
                    ? 'futureNextActionDate'
                    : 'nextActionHourNotReached';
            }
            if (!(0, isAuthorAuthorizedForAutoStatusCheck_1.isAuthorAuthorizedForAutoStatusCheck)(issue.author, allowedIssueAuthors)) {
                return 'authorNotAllowed';
            }
            if (!issue.assignees.includes(manager)) {
                return 'notAssignedToManager';
            }
            return null;
        };
        this.fetchSpawnCandidateBranchSources = async (issueUrls) => {
            const branchSourceByIssueUrl = new Map();
            let nextIndex = 0;
            const fetchSequentially = async () => {
                while (nextIndex < issueUrls.length) {
                    const issueUrl = issueUrls[nextIndex];
                    nextIndex += 1;
                    branchSourceByIssueUrl.set(issueUrl, issueUrl.includes('/pull/')
                        ? {
                            openPullRequest: await this.issueRepository.getOpenPullRequest(issueUrl),
                            relatedOpenPullRequests: [],
                        }
                        : {
                            openPullRequest: null,
                            relatedOpenPullRequests: await this.issueRepository.findRelatedOpenPRs(issueUrl),
                        });
                }
            };
            await Promise.all(Array.from({
                length: Math.min(exports.SPAWN_CANDIDATE_BRANCH_SOURCE_CONCURRENCY, issueUrls.length),
            }, fetchSequentially));
            return branchSourceByIssueUrl;
        };
        this.selectRotationTokens = (tokenUsages, utilizationPercentageThreshold, defaultModelName, fallbackModelName, maxConcurrent, normalConcurrentLimit) => {
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
                limit: this.getTokenConcurrentLimit(usage.fiveHourUtilization, usage.sevenDayUtilization, usage.selectionWeight, normalConcurrentLimit),
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
            const normalConcurrentLimit = params.normalConcurrentLimit ?? exports.NORMAL_CONCURRENT_LIMIT;
            const tokenUsages = await this.claudeTokenUsageRepository.getAvailableTokenUsages();
            let rotationTokens = null;
            let proxyBaseUrl = null;
            let selectedTokensWithLimits = [];
            let tokenInFlightCounts = {};
            const rotationOrder = tokenUsages.length > 0
                ? this.buildRotationOrder(tokenUsages, params.utilizationPercentageThreshold, params.defaultLlmModelName)
                : null;
            const maximumPreparingIssuesCount = params.maximumPreparingIssuesCount ?? exports.NORMAL_CONCURRENT_LIMIT;
            let effectiveMaxPreparingIssuesCount = maximumPreparingIssuesCount;
            const fallbackLlmModelName = params.fallbackLlmModelName ?? exports.DEFAULT_FALLBACK_LLM_MODEL_NAME;
            if (tokenUsages.length > 0) {
                const { tokens: selectedTokens, effectiveCap: selectedCap, tokensWithLimits: selectedTokensWithLimitsLocal, } = this.selectRotationTokens(tokenUsages, params.utilizationPercentageThreshold, params.defaultLlmModelName, fallbackLlmModelName, maximumPreparingIssuesCount, normalConcurrentLimit);
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
            const awaitingWorkspaceStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
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
            let tokenInFlightCountsRefreshed = false;
            const exclusionCounts = {
                dependedIssueUrls: 0,
                futureNextActionDate: 0,
                nextActionHourNotReached: 0,
                authorNotAllowed: 0,
                notAssignedToManager: 0,
            };
            const now = new Date();
            const branchSourceByIssueUrl = await this.fetchSpawnCandidateBranchSources(awaitingWorkspaceIssues
                .filter((issue) => !runningIssueUrls.has(issue.url) &&
                this.spawnCandidateExclusionReasonOf(issue, params.allowedIssueAuthors, params.manager, now) === null)
                .map((issue) => issue.url));
            for (let i = 0; i < awaitingWorkspaceIssues.length &&
                updatedCurrentPreparationIssueCount < effectiveMaxPreparingIssuesCount; i++) {
                const issue = awaitingWorkspaceIssues[i];
                if (issue.dependedIssueUrls.length > 0) {
                    exclusionCounts.dependedIssueUrls++;
                    continue;
                }
                if (runningIssueUrls.has(issue.url)) {
                    console.warn(`Skipping ${issue.url}: worker already running.`);
                    continue;
                }
                const exclusionReason = this.spawnCandidateExclusionReasonOf(issue, params.allowedIssueAuthors, params.manager, now);
                if (exclusionReason !== null) {
                    exclusionCounts[exclusionReason]++;
                    continue;
                }
                const branchSource = branchSourceByIssueUrl.get(issue.url);
                if (branchSource === undefined) {
                    console.error(`Skipping ${issue.url}: no branch source was prefetched for this spawn candidate.`);
                    continue;
                }
                await (0, AgentDesignationLabelAdoptUseCase_1.adoptIssueAgentDesignationLabel)(issue, project, params.agents ?? [], this.projectRepository, this.issueRepository);
                const isNoStory = issue.story === null || issue.story.startsWith(RequiredProjectField_1.NO_STORY_STORY_NAME);
                const agent = (isNoStory || issue.agent === null
                    ? null
                    : (0, exports.agentNameFromDesignation)(issue.agent)) || params.defaultAgentName;
                if (issue.agent === null) {
                    const agentOptionId = await (0, ensureAgentOptionAndGetId_1.ensureAgentOptionAndGetId)(this.projectRepository, project, agent);
                    if (agentOptionId !== null) {
                        try {
                            await this.issueRepository.setIssueAgentField(issue.url, project, agentOptionId);
                            issue.agent = agent;
                        }
                        catch (err) {
                            console.error(`Failed to write Agent field for ${issue.url}: ${err instanceof Error ? err.message : String(err)}`);
                            continue;
                        }
                    }
                    else {
                        console.warn(`Agent field option '${agent}' could not be set for ${issue.url}. Proceeding without recording the agent in the Agent field.`);
                    }
                }
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
                    const pr = branchSource.openPullRequest;
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
                    const relatedPRs = branchSource.relatedOpenPullRequests;
                    const sameRepoRelatedPRs = relatedPRs.filter((pr) => {
                        const match = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\//.exec(pr.url);
                        return match === null || match[1] === issue.nameWithOwner;
                    });
                    if (sameRepoRelatedPRs.length > 1) {
                        const sortedPRs = [...sameRepoRelatedPRs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
                    else if (sameRepoRelatedPRs.length === 1) {
                        if (sameRepoRelatedPRs[0].branchName === null) {
                            console.warn(`Skipping issue ${issue.url}: related open PR has unavailable head branch.`);
                            continue;
                        }
                        branchName = sameRepoRelatedPRs[0].branchName;
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
                const revertToAwaitingWorkspace = async (reason) => {
                    console.error(`Reverting ${issue.url} to ${WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME} because no worker was spawned: ${reason}`);
                    if (!awaitingWorkspaceStatusOption) {
                        console.error(`Awaiting Workspace status option '${WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME}' not found in project. ${issue.url} stays in ${WorkflowStatus_1.PREPARATION_STATUS_NAME} without a worker.`);
                        return;
                    }
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                };
                let spawnEnv;
                let routedModelName = null;
                let selectedTokenName = null;
                if (rotationTokens !== null && proxyBaseUrl !== null) {
                    const tokenWithSoonestResetAmongAvailableOf = () => selectedTokensWithLimits
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
                            return (a.secondsUntilSevenDayReset - b.secondsUntilSevenDayReset);
                        }
                        return b.remaining - a.remaining;
                    })[0];
                    let tokenWithSoonestResetAmongAvailable = tokenWithSoonestResetAmongAvailableOf();
                    if (tokenWithSoonestResetAmongAvailable === undefined &&
                        !tokenInFlightCountsRefreshed) {
                        tokenInFlightCountsRefreshed = true;
                        tokenInFlightCounts =
                            await this.claudeTokenUsageRepository.getTokenInFlightCounts();
                        tokenWithSoonestResetAmongAvailable =
                            tokenWithSoonestResetAmongAvailableOf();
                    }
                    if (tokenWithSoonestResetAmongAvailable === undefined) {
                        await revertToAwaitingWorkspace('every Claude OAuth token reached its concurrent worker limit');
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
                const model = labelModelName || routedModelName || params.defaultLlmModelName;
                if (!model) {
                    console.error(`No LLM model configured for issue ${issue.url}. Provide --defaultLlmModelName or add an llm-model: label.`);
                    await revertToAwaitingWorkspace('no LLM model is configured');
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
                const spawnResult = await this.localCommandRunner.runCommand('aw', awArgs, spawnEnv ? { env: spawnEnv } : undefined);
                if (spawnResult.exitCode !== 0) {
                    await revertToAwaitingWorkspace(`aw exited with ${spawnResult.exitCode}. stdout: ${spawnResult.stdout} stderr: ${spawnResult.stderr}`);
                    continue;
                }
                if (selectedTokenName !== null) {
                    spawnedInThisRunByToken[selectedTokenName] =
                        (spawnedInThisRunByToken[selectedTokenName] ?? 0) + 1;
                }
                startedInThisRunCount++;
                updatedCurrentPreparationIssueCount++;
            }
            console.log(`Spawn candidate exclusion summary for ${params.projectUrl}: dependedIssueUrls=${exclusionCounts.dependedIssueUrls}, futureNextActionDate=${exclusionCounts.futureNextActionDate}, nextActionHourNotReached=${exclusionCounts.nextActionHourNotReached}, authorNotAllowed=${exclusionCounts.authorNotAllowed}, notAssignedToManager=${exclusionCounts.notAssignedToManager}`);
            return { rotationOrder };
        };
    }
}
exports.StartPreparationUseCase = StartPreparationUseCase;
//# sourceMappingURL=StartPreparationUseCase.js.map