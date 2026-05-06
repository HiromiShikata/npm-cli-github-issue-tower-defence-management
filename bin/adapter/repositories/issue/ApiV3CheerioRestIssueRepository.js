"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiV3CheerioRestIssueRepository = void 0;
const typia_1 = __importDefault(require("typia"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
const utils_1 = require("../utils");
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
                body: JSON.stringify({ query, variables: { owner, repo, number: prNumber } }),
            });
            const json = await response.json();
            if (json.errors && json.errors.length > 0) {
                throw new Error(json.errors.map((e) => e.message).join('\n'));
            }
            const pr = json.data?.repository?.pullRequest;
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
                    if (rule.type === 'REQUIRED_STATUS_CHECKS' && rule.parameters?.requiredStatusChecks) {
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
                body: JSON.stringify({ query, variables: { owner, repo, number: issueNumber } }),
            });
            const json = await response.json();
            if (json.errors && json.errors.length > 0) {
                throw new Error(json.errors.map((e) => e.message).join('\n'));
            }
            const nodes = json.data?.repository?.issue?.timelineItems?.nodes ?? [];
            const openPrUrls = nodes
                .filter((node) => node.source?.url && node.source?.state === 'OPEN' && node.source.url.includes('/pull/'))
                .map((node) => node.source.url);
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