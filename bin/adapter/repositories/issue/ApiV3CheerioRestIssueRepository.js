"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiV3CheerioRestIssueRepository = void 0;
const typia_1 = __importDefault(require("typia"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
const utils_1 = require("../utils");
function isIssueTimelineResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isDirectPullRequestResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
const fnmatch = (pattern, str) => {
    let regexStr = '^';
    let i = 0;
    while (i < pattern.length) {
        const c = pattern[i];
        if (c === '*') {
            if (pattern[i + 1] === '*') {
                regexStr += '.*';
                i += 2;
                if (pattern[i] === '/') {
                    i++;
                }
            }
            else {
                regexStr += '[^/]*';
                i++;
            }
        }
        else if (c === '?') {
            regexStr += '[^/]';
            i++;
        }
        else if (c === '[') {
            let j = i + 1;
            while (j < pattern.length && pattern[j] !== ']') {
                j++;
            }
            if (j >= pattern.length) {
                regexStr += '\\[';
                i++;
                continue;
            }
            const content = pattern.slice(i + 1, j);
            if (content.length > 0 && (content[0] === '!' || content[0] === '^')) {
                const body = content.slice(1).replace(/\\/g, '\\\\');
                regexStr += '[^' + body + ']';
            }
            else {
                const escapedContent = content.replace(/\\/g, '\\\\');
                regexStr += '[' + escapedContent + ']';
            }
            i = j + 1;
        }
        else {
            regexStr += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            i++;
        }
    }
    regexStr += '$';
    try {
        const regex = new RegExp(regexStr);
        return regex.test(str);
    }
    catch {
        return pattern === str;
    }
};
class ApiV3CheerioRestIssueRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, localStorageRepository, ghToken = process.env.GH_TOKEN || 'dummy') {
        super(localStorageRepository, ghToken);
        this.apiV3IssueRepository = apiV3IssueRepository;
        this.restIssueRepository = restIssueRepository;
        this.graphqlProjectItemRepository = graphqlProjectItemRepository;
        this.localStorageCacheRepository = localStorageCacheRepository;
        this.localStorageRepository = localStorageRepository;
        this.ghToken = ghToken;
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
            };
        };
        this.getAllIssuesFromCache = async (cacheKey, allowCacheMinutes) => {
            const cache = await this.localStorageCacheRepository.getLatest(cacheKey);
            if (cache) {
                const now = new Date();
                const cacheTimestamp = cache.timestamp;
                const diff = now.getTime() - cacheTimestamp.getTime();
                if (diff < allowCacheMinutes * 60 * 1000) {
                    if (!Array.isArray(cache.value)) {
                        return null;
                    }
                    const issues = cache.value
                        .filter((issue) => typeof issue === 'object')
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
                        return {
                            ...issue,
                            nextActionDate: nextActionDate,
                            completionDate50PercentConfidence: completionDate50PercentConfidence,
                            createdAt: createdAt,
                        };
                    });
                    if ((() => { const _io0 = input => "string" === typeof input.nameWithOwner && "number" === typeof input.number && "string" === typeof input.title && ("OPEN" === input.state || "CLOSED" === input.state || "MERGED" === input.state) && (null === input.status || "string" === typeof input.status) && (null === input.story || "string" === typeof input.story) && (null === input.nextActionDate || input.nextActionDate instanceof Date) && (null === input.nextActionHour || "number" === typeof input.nextActionHour) && (null === input.estimationMinutes || "number" === typeof input.estimationMinutes) && (Array.isArray(input.dependedIssueUrls) && input.dependedIssueUrls.every(elem => "string" === typeof elem)) && (null === input.completionDate50PercentConfidence || input.completionDate50PercentConfidence instanceof Date) && "string" === typeof input.url && (Array.isArray(input.assignees) && input.assignees.every(elem => "string" === typeof elem)) && (Array.isArray(input.labels) && input.labels.every(elem => "string" === typeof elem)) && "string" === typeof input.org && "string" === typeof input.repo && "string" === typeof input.body && "string" === typeof input.itemId && "boolean" === typeof input.isPr && "boolean" === typeof input.isInProgress && "boolean" === typeof input.isClosed && input.createdAt instanceof Date && "string" === typeof input.author; return input => Array.isArray(input) && input.every(elem => "object" === typeof elem && null !== elem && _io0(elem)); })()(issues)) {
                        return issues;
                    }
                }
            }
            return null;
        };
        this.getAllIssues = async (projectId, allowCacheMinutes) => {
            const cacheKey = `allIssues-${projectId}`;
            const cachedIssues = await this.getAllIssuesFromCache(cacheKey, allowCacheMinutes);
            if (cachedIssues) {
                return { issues: cachedIssues, cacheUsed: true };
            }
            const issues = await this.getAllIssuesFromGitHub(projectId);
            await this.localStorageCacheRepository.set(cacheKey, issues);
            return { issues, cacheUsed: false };
        };
        this.getAllIssuesFromGitHub = async (projectId) => {
            const items = await this.graphqlProjectItemRepository.fetchProjectItems(projectId);
            return items.map((item) => this.convertProjectItemToIssue(item));
        };
        this.createNewIssue = async (org, repo, title, body, assignees, labels) => {
            return await this.restIssueRepository.createNewIssue(org, repo, title, body, assignees, labels);
        };
        this.updateIssue = async (issue) => {
            await this.restIssueRepository.updateIssue(issue);
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
            if (!project.dependedIssueUrlSeparatedByComma) {
                return;
            }
            const projectItem = await this.graphqlProjectItemRepository.fetchProjectItemByUrl(prUrl);
            if (!projectItem) {
                return;
            }
            const existingValue = projectItem.customFields.find((field) => field.name === project.dependedIssueUrlSeparatedByComma?.name)?.value;
            if (existingValue) {
                return;
            }
            await this.graphqlProjectItemRepository.updateProjectTextField(project.id, project.dependedIssueUrlSeparatedByComma.fieldId, projectItem.id, issueUrl);
        };
        this.updateNextActionDate = async (issueUrl, project, date) => {
            if (!project.nextActionDate) {
                return;
            }
            const projectItem = await this.graphqlProjectItemRepository.fetchProjectItemByUrl(issueUrl);
            if (!projectItem) {
                return;
            }
            return this.graphqlProjectItemRepository.updateProjectField(project.id, project.nextActionDate.fieldId, projectItem.id, { date: date.toISOString().split('T')[0] });
        };
        this.updateNextActionHour = async (project, issue, hour) => {
            return this.graphqlProjectItemRepository.updateProjectField(project.id, project.nextActionHour.fieldId, issue.itemId, { number: hour });
        };
        this.updateStory = async (project, issue, storyOptionId) => {
            await this.graphqlProjectItemRepository.updateProjectField(project.id, project.story.fieldId, issue.itemId, { singleSelectOptionId: storyOptionId });
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
        this.updateAssigneeList = (issue, assigneeList) => {
            return this.restIssueRepository.updateAssigneeList(issue, assigneeList);
        };
        this.get = async (_issueUrl, _project) => {
            return this.getIssueByUrl(_issueUrl);
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
        this.computePrStatus = (prUrl, headRefName, baseRefName, data) => {
            const isConflicted = data.mergeable === 'CONFLICTING';
            const lastCommit = data.commits?.nodes[0]?.commit;
            const ciState = lastCommit?.statusCheckRollup?.state;
            const contexts = lastCommit?.statusCheckRollup?.contexts?.nodes || [];
            const branchProtectionRules = data.baseRepository?.branchProtectionRules?.nodes || [];
            const matchingRules = baseRefName
                ? branchProtectionRules.filter((rule) => rule.pattern === baseRefName || fnmatch(rule.pattern, baseRefName))
                : [];
            const requiredCheckNamesSet = new Set();
            for (const rule of matchingRules) {
                for (const name of rule.requiredStatusCheckContexts) {
                    requiredCheckNamesSet.add(name);
                }
            }
            const rulesets = data.baseRepository?.rulesets?.nodes || [];
            const defaultBranchName = data.baseRepository?.defaultBranchRef?.name || '';
            for (const ruleset of rulesets) {
                if (ruleset.enforcement !== 'ACTIVE')
                    continue;
                const refIncludes = ruleset.conditions.refName.include;
                const refExcludes = ruleset.conditions.refName.exclude;
                const matchesInclude = baseRefName !== undefined &&
                    refIncludes.some((pattern) => {
                        if (pattern === '~DEFAULT_BRANCH') {
                            return baseRefName === defaultBranchName;
                        }
                        if (pattern === '~ALL') {
                            return true;
                        }
                        const branchPattern = pattern.replace(/^refs\/heads\//, '');
                        return (branchPattern === baseRefName || fnmatch(branchPattern, baseRefName));
                    });
                if (!matchesInclude)
                    continue;
                const matchesExclude = baseRefName !== undefined &&
                    refExcludes.some((pattern) => {
                        if (pattern === '~DEFAULT_BRANCH') {
                            return baseRefName === defaultBranchName;
                        }
                        const branchPattern = pattern.replace(/^refs\/heads\//, '');
                        return (branchPattern === baseRefName || fnmatch(branchPattern, baseRefName));
                    });
                if (matchesExclude)
                    continue;
                for (const rule of ruleset.rules.nodes) {
                    if (rule.type !== 'REQUIRED_STATUS_CHECKS')
                        continue;
                    if ('requiredStatusChecks' in rule.parameters) {
                        for (const check of rule.parameters.requiredStatusChecks) {
                            requiredCheckNamesSet.add(check.context);
                        }
                    }
                }
            }
            const requiredCheckNames = Array.from(requiredCheckNamesSet);
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
            const isCiStateSuccess = ciState === 'SUCCESS';
            const isPassedAllCiJob = isCiStateSuccess && allRequiredChecksPassed;
            const reviewThreads = data.reviewThreads?.nodes || [];
            const isResolvedAllReviewComments = reviewThreads.length === 0 ||
                reviewThreads.every((thread) => thread.isResolved);
            return {
                url: prUrl,
                branchName: headRefName ?? null,
                createdAt: new Date(0),
                isConflicted,
                isPassedAllCiJob,
                isCiStateSuccess,
                isResolvedAllReviewComments,
                isBranchOutOfDate: false,
                missingRequiredCheckNames,
            };
        };
        this.findRelatedOpenPRs = async (issueUrl) => {
            const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issueUrl);
            if (isPr) {
                throw new Error('findRelatedOpenPRs only supports issue URLs, not pull request URLs');
            }
            const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!, $after: String) {
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
                      state
                      createdAt
                      mergeable
                      headRefName
                      baseRefName
                      baseRepository {
                        branchProtectionRules(first: 100) {
                          nodes {
                            pattern
                            requiredStatusCheckContexts
                          }
                        }
                        defaultBranchRef {
                          name
                        }
                        rulesets(first: 100) {
                          nodes {
                            name
                            enforcement
                            conditions {
                              refName {
                                include
                                exclude
                              }
                            }
                            rules(first: 100) {
                              nodes {
                                type
                                parameters {
                                  ... on RequiredStatusChecksParameters {
                                    requiredStatusChecks {
                                      context
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                      commits(last: 1) {
                        nodes {
                          commit {
                            statusCheckRollup {
                              state
                              contexts(first: 100) {
                                nodes {
                                  __typename
                                  ... on CheckRun {
                                    name
                                    conclusion
                                  }
                                  ... on StatusContext {
                                    context
                                    state
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                      reviewThreads(first: 100) {
                        nodes {
                          isResolved
                        }
                      }
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
                const response = await fetch('https://api.github.com/graphql', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        variables: { owner, repo, issueNumber, after },
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch issue timeline from GitHub GraphQL API: HTTP ${response.status}`);
                }
                const responseData = await response.json();
                if (!isIssueTimelineResponse(responseData)) {
                    throw new Error('Unexpected response shape when fetching issue timeline');
                }
                const issueData = responseData.data?.repository?.issue;
                if (!issueData) {
                    throw new Error('Issue not found when fetching timeline from GitHub GraphQL API');
                }
                for (const item of issueData.timelineItems.nodes) {
                    if (item.__typename !== 'CrossReferencedEvent')
                        continue;
                    if (!item.source || item.source.__typename !== 'PullRequest')
                        continue;
                    if (item.source.state !== 'OPEN')
                        continue;
                    if (!item.willCloseTarget)
                        continue;
                    const pr = item.source;
                    const prUrl = pr.url || '';
                    const baseRefName = pr.baseRefName ?? pr.baseRef?.name;
                    const prStatus = this.computePrStatus(prUrl, pr.headRefName, baseRefName, pr);
                    relatedPRsMap.set(prUrl, {
                        ...prStatus,
                        createdAt: pr.createdAt ? new Date(pr.createdAt) : new Date(0),
                    });
                }
                hasNextPage = issueData.timelineItems.pageInfo.hasNextPage;
                after = issueData.timelineItems.pageInfo.endCursor;
            }
            return Array.from(relatedPRsMap.values());
        };
        this.getAllOpened = async (project) => {
            const { issues } = await this.getAllIssues(project.id, 0);
            return issues.filter((issue) => !issue.isClosed);
        };
        this.getStoryObjectMap = async (project, allowCacheMinutes) => {
            const { issues } = await this.getAllIssues(project.id, allowCacheMinutes);
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
            const query = `
      query($owner: String!, $repo: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            url
            state
            headRefName
            baseRefName
            mergeable
            baseRepository {
              branchProtectionRules(first: 100) {
                nodes {
                  pattern
                  requiredStatusCheckContexts
                }
              }
              defaultBranchRef {
                name
              }
              rulesets(first: 100) {
                nodes {
                  name
                  enforcement
                  conditions {
                    refName {
                      include
                      exclude
                    }
                  }
                  rules(first: 100) {
                    nodes {
                      type
                      parameters {
                        ... on RequiredStatusChecksParameters {
                          requiredStatusChecks {
                            context
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup {
                    state
                    contexts(first: 100) {
                      nodes {
                        __typename
                        ... on CheckRun {
                          name
                          conclusion
                        }
                        ... on StatusContext {
                          context
                          state
                        }
                      }
                    }
                  }
                }
              }
            }
            reviewThreads(first: 100) {
              nodes {
                isResolved
              }
            }
          }
        }
      }
    `;
            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: { owner, repo, prNumber },
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch pull request from GitHub GraphQL API: HTTP ${response.status}`);
            }
            const responseData = await response.json();
            if (!isDirectPullRequestResponse(responseData)) {
                throw new Error('Unexpected response shape when fetching pull request');
            }
            if (responseData.errors && responseData.errors.length > 0) {
                throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
            }
            const pr = responseData.data?.repository?.pullRequest;
            if (!pr || pr.state !== 'OPEN') {
                return null;
            }
            return this.computePrStatus(pr.url, pr.headRefName, pr.baseRefName, pr);
        };
        this.closePullRequest = async (prUrl) => {
            const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ state: 'closed' }),
            });
            if (!response.ok) {
                throw new Error(`Failed to close PR ${prUrl}: HTTP ${response.status}`);
            }
        };
        this.deletePullRequestBranch = async (prUrl, branchName) => {
            const { owner, repo } = this.parseIssueUrl(prUrl);
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branchName)}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            });
            if (!response.ok && response.status !== 422) {
                throw new Error(`Failed to delete branch ${branchName} for PR ${prUrl}: HTTP ${response.status}`);
            }
        };
        this.createCommentByUrl = async (issueOrPrUrl, commentBody) => {
            await this.restIssueRepository.createComment(issueOrPrUrl, commentBody);
        };
    }
}
exports.ApiV3CheerioRestIssueRepository = ApiV3CheerioRestIssueRepository;
//# sourceMappingURL=ApiV3CheerioRestIssueRepository.js.map