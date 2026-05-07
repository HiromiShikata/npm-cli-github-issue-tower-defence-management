"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiV3CheerioRestIssueRepository = void 0;
const typia_1 = __importDefault(require("typia"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
const utils_1 = require("../utils");
function isGetPullRequestResponse(value) {
    return (() => { const _io0 = input => (undefined === input.data || "object" === typeof input.data && null !== input.data && false === Array.isArray(input.data) && _io1(input.data)) && (undefined === input.errors || Array.isArray(input.errors) && input.errors.every(elem => "object" === typeof elem && null !== elem && _io22(elem))); const _io1 = input => undefined === input.repository || "object" === typeof input.repository && null !== input.repository && false === Array.isArray(input.repository) && _io2(input.repository); const _io2 = input => undefined === input.pullRequest || "object" === typeof input.pullRequest && null !== input.pullRequest && _io3(input.pullRequest); const _io3 = input => "string" === typeof input.state && "string" === typeof input.mergeable && ("object" === typeof input.commits && null !== input.commits && _io4(input.commits)) && ("object" === typeof input.reviewThreads && null !== input.reviewThreads && _io11(input.reviewThreads)) && ("object" === typeof input.baseRepository && null !== input.baseRepository && _io13(input.baseRepository)); const _io4 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io5(elem)); const _io5 = input => "object" === typeof input.commit && null !== input.commit && _io6(input.commit); const _io6 = input => null === input.statusCheckRollup || "object" === typeof input.statusCheckRollup && null !== input.statusCheckRollup && _io7(input.statusCheckRollup); const _io7 = input => "string" === typeof input.state && ("object" === typeof input.contexts && null !== input.contexts && _io8(input.contexts)); const _io8 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && false === Array.isArray(elem) && _iu0(elem)); const _io9 = input => (undefined === input.name || "string" === typeof input.name) && (undefined === input.status || "string" === typeof input.status) && (null === input.conclusion || undefined === input.conclusion || "string" === typeof input.conclusion); const _io10 = input => (undefined === input.context || "string" === typeof input.context) && (undefined === input.state || "string" === typeof input.state); const _io11 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io12(elem)); const _io12 = input => "boolean" === typeof input.isResolved; const _io13 = input => "object" === typeof input.branchProtectionRules && null !== input.branchProtectionRules && _io14(input.branchProtectionRules) && ("object" === typeof input.rulesets && null !== input.rulesets && _io16(input.rulesets)); const _io14 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io15(elem)); const _io15 = input => Array.isArray(input.requiredStatusCheckContexts) && input.requiredStatusCheckContexts.every(elem => "string" === typeof elem); const _io16 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io17(elem)); const _io17 = input => "object" === typeof input.rules && null !== input.rules && _io18(input.rules); const _io18 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io19(elem)); const _io19 = input => "string" === typeof input.type && (undefined === input.parameters || "object" === typeof input.parameters && null !== input.parameters && false === Array.isArray(input.parameters) && _io20(input.parameters)); const _io20 = input => undefined === input.requiredStatusChecks || Array.isArray(input.requiredStatusChecks) && input.requiredStatusChecks.every(elem => "object" === typeof elem && null !== elem && _io21(elem)); const _io21 = input => "string" === typeof input.context; const _io22 = input => "string" === typeof input.message; const _iu0 = input => (() => {
        if (_io9(input))
            return _io9(input);
        if (_io10(input))
            return _io10(input);
        return false;
    })(); return input => "object" === typeof input && null !== input && false === Array.isArray(input) && _io0(input); })()(value);
}
function isFindRelatedPRsResponse(value) {
    return (() => { const _io0 = input => (undefined === input.data || "object" === typeof input.data && null !== input.data && false === Array.isArray(input.data) && _io1(input.data)) && (undefined === input.errors || Array.isArray(input.errors) && input.errors.every(elem => "object" === typeof elem && null !== elem && _io7(elem))); const _io1 = input => undefined === input.repository || "object" === typeof input.repository && null !== input.repository && false === Array.isArray(input.repository) && _io2(input.repository); const _io2 = input => undefined === input.issue || "object" === typeof input.issue && null !== input.issue && _io3(input.issue); const _io3 = input => "object" === typeof input.timelineItems && null !== input.timelineItems && _io4(input.timelineItems); const _io4 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && false === Array.isArray(elem) && _io5(elem)); const _io5 = input => undefined === input.source || "object" === typeof input.source && null !== input.source && false === Array.isArray(input.source) && _io6(input.source); const _io6 = input => (undefined === input.url || "string" === typeof input.url) && (undefined === input.state || "string" === typeof input.state); const _io7 = input => "string" === typeof input.message; return input => "object" === typeof input && null !== input && false === Array.isArray(input) && _io0(input); })()(value);
}
class ApiV3CheerioRestIssueRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, localStorageRepository, jsonFilePath = './tmp/github.com.cookies.json', ghToken = process.env.GH_TOKEN || 'dummy', ghUserName = process.env.GH_USER_NAME, ghUserPassword = process.env.GH_USER_PASSWORD, ghAuthenticatorKey = process.env
        .GH_AUTHENTICATOR_KEY) {
        super(localStorageRepository, jsonFilePath, ghToken, ghUserName, ghUserPassword, ghAuthenticatorKey);
        this.apiV3IssueRepository = apiV3IssueRepository;
        this.restIssueRepository = restIssueRepository;
        this.graphqlProjectItemRepository = graphqlProjectItemRepository;
        this.localStorageCacheRepository = localStorageCacheRepository;
        this.localStorageRepository = localStorageRepository;
        this.jsonFilePath = jsonFilePath;
        this.ghToken = ghToken;
        this.ghUserName = ghUserName;
        this.ghUserPassword = ghUserPassword;
        this.ghAuthenticatorKey = ghAuthenticatorKey;
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
                body: item.body,
                itemId: item.id,
                isPr: item.url.includes('/pull/'),
                isInProgress: (0, utils_1.normalizeFieldName)(status || '').includes('progress'),
                isClosed: item.state !== 'OPEN',
                createdAt: new Date(item.createdAt || '2000-01-01'),
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
                    if ((() => { const _io0 = input => "string" === typeof input.nameWithOwner && "number" === typeof input.number && "string" === typeof input.title && ("OPEN" === input.state || "CLOSED" === input.state || "MERGED" === input.state) && (null === input.status || "string" === typeof input.status) && (null === input.story || "string" === typeof input.story) && (null === input.nextActionDate || input.nextActionDate instanceof Date) && (null === input.nextActionHour || "number" === typeof input.nextActionHour) && (null === input.estimationMinutes || "number" === typeof input.estimationMinutes) && (Array.isArray(input.dependedIssueUrls) && input.dependedIssueUrls.every(elem => "string" === typeof elem)) && (null === input.completionDate50PercentConfidence || input.completionDate50PercentConfidence instanceof Date) && "string" === typeof input.url && (Array.isArray(input.assignees) && input.assignees.every(elem => "string" === typeof elem)) && (Array.isArray(input.labels) && input.labels.every(elem => "string" === typeof elem)) && "string" === typeof input.org && "string" === typeof input.repo && "string" === typeof input.body && "string" === typeof input.itemId && "boolean" === typeof input.isPr && "boolean" === typeof input.isInProgress && "boolean" === typeof input.isClosed && input.createdAt instanceof Date; return input => Array.isArray(input) && input.every(elem => "object" === typeof elem && null !== elem && _io0(elem)); })()(issues)) {
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
        this.getOpenPullRequest = async (prUrl) => {
            const match = prUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
            if (!match) {
                return null;
            }
            const [, owner, repo, prNumberStr] = match;
            const prNumber = parseInt(prNumberStr, 10);
            const query = `query GetPullRequest($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          state
          mergeable
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  state
                  contexts(first: 100) {
                    nodes {
                      ... on CheckRun {
                        name
                        status
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
          baseRepository {
            branchProtectionRules(first: 10) {
              nodes {
                requiredStatusCheckContexts
              }
            }
            rulesets(first: 10) {
              nodes {
                rules(first: 50) {
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
        }
      }
    }`;
            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: { owner, repo, number: prNumber },
                }),
            });
            const responseData = await response.json();
            if (!isGetPullRequestResponse(responseData)) {
                throw new Error('Unexpected response shape when fetching pull request from GitHub GraphQL API');
            }
            if (responseData.errors && responseData.errors.length > 0) {
                throw new Error(responseData.errors.map((e) => e.message).join('\n'));
            }
            const pr = responseData.data?.repository?.pullRequest;
            if (!pr || pr.state !== 'OPEN') {
                return null;
            }
            const isConflicted = pr.mergeable === 'CONFLICTING';
            const lastCommit = pr.commits.nodes[pr.commits.nodes.length - 1];
            const rollup = lastCommit?.commit?.statusCheckRollup;
            const isCiStateSuccess = rollup?.state === 'SUCCESS';
            const requiredCheckNames = [];
            for (const rule of pr.baseRepository.branchProtectionRules.nodes) {
                requiredCheckNames.push(...rule.requiredStatusCheckContexts);
            }
            for (const ruleset of pr.baseRepository.rulesets.nodes) {
                for (const rule of ruleset.rules.nodes) {
                    if (rule.type === 'REQUIRED_STATUS_CHECKS' &&
                        rule.parameters?.requiredStatusChecks) {
                        requiredCheckNames.push(...rule.parameters.requiredStatusChecks.map((c) => c.context));
                    }
                }
            }
            const contextNodes = rollup?.contexts?.nodes ?? [];
            const completedCheckNames = contextNodes
                .map((node) => {
                if ('name' in node && node.name) {
                    return node.name;
                }
                if ('context' in node && node.context) {
                    return node.context;
                }
                return null;
            })
                .filter((name) => name !== null);
            const missingRequiredCheckNames = requiredCheckNames.filter((required) => !completedCheckNames.includes(required));
            const isPassedAllCiJob = isCiStateSuccess && missingRequiredCheckNames.length === 0;
            const isResolvedAllReviewComments = pr.reviewThreads.nodes.every((thread) => thread.isResolved);
            return {
                url: prUrl,
                isConflicted,
                isPassedAllCiJob,
                isCiStateSuccess,
                isResolvedAllReviewComments,
                isBranchOutOfDate: false,
                missingRequiredCheckNames,
            };
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
        this.findRelatedOpenPRs = async (issueUrl) => {
            const match = issueUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
            if (!match) {
                return [];
            }
            const [, owner, repo, issueNumberStr] = match;
            const issueNumber = parseInt(issueNumberStr, 10);
            const query = `query FindRelatedPRs($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 50) {
            nodes {
              ... on CrossReferencedEvent {
                source {
                  ... on PullRequest {
                    url
                    state
                  }
                }
              }
            }
          }
        }
      }
    }`;
            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: { owner, repo, number: issueNumber },
                }),
            });
            const responseData = await response.json();
            if (!isFindRelatedPRsResponse(responseData)) {
                throw new Error('Unexpected response shape when fetching related PRs from GitHub GraphQL API');
            }
            if (responseData.errors && responseData.errors.length > 0) {
                throw new Error(responseData.errors.map((e) => e.message).join('\n'));
            }
            const nodes = responseData.data?.repository?.issue?.timelineItems?.nodes ?? [];
            const openPrUrls = nodes
                .filter((node) => node.source?.url &&
                node.source?.state === 'OPEN' &&
                node.source.url.includes('/pull/'))
                .map((node) => node.source?.url)
                .filter((url) => url !== undefined);
            const results = [];
            for (const prUrl of openPrUrls) {
                const pr = await this.getOpenPullRequest(prUrl);
                if (pr) {
                    results.push(pr);
                }
            }
            return results;
        };
        this.getAllOpened = async (_project) => {
            throw new Error('getAllOpened is not implemented');
        };
        this.getStoryObjectMap = async (_project) => {
            throw new Error('getStoryObjectMap is not implemented');
        };
    }
}
exports.ApiV3CheerioRestIssueRepository = ApiV3CheerioRestIssueRepository;
//# sourceMappingURL=ApiV3CheerioRestIssueRepository.js.map