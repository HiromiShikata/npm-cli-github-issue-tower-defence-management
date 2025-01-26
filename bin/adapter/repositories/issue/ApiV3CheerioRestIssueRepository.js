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
    constructor(apiV3IssueRepository, cheerioIssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, localStorageRepository, jsonFilePath = './tmp/github.com.cookies.json', ghToken = process.env.GH_TOKEN || 'dummy', ghUserName = process.env.GH_USER_NAME, ghUserPassword = process.env.GH_USER_PASSWORD, ghAuthenticatorKey = process.env
        .GH_AUTHENTICATOR_KEY) {
        super(localStorageRepository, jsonFilePath, ghToken, ghUserName, ghUserPassword, ghAuthenticatorKey);
        this.apiV3IssueRepository = apiV3IssueRepository;
        this.cheerioIssueRepository = cheerioIssueRepository;
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
        this.convertProjectItemAndCheerioIssueToIssue = async (item, cheerioIssue) => {
            const timeline = cheerioIssue.inProgressTimeline;
            const nextActionDate = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'nextactiondate')?.value;
            const nextActionHour = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'nextactionhour')?.value;
            const estimationMinutes = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'estimationminutes')?.value;
            const dependedIssueUrls = item.customFields
                .find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith('dependedissueurls'))
                ?.value?.split(',') || [];
            const completionDate50PercentConfidence = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith('completiondate50'))?.value;
            const story = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'story')?.value;
            const status = item.customFields.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'status')?.value;
            const { owner, repo } = this.extractIssueFromUrl(item.url);
            const restIssueData = await this.restIssueRepository.getIssue(item.url);
            return {
                nameWithOwner: item.nameWithOwner,
                url: item.url,
                title: item.title,
                number: item.number,
                state: item.state,
                labels: cheerioIssue.labels,
                assignees: cheerioIssue.assignees,
                workingTimeline: timeline,
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
                isInProgress: (0, utils_1.normalizeFieldName)(cheerioIssue.status).includes('progress'),
                isClosed: item.state !== 'OPEN',
                createdAt: new Date(restIssueData.created_at || '2000-01-01'),
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
                        const workingTimeline = !('workingTimeline' in issue) ||
                            !Array.isArray(issue.workingTimeline)
                            ? []
                            : issue.workingTimeline.map((event) => {
                                const startedAt = !('startedAt' in event) ||
                                    typeof event.startedAt !== 'string' ||
                                    event.startedAt === null
                                    ? null
                                    : new Date(event.startedAt);
                                const endedAt = !('endedAt' in event) ||
                                    typeof event.endedAt !== 'string' ||
                                    event.endedAt === null
                                    ? null
                                    : new Date(event.endedAt);
                                return {
                                    ...event,
                                    startedAt,
                                    endedAt,
                                };
                            });
                        const completionDate50PercentConfidence = !('completionDate50PercentConfidence' in issue) ||
                            typeof issue.completionDate50PercentConfidence !== 'string'
                            ? null
                            : new Date(issue.completionDate50PercentConfidence);
                        const createdAt = !('createdAt' in issue) || typeof issue.createdAt !== 'string'
                            ? new Date() // Fallback to current date if missing
                            : new Date(issue.createdAt);
                        return {
                            ...issue,
                            nextActionDate: nextActionDate,
                            workingTimeline: workingTimeline,
                            completionDate50PercentConfidence: completionDate50PercentConfidence,
                            createdAt: createdAt,
                        };
                    });
                    if ((() => { const $io0 = input => "string" === typeof input.nameWithOwner && "number" === typeof input.number && "string" === typeof input.title && ("OPEN" === input.state || "CLOSED" === input.state || "MERGED" === input.state) && (null === input.status || "string" === typeof input.status) && (null === input.story || "string" === typeof input.story) && (null === input.nextActionDate || input.nextActionDate instanceof Date) && (null === input.nextActionHour || "number" === typeof input.nextActionHour) && (null === input.estimationMinutes || "number" === typeof input.estimationMinutes) && (Array.isArray(input.dependedIssueUrls) && input.dependedIssueUrls.every(elem => "string" === typeof elem)) && (null === input.completionDate50PercentConfidence || input.completionDate50PercentConfidence instanceof Date) && "string" === typeof input.url && (Array.isArray(input.assignees) && input.assignees.every(elem => "string" === typeof elem)) && (Array.isArray(input.workingTimeline) && input.workingTimeline.every(elem => "object" === typeof elem && null !== elem && $io1(elem))) && (Array.isArray(input.labels) && input.labels.every(elem => "string" === typeof elem)) && "string" === typeof input.org && "string" === typeof input.repo && "string" === typeof input.body && "string" === typeof input.itemId && "boolean" === typeof input.isPr && "boolean" === typeof input.isInProgress && "boolean" === typeof input.isClosed && input.createdAt instanceof Date; const $io1 = input => "string" === typeof input.author && input.startedAt instanceof Date && input.endedAt instanceof Date && "number" === typeof input.durationMinutes; return input => Array.isArray(input) && input.every(elem => "object" === typeof elem && null !== elem && $io0(elem)); })()(issues)) {
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
            const processItemsInBatches = async (items, batchSize) => {
                let result = [];
                await this.cheerioIssueRepository.refreshCookie();
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize);
                    const issues = await Promise.all(batch.map(async (item) => {
                        const cheerioIssue = await this.cheerioIssueRepository.getIssue(item.url);
                        return this.convertProjectItemAndCheerioIssueToIssue(item, cheerioIssue);
                    }));
                    result = result.concat(issues);
                }
                return result;
            };
            const issues = await processItemsInBatches(items, 15);
            // const issues = await Promise.all(
            //   items.map(async (item): Promise<Issue> => {
            //     const cheerioIssue = await this.cheerioIssueRepository.getIssue(
            //       item.url,
            //     );
            //     return this.convertProjectItemAndCheerioIssueToIssue(
            //       item,
            //       cheerioIssue,
            //     );
            //   }),
            // );
            // const issues: Issue[] = [];
            // for (const item of items) {
            //   const cheerioIssue = await this.cheerioIssueRepository.getIssue(item.url);
            //   issues.push(
            //     await this.convertProjectItemAndCheerioIssueToIssue(item, cheerioIssue),
            //   );
            // }
            return issues;
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
            const cheerioIssue = await this.cheerioIssueRepository.getIssue(url);
            return this.convertProjectItemAndCheerioIssueToIssue(projectItem, cheerioIssue);
        };
        this.updateNextActionDate = async (project, issue, date) => {
            if (project.nextActionDate === null) {
                throw new Error('nextActionDate is not defined');
            }
            return this.graphqlProjectItemRepository.updateProjectField(project.id, project.nextActionDate.fieldId, issue.itemId, { date: date.toISOString() });
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
    }
}
exports.ApiV3CheerioRestIssueRepository = ApiV3CheerioRestIssueRepository;
//# sourceMappingURL=ApiV3CheerioRestIssueRepository.js.map