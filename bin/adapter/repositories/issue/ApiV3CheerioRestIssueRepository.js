"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiV3CheerioRestIssueRepository = exports.graphqlMergeableFromRestMergeable = exports.REQUIRED_CHECKS_CACHE_TTL_MS = exports.INCREMENTAL_FETCH_SKEW_BUFFER_MS = exports.FULL_ISSUE_FETCH_INTERVAL_MS = void 0;
const gitHubRawUrl_1 = require("./gitHubRawUrl");
const ProjectIssuesCacheRepository_1 = require("../ProjectIssuesCacheRepository");
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
const githubGraphqlClient_1 = require("../githubGraphqlClient");
const utils_1 = require("../utils");
const githubRateLimitRetry_1 = require("./githubRateLimitRetry");
exports.FULL_ISSUE_FETCH_INTERVAL_MS = 60 * 60 * 1000;
exports.INCREMENTAL_FETCH_SKEW_BUFFER_MS = 5 * 60 * 1000;
exports.REQUIRED_CHECKS_CACHE_TTL_MS = 10 * 60 * 1000;
const SELF_AUTHORED_REVIEW_REFUSAL = 'Can not request changes on your own pull request';
// One GraphQL query carrying this many aliased pull requests costs the same
// single rate-limit point as a query carrying one, measured against the live
// API by reading the rateLimit cost field it returns.
const SLIM_PULL_REQUEST_BATCH_SIZE = 100;
const SLIM_PULL_REQUEST_REVIEW_THREADS_PAGE_SIZE = 100;
function isIssueTimelineResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isSlimPullRequestResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isSlimPullRequestBatchResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isBranchRulesResponse(value) {
    return Array.isArray(value);
}
function isBranchDetailResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isCheckRunsResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return 'check_runs' in value && Array.isArray(value.check_runs);
}
function isCheckSuitesResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return 'check_suites' in value && Array.isArray(value.check_suites);
}
function isCombinedStatusResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return 'statuses' in value && Array.isArray(value.statuses);
}
function isAuthenticatedUserResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    if (!('login' in value))
        return false;
    return typeof value.login === 'string';
}
function isPullRequestMergeabilityResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isPullRequestFilesResponse(value) {
    if (!Array.isArray(value))
        return false;
    return value.every((item) => typeof item === 'object' && item !== null && 'filename' in item);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function isRestPullRequestCiStatusResponse(value) {
    if (!isRecord(value))
        return false;
    const head = value.head;
    const base = value.base;
    return (typeof value.html_url === 'string' &&
        typeof value.state === 'string' &&
        typeof value.draft === 'boolean' &&
        (value.mergeable === null || typeof value.mergeable === 'boolean') &&
        isRecord(head) &&
        typeof head.ref === 'string' &&
        typeof head.sha === 'string' &&
        isRecord(base) &&
        typeof base.ref === 'string');
}
const graphqlMergeableFromRestMergeable = (mergeable) => {
    if (mergeable === true) {
        return 'MERGEABLE';
    }
    if (mergeable === false) {
        return 'CONFLICTING';
    }
    return 'UNKNOWN';
};
exports.graphqlMergeableFromRestMergeable = graphqlMergeableFromRestMergeable;
function isNullableString(value) {
    return value === null || typeof value === 'string';
}
function isLoginContainer(value) {
    return isRecord(value) && typeof value.login === 'string';
}
function isRefContainer(value) {
    return isRecord(value) && typeof value.ref === 'string';
}
function isRepoMergeSettings(value) {
    return isRecord(value);
}
function isIssueOrPullRequestBodyResponse(value) {
    return isRecord(value) && isNullableString(value.body);
}
function isIssueOrPullRequestStateResponse(value) {
    return (isRecord(value) &&
        typeof value.state === 'string' &&
        typeof value.title === 'string');
}
function isIssueCommentsResponseItem(value) {
    if (!isRecord(value))
        return false;
    const userValid = value.user === null || isLoginContainer(value.user);
    return (userValid &&
        isNullableString(value.body) &&
        typeof value.created_at === 'string');
}
function isIssueCommentsResponse(value) {
    return Array.isArray(value) && value.every(isIssueCommentsResponseItem);
}
function isIssueCommentIdResponseItem(value) {
    return isRecord(value) && typeof value.id === 'number';
}
function isIssueCommentIdResponse(value) {
    return Array.isArray(value) && value.every(isIssueCommentIdResponseItem);
}
function isPullRequestDetailResponse(value) {
    if (!isRecord(value))
        return false;
    const userValid = value.user === null || isLoginContainer(value.user);
    return (typeof value.title === 'string' &&
        typeof value.state === 'string' &&
        typeof value.merged === 'boolean' &&
        typeof value.draft === 'boolean' &&
        typeof value.additions === 'number' &&
        typeof value.deletions === 'number' &&
        typeof value.changed_files === 'number' &&
        isRefContainer(value.head) &&
        isRefContainer(value.base) &&
        userValid &&
        isNullableString(value.body));
}
function isPullRequestDetailFilesResponseItem(value) {
    if (!isRecord(value))
        return false;
    return (typeof value.filename === 'string' &&
        typeof value.status === 'string' &&
        typeof value.additions === 'number' &&
        typeof value.deletions === 'number' &&
        (value.patch === undefined || typeof value.patch === 'string') &&
        (value.raw_url === undefined || typeof value.raw_url === 'string'));
}
function isPullRequestDetailFilesResponse(value) {
    return (Array.isArray(value) && value.every(isPullRequestDetailFilesResponseItem));
}
function isCommitAuthor(value) {
    return (isRecord(value) &&
        typeof value.name === 'string' &&
        typeof value.date === 'string');
}
function isPullRequestCommitsResponseItem(value) {
    if (!isRecord(value))
        return false;
    if (typeof value.sha !== 'string')
        return false;
    if (!isRecord(value.commit))
        return false;
    if (typeof value.commit.message !== 'string')
        return false;
    return value.commit.author === null || isCommitAuthor(value.commit.author);
}
function isPullRequestCommitsResponse(value) {
    return Array.isArray(value) && value.every(isPullRequestCommitsResponseItem);
}
class ApiV3CheerioRestIssueRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, dateRepository, localStorageRepository, ghToken = process.env.GH_TOKEN || 'dummy', sleep = githubRateLimitRetry_1.realSleep) {
        super(localStorageRepository, ghToken);
        this.apiV3IssueRepository = apiV3IssueRepository;
        this.restIssueRepository = restIssueRepository;
        this.graphqlProjectItemRepository = graphqlProjectItemRepository;
        this.localStorageCacheRepository = localStorageCacheRepository;
        this.projectRepository = projectRepository;
        this.dateRepository = dateRepository;
        this.localStorageRepository = localStorageRepository;
        this.ghToken = ghToken;
        this.sleep = sleep;
        this.getAllIssuesRefreshMemo = new Map();
        this.lastIssuesFetchedAtByProjectId = new Map();
        this.getLastIssuesFetchedAt = (projectId) => this.lastIssuesFetchedAtByProjectId.get(projectId) ?? null;
        this.fetchWithRateLimitRetry = (request) => (0, githubRateLimitRetry_1.fetchWithGitHubRateLimitRetry)(request, this.sleep);
        this.throwGitHubError = async (prefix, response) => {
            const bodyText = await response.clone().text();
            const isRateLimit = (0, githubRateLimitRetry_1.hasRateLimitSignals)(response.status, response.headers, bodyText);
            const formatted = await this.formatGitHubErrorWithStatus(response);
            const message = `${prefix}: ${formatted}`;
            if (isRateLimit) {
                throw new githubRateLimitRetry_1.GitHubRateLimitError(message);
            }
            throw new Error(message);
        };
        this.updateStatus = async (project, issue, statusId) => {
            await this.graphqlProjectItemRepository.updateProjectField(project.id, project.status.fieldId, issue.itemId, { singleSelectOptionId: statusId });
        };
        this.convertProjectItemToIssue = (item) => {
            const nextActionDate = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'nextactiondate')?.value;
            const nextActionHour = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'nextactionhour')?.value;
            const estimationMinutes = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'estimationminutes')?.value;
            const dependedIssueUrls = item.customFields
                .find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith('dependedissueurls'))
                ?.value?.split(',')
                .map((url) => url.trim())
                .filter((url) => url.length > 0) || [];
            const completionDate50PercentConfidence = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith('completiondate50'))?.value;
            const story = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'story')?.value;
            const status = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'status')?.value;
            const agent = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'agent')?.value ?? null;
            const { owner, repo } = this.extractIssueFromUrl(item.url);
            return {
                nameWithOwner: item.nameWithOwner,
                url: item.url,
                title: item.title,
                number: item.number,
                state: item.state,
                labels: item.labels,
                assignees: item.assignees,
                nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
                nextActionHour: nextActionHour ? parseInt(nextActionHour) : null,
                estimationMinutes: estimationMinutes ? parseInt(estimationMinutes) : null,
                dependedIssueUrls: dependedIssueUrls,
                completionDate50PercentConfidence: completionDate50PercentConfidence
                    ? new Date(completionDate50PercentConfidence)
                    : null,
                status: status || null,
                story: story || null,
                org: owner,
                repo: repo,
                body: item.body ?? '',
                itemId: item.id,
                isPr: item.url.includes('/pull/'),
                isInProgress: (0, utils_1.normalizeFieldName)(status || '').includes('progress'),
                isClosed: item.state !== 'OPEN',
                createdAt: new Date(item.createdAt || '2000-01-01'),
                author: item.author,
                closingIssueReferenceUrls: item.closingIssueReferenceUrls,
                agent,
                isRepoArchived: item.isRepoArchived,
                stateReason: item.stateReason,
            };
        };
        this.restoreIssuesFromCache = (rawIssues) => {
            if (!Array.isArray(rawIssues)) {
                return null;
            }
            const issues = rawIssues
                .filter((issue) => typeof issue === 'object' && issue !== null)
                .map((issue) => {
                const nextActionDate = !('nextActionDate' in issue) ||
                    typeof issue.nextActionDate !== 'string' ||
                    issue.nextActionDate === null
                    ? null
                    : new Date(issue.nextActionDate);
                const completionDate50PercentConfidence = !('completionDate50PercentConfidence' in issue) ||
                    typeof issue.completionDate50PercentConfidence !== 'string'
                    ? null
                    : new Date(issue.completionDate50PercentConfidence);
                const createdAt = !('createdAt' in issue) || typeof issue.createdAt !== 'string'
                    ? new Date()
                    : new Date(issue.createdAt);
                const closingIssueReferenceUrls = 'closingIssueReferenceUrls' in issue &&
                    Array.isArray(issue.closingIssueReferenceUrls) &&
                    issue.closingIssueReferenceUrls.every((url) => typeof url === 'string')
                    ? issue.closingIssueReferenceUrls
                    : [];
                const stateReason = 'stateReason' in issue &&
                    (issue.stateReason === 'COMPLETED' ||
                        issue.stateReason === 'NOT_PLANNED' ||
                        issue.stateReason === 'REOPENED')
                    ? issue.stateReason
                    : null;
                return {
                    ...issue,
                    nextActionDate: nextActionDate,
                    completionDate50PercentConfidence: completionDate50PercentConfidence,
                    createdAt: createdAt,
                    closingIssueReferenceUrls: closingIssueReferenceUrls,
                    stateReason: stateReason,
                };
            });
            if ((0, ProjectIssuesCacheRepository_1.isIssueArray)(issues)) {
                return issues;
            }
            return null;
        };
        this.readCachedProjectIssues = async (projectId) => {
            const raw = await this.projectIssuesCacheRepository.readRaw(projectId);
            if (typeof raw !== 'object' || raw === null) {
                return null;
            }
            if (!('lastFetchedAt' in raw) ||
                typeof raw.lastFetchedAt !== 'string' ||
                !('lastFullFetchAt' in raw) ||
                typeof raw.lastFullFetchAt !== 'string' ||
                !('project' in raw) ||
                !('issues' in raw)) {
                return null;
            }
            if (!(0, ProjectIssuesCacheRepository_1.isProject)(raw.project)) {
                return null;
            }
            const issues = this.restoreIssuesFromCache(raw.issues);
            if (!issues) {
                return null;
            }
            return {
                lastFetchedAt: raw.lastFetchedAt,
                lastFullFetchAt: raw.lastFullFetchAt,
                project: raw.project,
                issues,
            };
        };
        // Reads the Project (status/story option ids and field ids) that the TDPM
        // daemon persisted into the `allIssues-${projectId}` cache, without any
        // GraphQL call. Returns null on cache miss so callers can fall back to a
        // GraphQL project load only when the daemon has not populated the cache yet.
        this.getCachedProject = async (projectId) => this.projectIssuesCacheRepository.readProject(projectId);
        this.toDateString = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        this.getAllIssues = async (projectId) => {
            const memoized = this.getAllIssuesRefreshMemo.get(projectId);
            if (memoized) {
                return memoized;
            }
            const result = await this.refreshAllIssues(projectId);
            this.getAllIssuesRefreshMemo.set(projectId, result);
            return result;
        };
        this.refreshAllIssues = async (projectId) => {
            const now = await this.dateRepository.now();
            const cache = await this.readCachedProjectIssues(projectId);
            const isFullFetch = cache === null ||
                now.getTime() - new Date(cache.lastFullFetchAt).getTime() >=
                    exports.FULL_ISSUE_FETCH_INTERVAL_MS;
            let project;
            try {
                const freshProject = await this.projectRepository.getProject(projectId);
                if (!freshProject) {
                    throw new Error(`Project not found. projectId: ${projectId}`);
                }
                project = freshProject;
            }
            catch (error) {
                if (!isFullFetch && cache !== null) {
                    console.warn(`Failed to refresh project metadata, using cached. projectId: ${projectId}, error: ${String(error)}`);
                    project = cache.project;
                }
                else {
                    throw error;
                }
            }
            const cacheStoriesByOptionId = new Map(cache?.project.story?.stories.map((s) => [s.id, s.name]) ?? []);
            const freshStoryOptionIds = new Set(project.story?.stories.map((s) => s.id) ?? []);
            const storyOptionsChanged = cache !== null &&
                ([...cacheStoriesByOptionId.entries()].some(([id, name]) => !freshStoryOptionIds.has(id) ||
                    project.story?.stories.find((s) => s.id === id)?.name !== name) ??
                    false);
            const effectiveIsFullFetch = isFullFetch || storyOptionsChanged;
            if (effectiveIsFullFetch) {
                const items = await this.graphqlProjectItemRepository.fetchProjectItems(projectId);
                const issues = items.map((item) => this.convertProjectItemToIssue(item));
                const nowIso = now.toISOString();
                await this.projectIssuesCacheRepository.write(projectId, {
                    lastFetchedAt: nowIso,
                    lastFullFetchAt: nowIso,
                    project,
                    issues,
                });
                this.lastIssuesFetchedAtByProjectId.set(projectId, nowIso);
                return { issues, project, cacheUsed: false };
            }
            const lastFetchedAt = new Date(cache.lastFetchedAt);
            const cutoff = new Date(lastFetchedAt.getTime() - exports.INCREMENTAL_FETCH_SKEW_BUFFER_MS);
            const lightItems = await this.graphqlProjectItemRepository.fetchProjectItemsLight(projectId, `updated:>=${this.toDateString(cutoff)}`);
            const changedItemIds = lightItems
                .filter((item) => new Date(item.updatedAt).getTime() >= cutoff.getTime())
                .map((item) => item.id);
            const issuesByUrl = new Map(cache.issues.map((issue) => [issue.url, issue]));
            if (changedItemIds.length > 0) {
                const changedItems = await this.graphqlProjectItemRepository.fetchProjectItemsByIds(changedItemIds);
                for (const item of changedItems) {
                    const issue = this.convertProjectItemToIssue(item);
                    issuesByUrl.set(issue.url, issue);
                }
            }
            const issues = Array.from(issuesByUrl.values());
            const nowIso = now.toISOString();
            await this.projectIssuesCacheRepository.write(projectId, {
                lastFetchedAt: nowIso,
                lastFullFetchAt: cache.lastFullFetchAt,
                project,
                issues,
            });
            this.lastIssuesFetchedAtByProjectId.set(projectId, nowIso);
            return { issues, project, cacheUsed: true };
        };
        this.createNewIssue = async (org, repo, title, body, assignees, labels) => {
            return await this.restIssueRepository.createNewIssue(org, repo, title, body, assignees, labels);
        };
        this.searchIssue = async (query) => {
            return await this.apiV3IssueRepository.searchIssue(query);
        };
        this.updateIssue = async (issue) => {
            await this.restIssueRepository.updateIssue(issue);
        };
        this.updateIssueBody = async (issue, body) => {
            await this.restIssueRepository.updateIssueBody(issue, body);
        };
        this.getIssueByUrl = async (url) => {
            const projectItem = await this.graphqlProjectItemRepository.fetchProjectItemByUrl(url);
            if (!projectItem) {
                return null;
            }
            return this.convertProjectItemToIssue(projectItem);
        };
        this.addIssueToProject = async (project, issueUrl) => {
            await this.graphqlProjectItemRepository.addIssueToProject(project.id, issueUrl);
        };
        this.setDependedIssueUrl = async (prUrl, project, issueUrl) => {
            const dependedIssueUrlField = project.dependedIssueUrlSeparatedByComma;
            if (!dependedIssueUrlField) {
                return;
            }
            const existingProjectItem = await this.graphqlProjectItemRepository.fetchProjectItemByUrl(prUrl, project.id);
            const existingValue = existingProjectItem?.customFields.find((field) => field.name === dependedIssueUrlField.name)?.value;
            if (existingValue) {
                return;
            }
            const projectItemId = existingProjectItem?.id ??
                (await this.graphqlProjectItemRepository.addIssueToProject(project.id, prUrl));
            await this.graphqlProjectItemRepository.updateProjectTextField(project.id, dependedIssueUrlField.fieldId, projectItemId, issueUrl);
        };
        this.setIssueAgentField = async (issueUrl, project, agentOptionId) => {
            if (!project.agent) {
                return;
            }
            const existingProjectItem = await this.graphqlProjectItemRepository.fetchProjectItemByUrl(issueUrl, project.id);
            const projectItemId = existingProjectItem?.id ??
                (await this.graphqlProjectItemRepository.addIssueToProject(project.id, issueUrl));
            await this.graphqlProjectItemRepository.updateProjectField(project.id, project.agent.fieldId, projectItemId, { singleSelectOptionId: agentOptionId });
        };
        this.updateNextActionDate = async (issueUrl, project, date, projectItemId) => {
            if (!project.nextActionDate) {
                return;
            }
            // When the caller already knows the project item id (e.g. the console,
            // which receives it in the request body), use it directly and skip the
            // GraphQL fetchProjectItemByUrl lookup. Fall back to the lookup only when
            // no id was supplied, preserving the original behavior for other callers.
            const itemId = projectItemId ??
                (await this.graphqlProjectItemRepository.fetchProjectItemByUrl(issueUrl, project.id))?.id;
            if (!itemId) {
                return;
            }
            return this.graphqlProjectItemRepository.updateProjectField(project.id, project.nextActionDate.fieldId, itemId, { date: date.toISOString().split('T')[0] });
        };
        this.updateNextActionHour = async (project, issue, hour) => {
            const option = project.nextActionHour.options.find((o) => o.name === String(hour));
            const value = option
                ? { singleSelectOptionId: option.id }
                : { number: hour };
            return this.graphqlProjectItemRepository.updateProjectField(project.id, project.nextActionHour.fieldId, issue.itemId, value);
        };
        this.updateStory = async (project, issue, storyOptionId) => {
            await this.graphqlProjectItemRepository.updateProjectField(project.id, project.story.fieldId, issue.itemId, { singleSelectOptionId: storyOptionId });
        };
        this.updateStoryOptionColor = async (project, storyOptionId, newColor) => {
            const mutation = `mutation UpdateStoryOptionColor($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
  updateProjectV2Field(input: {
    fieldId: $fieldId
    singleSelectOptions: $options
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        options { id name color description }
      }
    }
  }
}`;
            const options = project.story.stories.map((opt) => ({
                id: opt.id,
                name: opt.name,
                color: opt.id === storyOptionId ? newColor : opt.color,
                description: opt.description,
            }));
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: mutation,
                variables: { fieldId: project.story.fieldId, options },
            });
            if (response.errors && response.errors.length > 0) {
                throw new Error(response.errors.map((e) => e.message).join('; '));
            }
        };
        this.clearProjectField = async (project, fieldId, issue) => {
            await this.graphqlProjectItemRepository.clearProjectField(project.id, fieldId, issue.itemId);
            return;
        };
        this.createComment = async (issue, comment) => {
            await this.restIssueRepository.createComment(issue.url, comment);
        };
        this.updateProjectTextField = async (project, fieldId, issue, text) => {
            await this.graphqlProjectItemRepository.updateProjectTextField(project.id, fieldId, issue.itemId, text);
        };
        this.updateLabels = (issue, labels) => {
            return this.restIssueRepository.updateLabels(issue, labels);
        };
        this.removeLabel = (issue, label) => {
            return this.restIssueRepository.removeLabel(issue, label);
        };
        this.getOrCreateLabel = (org, repo, labelName) => {
            return this.restIssueRepository.getOrCreateLabel(org, repo, labelName);
        };
        this.updateAssigneeList = (issue, assigneeList) => {
            return this.restIssueRepository.updateAssigneeList(issue, assigneeList);
        };
        this.searchIssues = (query) => {
            return this.restIssueRepository.searchIssues(query);
        };
        this.get = async (issueUrl, project) => {
            const projectItem = await this.graphqlProjectItemRepository.fetchProjectItemByUrl(issueUrl, project.id);
            if (!projectItem) {
                return null;
            }
            return this.convertProjectItemToIssue(projectItem);
        };
        this.update = async (issue, _project) => {
            await this.updateIssue(issue);
        };
        this.parseIssueUrl = (issueUrl) => {
            const urlMatch = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
            if (!urlMatch) {
                throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
            }
            return {
                owner: urlMatch[1],
                repo: urlMatch[2],
                issueNumber: parseInt(urlMatch[4], 10),
                isPr: urlMatch[3] === 'pull',
            };
        };
        this.computePrStatus = (prUrl, headRefName, data) => {
            const isConflicted = data.mergeable === 'CONFLICTING';
            const hasStatusCheckRollup = data.ciContexts.length > 0;
            const contexts = data.ciContexts;
            const requiredCheckNames = data.requiredCheckNames;
            const seenContextNames = new Set();
            for (const ctx of contexts) {
                if ('name' in ctx) {
                    seenContextNames.add(ctx.name);
                }
                if ('context' in ctx) {
                    seenContextNames.add(ctx.context);
                }
            }
            const missingRequiredCheckNames = requiredCheckNames.filter((name) => !seenContextNames.has(name));
            const allRequiredChecksPassed = missingRequiredCheckNames.length === 0;
            const latestCheckRunByName = new Map();
            for (const ctx of contexts) {
                if (ctx.__typename === 'CheckRun') {
                    const existing = latestCheckRunByName.get(ctx.name);
                    if (!existing || ctx.databaseId > existing.databaseId) {
                        latestCheckRunByName.set(ctx.name, {
                            conclusion: ctx.conclusion,
                            databaseId: ctx.databaseId,
                        });
                    }
                }
            }
            const failureConclusions = new Set([
                'FAILURE',
                'CANCELLED',
                'TIMED_OUT',
                'ACTION_REQUIRED',
                'STARTUP_FAILURE',
                'STALE',
            ]);
            const isCiStateSuccess = (() => {
                if (!hasStatusCheckRollup)
                    return false;
                const latestRuns = [...latestCheckRunByName.values()];
                const statusContexts = contexts.filter((ctx) => ctx.__typename === 'StatusContext');
                const hasFailure = latestRuns.some((r) => r.conclusion !== null && failureConclusions.has(r.conclusion)) ||
                    statusContexts.some((ctx) => ctx.state === 'FAILURE' || ctx.state === 'ERROR');
                if (hasFailure)
                    return false;
                const hasPending = latestRuns.some((r) => r.conclusion === null) ||
                    statusContexts.some((ctx) => ctx.state === 'PENDING');
                return !hasPending;
            })();
            const isPassedAllCiJob = isCiStateSuccess && allRequiredChecksPassed;
            const reviewThreads = data.reviewThreads;
            const isResolvedAllReviewComments = reviewThreads.length === 0 ||
                reviewThreads.every((thread) => thread.isResolved);
            return {
                url: prUrl,
                branchName: headRefName ?? null,
                createdAt: new Date(0),
                isDraft: data.isDraft === true,
                isConflicted,
                mergeable: data.mergeable ?? null,
                isPassedAllCiJob,
                isCiStateSuccess,
                isResolvedAllReviewComments,
                isBranchOutOfDate: false,
                missingRequiredCheckNames,
            };
        };
        this.prBodyContainsCrossRepoClosingKeyword = (prBody, issueUrl) => {
            if (!prBody)
                return false;
            const closingKeywords = /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+/gi;
            const normalizedIssueUrl = issueUrl.replace(/\/+$/, '');
            let match;
            while ((match = closingKeywords.exec(prBody)) !== null) {
                const afterKeyword = prBody.slice(match.index + match[0].length);
                const urlMatch = afterKeyword.match(/^https?:\/\/[^\s]+/);
                if (!urlMatch)
                    continue;
                const candidateUrl = urlMatch[0].replace(/\/+$/, '');
                if (candidateUrl.toLowerCase() === normalizedIssueUrl.toLowerCase())
                    return true;
            }
            return false;
        };
        this.requiredCheckNamesCache = new Map();
        this.getRequiredCheckNames = async (owner, repo, branch) => {
            const cacheKey = `${owner}/${repo}/${branch}`;
            const nowMs = (await this.dateRepository.now()).getTime();
            const cached = this.requiredCheckNamesCache.get(cacheKey);
            if (cached && nowMs - cached.fetchedAtMs < exports.REQUIRED_CHECKS_CACHE_TTL_MS) {
                return cached.names;
            }
            const ownerSegment = encodeURIComponent(owner);
            const repoSegment = encodeURIComponent(repo);
            const branchSegment = encodeURIComponent(branch);
            const requiredCheckNamesSet = new Set();
            const rulesResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/rules/branches/${branchSegment}?per_page=100`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (rulesResponse.ok) {
                const rulesBody = await rulesResponse.json();
                if (!isBranchRulesResponse(rulesBody)) {
                    throw new Error(`Unexpected response shape when fetching branch rules: ${owner}/${repo}/${branch}`);
                }
                for (const rule of rulesBody) {
                    if (rule.type !== 'required_status_checks')
                        continue;
                    for (const check of rule.parameters?.required_status_checks || []) {
                        requiredCheckNamesSet.add(check.context);
                    }
                }
            }
            else if (rulesResponse.status === 403) {
                const reason = await this.formatGitHubErrorWithStatus(rulesResponse);
                console.warn(`ApiV3CheerioRestIssueRepository: branch rules are not accessible for ${owner}/${repo}/${branch}, treating as no required checks. reason: ${reason}`);
            }
            else if (rulesResponse.status !== 404) {
                const reason = await this.formatGitHubErrorWithStatus(rulesResponse);
                throw new Error(`Failed to fetch branch rules for ${owner}/${repo}/${branch}: ${reason}`);
            }
            const branchResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/branches/${branchSegment}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (branchResponse.ok) {
                const branchBody = await branchResponse.json();
                if (!isBranchDetailResponse(branchBody)) {
                    throw new Error(`Unexpected response shape when fetching branch detail: ${owner}/${repo}/${branch}`);
                }
                for (const context of branchBody.protection?.required_status_checks
                    ?.contexts || []) {
                    requiredCheckNamesSet.add(context);
                }
            }
            else if (branchResponse.status === 403) {
                const reason = await this.formatGitHubErrorWithStatus(branchResponse);
                console.warn(`ApiV3CheerioRestIssueRepository: branch detail (classic protection) is not accessible for ${owner}/${repo}/${branch}, treating as no required checks. reason: ${reason}`);
            }
            else if (branchResponse.status !== 404) {
                const reason = await this.formatGitHubErrorWithStatus(branchResponse);
                throw new Error(`Failed to fetch branch detail for ${owner}/${repo}/${branch}: ${reason}`);
            }
            const names = Array.from(requiredCheckNamesSet);
            this.requiredCheckNamesCache.set(cacheKey, {
                fetchedAtMs: nowMs,
                names,
            });
            return names;
        };
        this.getCheckRunsViaCheckSuitesFallback = async (owner, repo, commitSha) => {
            const ownerSegment = encodeURIComponent(owner);
            const repoSegment = encodeURIComponent(repo);
            const shaSegment = encodeURIComponent(commitSha);
            const checkSuitesResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/commits/${shaSegment}/check-suites`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (!checkSuitesResponse.ok) {
                if (checkSuitesResponse.status === 404) {
                    console.warn(`ApiV3CheerioRestIssueRepository: commits/${commitSha}/check-suites returned 404 for ${owner}/${repo}, treating as no check runs.`);
                    return [];
                }
                const reason = await this.formatGitHubErrorWithStatus(checkSuitesResponse);
                throw new Error(`Failed to fetch check suites for ${owner}/${repo}@${commitSha}: ${reason}`);
            }
            const checkSuitesBody = await checkSuitesResponse.json();
            if (!isCheckSuitesResponse(checkSuitesBody)) {
                throw new Error(`Unexpected response shape when fetching check suites: ${owner}/${repo}@${commitSha}`);
            }
            const contexts = [];
            const perPage = 100;
            for (const suite of checkSuitesBody.check_suites) {
                let page = 1;
                let hasMore = true;
                while (hasMore) {
                    const runsResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/check-suites/${suite.id}/check-runs?per_page=${perPage}&page=${page}`, {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${this.ghToken}`,
                            Accept: 'application/vnd.github+json',
                        },
                    }));
                    if (!runsResponse.ok) {
                        const reason = await this.formatGitHubErrorWithStatus(runsResponse);
                        throw new Error(`Failed to fetch check runs for suite ${suite.id} in ${owner}/${repo}: ${reason}`);
                    }
                    const runsBody = await runsResponse.json();
                    if (!isCheckRunsResponse(runsBody)) {
                        throw new Error(`Unexpected response shape when fetching check runs for suite ${suite.id}: ${owner}/${repo}@${commitSha}`);
                    }
                    for (const checkRun of runsBody.check_runs) {
                        contexts.push({
                            __typename: 'CheckRun',
                            name: checkRun.name,
                            conclusion: checkRun.conclusion
                                ? checkRun.conclusion.toUpperCase()
                                : null,
                            databaseId: checkRun.id,
                        });
                    }
                    if (runsBody.check_runs.length < perPage ||
                        page * perPage >= runsBody.total_count) {
                        hasMore = false;
                    }
                    else {
                        page += 1;
                    }
                }
            }
            return contexts;
        };
        this.getCommitCiContexts = async (owner, repo, commitSha) => {
            const ownerSegment = encodeURIComponent(owner);
            const repoSegment = encodeURIComponent(repo);
            const shaSegment = encodeURIComponent(commitSha);
            const contexts = [];
            const perPage = 100;
            let page = 1;
            let hasMore = true;
            let usedCheckSuitesFallback = false;
            while (hasMore) {
                const checkRunsResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/commits/${shaSegment}/check-runs?per_page=${perPage}&page=${page}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!checkRunsResponse.ok) {
                    if (checkRunsResponse.status === 404 && page === 1) {
                        const fallbackContexts = await this.getCheckRunsViaCheckSuitesFallback(owner, repo, commitSha);
                        contexts.push(...fallbackContexts);
                        usedCheckSuitesFallback = true;
                        break;
                    }
                    const reason = await this.formatGitHubErrorWithStatus(checkRunsResponse);
                    throw new Error(`Failed to fetch check runs for ${owner}/${repo}@${commitSha}: ${reason}`);
                }
                const checkRunsBody = await checkRunsResponse.json();
                if (!isCheckRunsResponse(checkRunsBody)) {
                    throw new Error(`Unexpected response shape when fetching check runs: ${owner}/${repo}@${commitSha}`);
                }
                for (const checkRun of checkRunsBody.check_runs) {
                    contexts.push({
                        __typename: 'CheckRun',
                        name: checkRun.name,
                        conclusion: checkRun.conclusion
                            ? checkRun.conclusion.toUpperCase()
                            : null,
                        databaseId: checkRun.id,
                    });
                }
                if (checkRunsBody.check_runs.length < perPage ||
                    page * perPage >= checkRunsBody.total_count) {
                    hasMore = false;
                }
                else {
                    page += 1;
                }
            }
            if (!usedCheckSuitesFallback) {
                const combinedStatusResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/commits/${shaSegment}/status?per_page=100`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!combinedStatusResponse.ok) {
                    const reason = await this.formatGitHubErrorWithStatus(combinedStatusResponse);
                    throw new Error(`Failed to fetch combined status for ${owner}/${repo}@${commitSha}: ${reason}`);
                }
                const combinedStatusBody = await combinedStatusResponse.json();
                if (!isCombinedStatusResponse(combinedStatusBody)) {
                    throw new Error(`Unexpected response shape when fetching combined status: ${owner}/${repo}@${commitSha}`);
                }
                for (const status of combinedStatusBody.statuses) {
                    contexts.push({
                        __typename: 'StatusContext',
                        context: status.context,
                        state: status.state.toUpperCase(),
                    });
                }
            }
            return contexts;
        };
        this.fetchSlimPullRequest = async (owner, repo, prNumber) => {
            const query = `
      query PullRequestSlimStatus($owner: String!, $repo: String!, $prNumber: Int!, $reviewThreadsAfter: String) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            url
            state
            isDraft
            headRefName
            baseRefName
            mergeable
            headRefOid
            reviewThreads(first: 100, after: $reviewThreadsAfter) {
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                isResolved
              }
            }
          }
        }
      }
    `;
            let slimPullRequest = null;
            let reviewThreadsAfter = null;
            let hasNextPage = true;
            while (hasNextPage) {
                const response = await this.fetchWithRateLimitRetry(() => (0, githubGraphqlClient_1.fetchGithubGraphql)({
                    ghToken: this.ghToken,
                    query,
                    variables: { owner, repo, prNumber, reviewThreadsAfter },
                }));
                if (!response.ok) {
                    throw new Error(`Failed to fetch pull request from GitHub GraphQL API: HTTP ${response.status}`);
                }
                const responseData = await response.json();
                if (!isSlimPullRequestResponse(responseData)) {
                    throw new Error('Unexpected response shape when fetching pull request');
                }
                if (responseData.errors && responseData.errors.length > 0) {
                    throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
                }
                const pr = responseData.data?.repository?.pullRequest;
                if (!pr) {
                    return null;
                }
                if (!slimPullRequest) {
                    slimPullRequest = {
                        url: pr.url,
                        state: pr.state,
                        isDraft: pr.isDraft,
                        headRefName: pr.headRefName,
                        baseRefName: pr.baseRefName,
                        mergeable: pr.mergeable,
                        headRefOid: pr.headRefOid,
                        reviewThreads: [],
                    };
                }
                for (const thread of pr.reviewThreads?.nodes || []) {
                    slimPullRequest.reviewThreads.push({ isResolved: thread.isResolved });
                }
                hasNextPage = pr.reviewThreads?.pageInfo.hasNextPage === true;
                reviewThreadsAfter = pr.reviewThreads?.pageInfo.endCursor ?? null;
            }
            return slimPullRequest;
        };
        this.buildRelatedPullRequestFromSlim = async (owner, repo, slimPullRequest) => {
            const requiredCheckNames = slimPullRequest.baseRefName
                ? await this.getRequiredCheckNames(owner, repo, slimPullRequest.baseRefName)
                : [];
            const ciContexts = slimPullRequest.headRefOid
                ? await this.getCommitCiContexts(owner, repo, slimPullRequest.headRefOid)
                : [];
            return this.computePrStatus(slimPullRequest.url, slimPullRequest.headRefName, {
                isDraft: slimPullRequest.isDraft,
                mergeable: slimPullRequest.mergeable,
                requiredCheckNames,
                ciContexts,
                reviewThreads: slimPullRequest.reviewThreads,
            });
        };
        this.resolveMergeabilityWithRetry = async (owner, repo, prNumber) => {
            const query = `
      query PullRequestMergeability($owner: String!, $repo: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            mergeable
            mergeStateStatus
          }
        }
      }
    `;
            const maxAttempts = 3;
            const retryDelayMilliseconds = 1000;
            let lastResult = null;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                if (attempt > 0) {
                    await this.sleep(retryDelayMilliseconds);
                }
                const response = await this.fetchWithRateLimitRetry(() => (0, githubGraphqlClient_1.fetchGithubGraphql)({
                    ghToken: this.ghToken,
                    query,
                    variables: { owner, repo, prNumber },
                }));
                if (!response.ok) {
                    throw new Error(`Failed to fetch pull request mergeability from GitHub GraphQL API: HTTP ${response.status}`);
                }
                const responseData = await response.json();
                if (!isPullRequestMergeabilityResponse(responseData)) {
                    throw new Error(`Unexpected response shape when fetching pull request mergeability: ${owner}/${repo}#${prNumber}`);
                }
                if (responseData.errors && responseData.errors.length > 0) {
                    throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
                }
                const pr = responseData.data?.repository?.pullRequest;
                if (!pr) {
                    return null;
                }
                lastResult = {
                    mergeable: pr.mergeable ?? null,
                    mergeStateStatus: pr.mergeStateStatus ?? null,
                };
                if (lastResult.mergeable !== null && lastResult.mergeable !== 'UNKNOWN') {
                    return lastResult;
                }
            }
            return lastResult;
        };
        this.findRelatedOpenPRs = async (issueUrl) => {
            const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issueUrl);
            if (isPr) {
                throw new Error('findRelatedOpenPRs only supports issue URLs, not pull request URLs');
            }
            const query = `
      query IssueRelatedOpenPullRequests($owner: String!, $repo: String!, $issueNumber: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            timelineItems(first: 100, after: $after, itemTypes: [CROSS_REFERENCED_EVENT]) {
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                __typename
                ... on CrossReferencedEvent {
                  willCloseTarget
                  source {
                    __typename
                    ... on PullRequest {
                      url
                      number
                      body
                      state
                      createdAt
                      isDraft
                      mergeable
                      headRefName
                      baseRefName
                      baseRef {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
            const relatedPRsMap = new Map();
            let after = null;
            let hasNextPage = true;
            while (hasNextPage) {
                const response = await this.fetchWithRateLimitRetry(() => (0, githubGraphqlClient_1.fetchGithubGraphql)({
                    ghToken: this.ghToken,
                    query,
                    variables: { owner, repo, issueNumber, after },
                }));
                if (!response.ok) {
                    await this.throwGitHubError('Failed to fetch issue timeline from GitHub GraphQL API', response);
                }
                const responseData = await response.json();
                if (!isIssueTimelineResponse(responseData)) {
                    throw new Error(`Unexpected response shape when fetching issue timeline: ${issueUrl}`);
                }
                const issueData = responseData.data?.repository?.issue;
                if (!issueData) {
                    console.info(`ApiV3CheerioRestIssueRepository: issue not found when fetching timeline, returning empty related PRs. issueUrl: ${issueUrl}`);
                    return [];
                }
                for (const item of issueData.timelineItems.nodes) {
                    if (item.__typename !== 'CrossReferencedEvent')
                        continue;
                    if (!item.source || item.source.__typename !== 'PullRequest')
                        continue;
                    if (item.source.state !== 'OPEN')
                        continue;
                    if (!item.willCloseTarget &&
                        !this.prBodyContainsCrossRepoClosingKeyword(item.source.body ?? null, issueUrl))
                        continue;
                    const pr = item.source;
                    const prUrl = pr.url || '';
                    if (!prUrl)
                        continue;
                    const { owner: prOwner, repo: prRepo } = this.parseIssueUrl(prUrl);
                    let isConflicted = pr.mergeable === 'CONFLICTING';
                    let mergeable = pr.mergeable ?? null;
                    if (pr.number !== undefined &&
                        (pr.mergeable === undefined ||
                            pr.mergeable === null ||
                            pr.mergeable === 'UNKNOWN')) {
                        let resolved;
                        try {
                            resolved = await this.resolveMergeabilityWithRetry(prOwner, prRepo, pr.number);
                        }
                        catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            if (errorMessage.includes('NOT_FOUND')) {
                                console.info(`ApiV3CheerioRestIssueRepository: pull request no longer exists, excluding it from related open PRs. prUrl: ${prUrl}`);
                            }
                            else {
                                console.warn(`ApiV3CheerioRestIssueRepository: resolveMergeabilityWithRetry failed, skipping PR for this cycle. prUrl: ${prUrl} error: ${errorMessage}`);
                            }
                            continue;
                        }
                        if (resolved !== null) {
                            mergeable = resolved.mergeable;
                            isConflicted =
                                resolved.mergeable === 'CONFLICTING' ||
                                    resolved.mergeStateStatus === 'DIRTY';
                        }
                    }
                    if (pr.number === undefined)
                        continue;
                    let prStatus;
                    try {
                        const slimPullRequest = await this.fetchSlimPullRequest(prOwner, prRepo, pr.number);
                        if (!slimPullRequest || slimPullRequest.state !== 'OPEN') {
                            console.info(`ApiV3CheerioRestIssueRepository: pull request is no longer open, excluding it from related open PRs. prUrl: ${prUrl}`);
                            continue;
                        }
                        const baseRefName = slimPullRequest.baseRefName ?? pr.baseRefName ?? pr.baseRef?.name;
                        prStatus = await this.buildRelatedPullRequestFromSlim(prOwner, prRepo, {
                            ...slimPullRequest,
                            url: slimPullRequest.url || prUrl,
                            headRefName: slimPullRequest.headRefName ?? pr.headRefName,
                            baseRefName,
                        });
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.warn(`ApiV3CheerioRestIssueRepository: fetching pull request status failed, skipping PR for this cycle. prUrl: ${prUrl} error: ${errorMessage}`);
                        continue;
                    }
                    relatedPRsMap.set(prUrl, {
                        ...prStatus,
                        isConflicted,
                        mergeable,
                        createdAt: pr.createdAt ? new Date(pr.createdAt) : new Date(0),
                    });
                }
                hasNextPage = issueData.timelineItems.pageInfo.hasNextPage;
                after = issueData.timelineItems.pageInfo.endCursor;
            }
            return Array.from(relatedPRsMap.values());
        };
        this.getAllOpened = async (project) => {
            const { issues } = await this.getAllIssues(project.id);
            return issues.filter((issue) => !issue.isClosed);
        };
        this.getStoryObjectMap = async (project) => {
            const { issues } = await this.getAllIssues(project.id);
            const storyObjectMap = new Map();
            const targetStories = project.story?.stories || [];
            for (const story of targetStories) {
                const storyIssue = issues.find((issue) => story.name.startsWith(issue.title));
                storyObjectMap.set(story.name, {
                    story,
                    storyIssue: storyIssue || null,
                    issues: [],
                });
                for (const issue of issues) {
                    if (issue.story !== story.name)
                        continue;
                    storyObjectMap.get(story.name)?.issues.push(issue);
                }
            }
            return storyObjectMap;
        };
        this.getOpenPullRequest = async (prUrl) => {
            const parsedUrl = this.parseIssueUrl(prUrl);
            if (!parsedUrl.isPr) {
                return null;
            }
            const { owner, repo, issueNumber: prNumber } = parsedUrl;
            const slimPullRequest = await this.fetchSlimPullRequest(owner, repo, prNumber);
            if (!slimPullRequest || slimPullRequest.state !== 'OPEN') {
                return null;
            }
            return this.buildRelatedPullRequestFromSlim(owner, repo, slimPullRequest);
        };
        this.fetchRestPullRequestCiStatus = async (owner, repo, prNumber, prUrl) => {
            const maxAttempts = 3;
            const retryDelayMilliseconds = 1000;
            let lastPullRequest = null;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                if (attempt > 0) {
                    await this.sleep(retryDelayMilliseconds);
                }
                const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (response.status === 404) {
                    return null;
                }
                if (!response.ok) {
                    await this.throwGitHubError(`Failed to fetch pull request status for ${prUrl}`, response);
                }
                const body = await response.json();
                if (!isRestPullRequestCiStatusResponse(body)) {
                    throw new Error(`Unexpected response shape when fetching pull request status for ${prUrl}`);
                }
                lastPullRequest = body;
                if (body.state !== 'open' || body.mergeable !== null) {
                    return body;
                }
            }
            return lastPullRequest;
        };
        this.getOpenPullRequestCiStatus = async (prUrl) => {
            const parsedUrl = this.parseIssueUrl(prUrl);
            if (!parsedUrl.isPr) {
                return null;
            }
            const { owner, repo, issueNumber: prNumber } = parsedUrl;
            const pullRequest = await this.fetchRestPullRequestCiStatus(owner, repo, prNumber, prUrl);
            if (!pullRequest || pullRequest.state !== 'open') {
                return null;
            }
            const requiredCheckNames = await this.getRequiredCheckNames(owner, repo, pullRequest.base.ref);
            const ciContexts = await this.getCommitCiContexts(owner, repo, pullRequest.head.sha);
            const status = this.computePrStatus(pullRequest.html_url, pullRequest.head.ref, {
                isDraft: pullRequest.draft,
                mergeable: (0, exports.graphqlMergeableFromRestMergeable)(pullRequest.mergeable),
                requiredCheckNames,
                ciContexts,
                reviewThreads: [],
            });
            return {
                url: status.url,
                isConflicted: status.isConflicted,
                mergeable: status.mergeable,
                isPassedAllCiJob: status.isPassedAllCiJob,
                isCiStateSuccess: status.isCiStateSuccess,
                isBranchOutOfDate: status.isBranchOutOfDate,
                missingRequiredCheckNames: status.missingRequiredCheckNames,
            };
        };
        // Resolves many pull requests with one GraphQL query per hundred instead of
        // one query per pull request. A URL this cannot settle is left out of the
        // returned map rather than mapped to null, so the caller falls back to
        // getOpenPullRequest for it and an unknown state is never mistaken for an
        // absent pull request.
        this.getOpenPullRequests = async (prUrls) => {
            const resolved = new Map();
            const parsedByUrl = new Map();
            for (const prUrl of Array.from(new Set(prUrls))) {
                const parsedUrl = this.parseIssueUrl(prUrl);
                if (!parsedUrl.isPr) {
                    resolved.set(prUrl, null);
                    continue;
                }
                parsedByUrl.set(prUrl, {
                    owner: parsedUrl.owner,
                    repo: parsedUrl.repo,
                    prNumber: parsedUrl.issueNumber,
                });
            }
            const urlsToFetch = Array.from(parsedByUrl.keys());
            for (let start = 0; start < urlsToFetch.length; start += SLIM_PULL_REQUEST_BATCH_SIZE) {
                const batchUrls = urlsToFetch.slice(start, start + SLIM_PULL_REQUEST_BATCH_SIZE);
                let slimByUrl;
                try {
                    slimByUrl = await this.fetchSlimPullRequestsInOneQuery(batchUrls.map((prUrl) => ({
                        prUrl,
                        ...this.requireParsedPullRequest(parsedByUrl, prUrl),
                    })));
                }
                catch (error) {
                    console.warn(`ApiV3CheerioRestIssueRepository: batched pull request status query failed, leaving ${batchUrls.length} pull request(s) to per-request resolution. error: ${error instanceof Error ? error.message : String(error)}`);
                    continue;
                }
                for (const prUrl of batchUrls) {
                    if (!slimByUrl.has(prUrl)) {
                        continue;
                    }
                    const slimPullRequest = slimByUrl.get(prUrl) ?? null;
                    if (!slimPullRequest || slimPullRequest.state !== 'OPEN') {
                        resolved.set(prUrl, null);
                        continue;
                    }
                    const parsed = this.requireParsedPullRequest(parsedByUrl, prUrl);
                    try {
                        resolved.set(prUrl, await this.buildRelatedPullRequestFromSlim(parsed.owner, parsed.repo, slimPullRequest));
                    }
                    catch (error) {
                        console.warn(`ApiV3CheerioRestIssueRepository: building the pull request status failed, leaving it to per-request resolution. prUrl: ${prUrl} error: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
            return resolved;
        };
        this.requireParsedPullRequest = (parsedByUrl, prUrl) => {
            const parsed = parsedByUrl.get(prUrl);
            if (!parsed) {
                throw new Error(`Pull request URL was not parsed: ${prUrl}`);
            }
            return parsed;
        };
        // A pull request whose review threads do not fit the first page is omitted
        // from the returned map, so the caller resolves it through the paginating
        // single-pull-request path and the resolved-thread state stays complete.
        this.fetchSlimPullRequestsInOneQuery = async (references) => {
            const aliasOf = (index) => `pullRequest${index}`;
            const variableDeclarations = references
                .map((_, index) => `$owner${index}: String!, $repo${index}: String!, $prNumber${index}: Int!`)
                .join(', ');
            const selections = references
                .map((_, index) => `  ${aliasOf(index)}: repository(owner: $owner${index}, name: $repo${index}) {
    pullRequest(number: $prNumber${index}) {
      url
      state
      isDraft
      headRefName
      baseRefName
      mergeable
      headRefOid
      reviewThreads(first: ${SLIM_PULL_REQUEST_REVIEW_THREADS_PAGE_SIZE}) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          isResolved
        }
      }
    }
  }`)
                .join('\n');
            const query = `query PullRequestSlimStatusBatch(${variableDeclarations}) {\n${selections}\n}`;
            const variables = {};
            references.forEach((reference, index) => {
                variables[`owner${index}`] = reference.owner;
                variables[`repo${index}`] = reference.repo;
                variables[`prNumber${index}`] = reference.prNumber;
            });
            const response = await this.fetchWithRateLimitRetry(() => (0, githubGraphqlClient_1.fetchGithubGraphql)({ ghToken: this.ghToken, query, variables }));
            if (!response.ok) {
                throw new Error(`Failed to fetch pull requests from GitHub GraphQL API: HTTP ${response.status}`);
            }
            const responseData = await response.json();
            if (!isSlimPullRequestBatchResponse(responseData)) {
                throw new Error('Unexpected response shape when fetching pull requests');
            }
            const errors = responseData.errors || [];
            const notFoundAliases = new Set(errors
                .filter((error) => error.type === 'NOT_FOUND')
                .map((error) => String(error.path?.[0] ?? '')));
            const otherErrorAliases = new Set(errors
                .filter((error) => error.type !== 'NOT_FOUND')
                .map((error) => String(error.path?.[0] ?? '')));
            if (!responseData.data) {
                throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
            }
            const unattributedError = errors.some((error) => error.type !== 'NOT_FOUND' && !error.path);
            if (unattributedError) {
                throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
            }
            const slimByUrl = new Map();
            references.forEach((reference, index) => {
                const alias = aliasOf(index);
                if (otherErrorAliases.has(alias)) {
                    return;
                }
                const node = responseData.data?.[alias]?.pullRequest ?? null;
                if (!node) {
                    if (notFoundAliases.has(alias) || !errors.length) {
                        slimByUrl.set(reference.prUrl, null);
                    }
                    return;
                }
                if (node.reviewThreads?.pageInfo.hasNextPage === true) {
                    return;
                }
                slimByUrl.set(reference.prUrl, {
                    url: node.url,
                    state: node.state,
                    isDraft: node.isDraft,
                    headRefName: node.headRefName,
                    baseRefName: node.baseRefName,
                    mergeable: node.mergeable,
                    headRefOid: node.headRefOid,
                    reviewThreads: (node.reviewThreads?.nodes || []).map((thread) => ({
                        isResolved: thread.isResolved,
                    })),
                });
            });
            return slimByUrl;
        };
        this.closePullRequest = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ state: 'closed' }),
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to close PR ${prUrl}: ${reason}`);
            }
        };
        this.closeIssueByUrl = async (issueUrl, stateReason) => {
            const { owner, repo, issueNumber } = this.parseIssueUrl(issueUrl);
            const ownerSegment = encodeURIComponent(owner);
            const repoSegment = encodeURIComponent(repo);
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/issues/${issueNumber}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ state: 'closed', state_reason: stateReason }),
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to close issue ${issueUrl}: ${reason}`);
            }
        };
        this.getPullRequestChangedFilePaths = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            const perPage = 100;
            const collectedPaths = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!response.ok) {
                    const reason = await this.formatGitHubErrorWithStatus(response);
                    throw new Error(`Failed to fetch changed files for PR ${prUrl}: ${reason}`);
                }
                const body = await response.json();
                if (!isPullRequestFilesResponse(body)) {
                    throw new Error(`Unexpected response shape when fetching changed files for PR ${prUrl}`);
                }
                for (const file of body) {
                    collectedPaths.push(file.filename);
                }
                if (body.length < perPage) {
                    hasMore = false;
                }
                else {
                    page += 1;
                }
            }
            return collectedPaths;
        };
        this.getAuthenticatedUserLogin = async () => {
            const response = await this.fetchWithRateLimitRetry(() => fetch('https://api.github.com/user', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to fetch authenticated user: ${reason}`);
            }
            const body = await response.json();
            if (!isAuthenticatedUserResponse(body)) {
                throw new Error('Unexpected response shape when fetching authenticated user');
            }
            return body.login;
        };
        this.approvePullRequest = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/reviews`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({ event: 'APPROVE' }),
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to approve PR ${prUrl}: ${reason}`);
            }
        };
        this.mergePullRequest = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            const mergeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/merge`;
            const headers = {
                Authorization: `Bearer ${this.ghToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/vnd.github+json',
            };
            const mergeWith = (mergeMethod) => this.fetchWithRateLimitRetry(() => fetch(mergeUrl, {
                method: 'PUT',
                headers,
                body: JSON.stringify(mergeMethod ? { merge_method: mergeMethod } : {}),
            }));
            const response = await mergeWith();
            if (response.ok) {
                return;
            }
            if (response.status === 405) {
                const fallbackMethod = await this.resolveAllowedMergeMethod(owner, repo);
                if (fallbackMethod !== null) {
                    const retryResponse = await mergeWith(fallbackMethod);
                    if (retryResponse.ok) {
                        return;
                    }
                    const retryReason = await this.formatGitHubErrorWithStatus(retryResponse);
                    throw new Error(`Failed to merge PR ${prUrl}: ${retryReason}`);
                }
            }
            const reason = await this.formatGitHubErrorWithStatus(response);
            throw new Error(`Failed to merge PR ${prUrl}: ${reason}`);
        };
        this.resolveAllowedMergeMethod = async (owner, repo) => {
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (!isRepoMergeSettings(data)) {
                return null;
            }
            if (data.allow_squash_merge === true) {
                return 'squash';
            }
            if (data.allow_rebase_merge === true) {
                return 'rebase';
            }
            return null;
        };
        this.requestChangesWithInlineComment = async (prUrl, changedFilePath, commentBody, inlineCommentLocation = null) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            if (changedFilePath === null) {
                await this.createCommentByUrl(prUrl, commentBody);
                return;
            }
            const inlineComment = inlineCommentLocation === null
                ? { path: changedFilePath, position: 1, body: commentBody }
                : {
                    path: changedFilePath,
                    line: inlineCommentLocation.line,
                    side: inlineCommentLocation.side,
                    body: commentBody,
                };
            const reviewBody = {
                event: 'REQUEST_CHANGES',
                body: commentBody,
                comments: [inlineComment],
            };
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/reviews`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify(reviewBody),
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                if (response.status === 422 &&
                    reason.includes(SELF_AUTHORED_REVIEW_REFUSAL)) {
                    await this.recordRequestedChangesWithoutReview(prUrl, changedFilePath, commentBody, inlineCommentLocation);
                    return;
                }
                throw new Error(`Failed to request changes on PR ${prUrl}: ${reason}`);
            }
        };
        this.recordRequestedChangesWithoutReview = async (prUrl, changedFilePath, commentBody, inlineCommentLocation) => {
            if (inlineCommentLocation === null) {
                await this.createCommentByUrl(prUrl, commentBody);
                return;
            }
            await this.createPullRequestReviewComment(prUrl, changedFilePath, inlineCommentLocation.line, inlineCommentLocation.side, commentBody);
        };
        this.fetchPullRequestHeadSha = async (owner, repo, prNumber, prUrl) => {
            const ownerSegment = encodeURIComponent(owner);
            const repoSegment = encodeURIComponent(repo);
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/pulls/${prNumber}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to fetch head commit for PR ${prUrl}: ${reason}`);
            }
            const body = await response.json();
            if (!isRecord(body) ||
                !isRecord(body.head) ||
                typeof body.head.sha !== 'string') {
                throw new Error(`Unexpected response shape when fetching head commit for PR ${prUrl}`);
            }
            return body.head.sha;
        };
        this.createPullRequestReviewComment = async (prUrl, path, line, side, commentBody) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            const commitId = await this.fetchPullRequestHeadSha(owner, repo, prNumber, prUrl);
            const ownerSegment = encodeURIComponent(owner);
            const repoSegment = encodeURIComponent(repo);
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${ownerSegment}/${repoSegment}/pulls/${prNumber}/comments`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({
                    body: commentBody,
                    commit_id: commitId,
                    path,
                    line,
                    side,
                }),
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to create review comment on PR ${prUrl}: ${reason}`);
            }
        };
        this.readGitHubErrorReason = async (response) => {
            let parsed;
            try {
                parsed = await response.json();
            }
            catch {
                return null;
            }
            if (!isRecord(parsed) || typeof parsed.message !== 'string') {
                return null;
            }
            if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                const details = parsed.errors
                    .map((error) => {
                    if (typeof error === 'string') {
                        return error;
                    }
                    if (isRecord(error) && typeof error.message === 'string') {
                        return error.message;
                    }
                    return '';
                })
                    .filter((detail) => detail.length > 0)
                    .join('; ');
                if (details.length > 0) {
                    return `${parsed.message}: ${details}`;
                }
            }
            return parsed.message;
        };
        this.formatGitHubErrorWithStatus = async (response) => {
            const status = `HTTP ${response.status}`;
            const bodyText = await response.clone().text();
            const reason = await this.readGitHubErrorReason(response);
            if ((0, githubRateLimitRetry_1.hasRateLimitSignals)(response.status, response.headers, bodyText)) {
                const resetIso = (0, githubRateLimitRetry_1.computeRateLimitResetIso)(response.headers);
                const resetSuffix = resetIso === null ? '' : ` (resets at ${resetIso})`;
                return `${status} GitHub rate limit exceeded, please retry shortly${resetSuffix}`;
            }
            if (response.status === 403) {
                const permissionSuffix = reason === null ? '' : ` ${reason}`;
                return `${status} permission denied, the token cannot perform this operation${permissionSuffix}`;
            }
            if (reason === null) {
                return status;
            }
            return `${status} ${reason}`;
        };
        this.updateBranch = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/update-branch`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (response.ok) {
                return true;
            }
            if (response.status === 422) {
                return false;
            }
            const reason = await this.formatGitHubErrorWithStatus(response);
            throw new Error(`Failed to update branch for PR ${prUrl}: ${reason}`);
        };
        this.deletePullRequestBranch = async (prUrl, branchName) => {
            const { owner, repo } = this.parseIssueUrl(prUrl);
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branchName)}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            }));
            if (!response.ok && response.status !== 422) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to delete branch ${branchName} for PR ${prUrl}: ${reason}`);
            }
        };
        this.createCommentByUrl = async (issueOrPrUrl, commentBody) => {
            await this.restIssueRepository.createComment(issueOrPrUrl, commentBody);
        };
        this.fetchIssueBodyResponse = (url) => {
            const { owner, repo, issueNumber } = this.parseIssueUrl(url);
            return this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
        };
        this.parseIssueBodyResponse = async (url, response) => {
            const body = await response.json();
            if (!isIssueOrPullRequestBodyResponse(body)) {
                throw new Error(`Unexpected response shape when fetching body for ${url}`);
            }
            return body.body ?? '';
        };
        this.getIssueOrPullRequestBody = async (url) => {
            const response = await this.fetchIssueBodyResponse(url);
            if (!response.ok) {
                await this.throwGitHubError(`Failed to fetch body for ${url}`, response);
            }
            return this.parseIssueBodyResponse(url, response);
        };
        this.getIssueBodyByUrl = async (url) => {
            const response = await this.fetchIssueBodyResponse(url);
            if (response.status === 404) {
                return null;
            }
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to fetch body for ${url}: ${reason}`);
            }
            return this.parseIssueBodyResponse(url, response);
        };
        this.getIssueOrPullRequestComments = async (url) => {
            const { owner, repo, issueNumber } = this.parseIssueUrl(url);
            const perPage = 100;
            const collectedComments = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!response.ok) {
                    await this.throwGitHubError(`Failed to fetch comments for ${url}`, response);
                }
                const body = await response.json();
                if (!isIssueCommentsResponse(body)) {
                    throw new Error(`Unexpected response shape when fetching comments for ${url}`);
                }
                for (const comment of body) {
                    collectedComments.push({
                        author: comment.user?.login ?? '',
                        body: comment.body ?? '',
                        createdAt: new Date(comment.created_at),
                    });
                }
                if (body.length < perPage) {
                    hasMore = false;
                }
                else {
                    page += 1;
                }
            }
            return collectedComments;
        };
        this.getPullRequestDetail = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber, isPr, } = this.parseIssueUrl(prUrl);
            if (!isPr) {
                return null;
            }
            const detailResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (!detailResponse.ok) {
                await this.throwGitHubError(`Failed to fetch detail for PR ${prUrl}`, detailResponse);
            }
            const detailBody = await detailResponse.json();
            if (!isPullRequestDetailResponse(detailBody)) {
                throw new Error(`Unexpected response shape when fetching detail for PR ${prUrl}`);
            }
            const files = await this.fetchPullRequestFiles(owner, repo, prNumber, prUrl);
            return {
                title: detailBody.title,
                state: detailBody.state,
                merged: detailBody.merged,
                isDraft: detailBody.draft,
                additions: detailBody.additions,
                deletions: detailBody.deletions,
                changedFiles: detailBody.changed_files,
                headRefName: detailBody.head.ref,
                baseRefName: detailBody.base.ref,
                author: detailBody.user?.login ?? '',
                files,
            };
        };
        this.fetchPullRequestFiles = async (owner, repo, prNumber, prUrl) => {
            const perPage = 100;
            const collectedFiles = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!response.ok) {
                    await this.throwGitHubError(`Failed to fetch files for PR ${prUrl}`, response);
                }
                const body = await response.json();
                if (!isPullRequestDetailFilesResponse(body)) {
                    throw new Error(`Unexpected response shape when fetching files for PR ${prUrl}`);
                }
                for (const file of body) {
                    collectedFiles.push({
                        filename: file.filename,
                        status: file.status,
                        additions: file.additions,
                        deletions: file.deletions,
                        patch: file.patch ?? null,
                        rawUrl: file.raw_url === undefined
                            ? null
                            : (0, gitHubRawUrl_1.normalizeGitHubRawUrl)(file.raw_url),
                    });
                }
                if (body.length < perPage) {
                    hasMore = false;
                }
                else {
                    page += 1;
                }
            }
            return collectedFiles;
        };
        this.getPullRequestCommits = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber, isPr, } = this.parseIssueUrl(prUrl);
            if (!isPr) {
                return [];
            }
            const perPage = 100;
            const collectedCommits = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/commits?per_page=${perPage}&page=${page}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!response.ok) {
                    await this.throwGitHubError(`Failed to fetch commits for PR ${prUrl}`, response);
                }
                const body = await response.json();
                if (!isPullRequestCommitsResponse(body)) {
                    throw new Error(`Unexpected response shape when fetching commits for PR ${prUrl}`);
                }
                for (const commit of body) {
                    collectedCommits.push({
                        sha: commit.sha,
                        message: commit.commit.message,
                        author: commit.commit.author?.name ?? '',
                        authoredAt: new Date(commit.commit.author?.date ?? 0),
                    });
                }
                if (body.length < perPage) {
                    hasMore = false;
                }
                else {
                    page += 1;
                }
            }
            return collectedCommits;
        };
        this.getIssueOrPullRequestState = async (url) => {
            const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(url);
            if (isPr) {
                const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${issueNumber}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!response.ok) {
                    await this.throwGitHubError(`Failed to fetch state for ${url}`, response);
                }
                const body = await response.json();
                if (!isPullRequestDetailResponse(body)) {
                    throw new Error(`Unexpected response shape when fetching state for ${url}`);
                }
                return {
                    state: body.state,
                    merged: body.merged,
                    isPullRequest: true,
                    title: body.title,
                };
            }
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (!response.ok) {
                await this.throwGitHubError(`Failed to fetch state for ${url}`, response);
            }
            const body = await response.json();
            if (!isIssueOrPullRequestStateResponse(body)) {
                throw new Error(`Unexpected response shape when fetching state for ${url}`);
            }
            return {
                state: body.state,
                merged: false,
                isPullRequest: false,
                title: body.title,
            };
        };
        this.getPullRequestSummary = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber, isPr, } = this.parseIssueUrl(prUrl);
            if (!isPr) {
                return null;
            }
            const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            }));
            if (!response.ok) {
                const reason = await this.formatGitHubErrorWithStatus(response);
                throw new Error(`Failed to fetch summary for PR ${prUrl}: ${reason}`);
            }
            const body = await response.json();
            if (!isPullRequestDetailResponse(body)) {
                throw new Error(`Unexpected response shape when fetching summary for PR ${prUrl}`);
            }
            return {
                title: body.title,
                body: body.body ?? '',
                additions: body.additions,
                deletions: body.deletions,
                changedFiles: body.changed_files,
            };
        };
        this.deleteAllCommentsByUrl = async (issueOrPrUrl) => {
            const { owner, repo, issueNumber } = this.parseIssueUrl(issueOrPrUrl);
            const perPage = 100;
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const response = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                }));
                if (!response.ok) {
                    await this.throwGitHubError(`Failed to fetch comments for ${issueOrPrUrl}`, response);
                }
                const body = await response.json();
                if (!isIssueCommentIdResponse(body)) {
                    throw new Error(`Unexpected response shape when fetching comments for ${issueOrPrUrl}`);
                }
                for (const comment of body) {
                    const deleteResponse = await this.fetchWithRateLimitRetry(() => fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${comment.id}`, {
                        method: 'DELETE',
                        headers: {
                            Authorization: `Bearer ${this.ghToken}`,
                            Accept: 'application/vnd.github+json',
                        },
                    }));
                    if (!deleteResponse.ok) {
                        await this.throwGitHubError(`Failed to delete comment ${comment.id} on ${issueOrPrUrl}`, deleteResponse);
                    }
                }
                if (body.length < perPage) {
                    hasMore = false;
                }
                else {
                    page += 1;
                }
            }
        };
        this.projectIssuesCacheRepository = new ProjectIssuesCacheRepository_1.ProjectIssuesCacheRepository(localStorageCacheRepository);
    }
}
exports.ApiV3CheerioRestIssueRepository = ApiV3CheerioRestIssueRepository;
//# sourceMappingURL=ApiV3CheerioRestIssueRepository.js.map