"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalGraphqlIssueRepository = void 0;
const ky_1 = __importDefault(require("ky"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
const typia_1 = __importDefault(require("typia"));
class InternalGraphqlIssueRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.getFrontTimelineItems = async (issueUrl, cursor, issueId, maxCount = 9999) => {
            const query = 'f6ff036f8e215bd07d00516664e8725c';
            const callQuery = async (query, count, cursor, issueId) => {
                const requestBody = {
                    query: query,
                    variables: {
                        cursor: cursor || '',
                        count: count,
                        id: issueId,
                    },
                };
                const bodyParam = encodeURIComponent(JSON.stringify(requestBody));
                const url = `https://github.com/_graphql?body=${bodyParam}`;
                const headers = {
                    accept: '*/*',
                    'accept-language': 'en-US,en;q=0.9,ja;q=0.8',
                    'cache-Control': 'no-cache',
                    referer: issueUrl,
                    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Linux"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'x-requested-with': 'XMLHttpRequest',
                    cookie: await this.getCookie(),
                };
                const maxRetries = 10;
                const getRetryDelay = (attempt) => {
                    const baseDelay = 5000;
                    return baseDelay * Math.pow(2, attempt);
                };
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        console.log(url);
                        const kyResponse = await ky_1.default.get(url, {
                            headers: headers,
                            throwHttpErrors: false,
                        });
                        if (!kyResponse.ok) {
                            throw new Error(`HTTP error ${kyResponse.status}`);
                        }
                        const rawResponse = await kyResponse.json();
                        if (!rawResponse?.data?.node?.frontTimelineItems) {
                            throw new Error(`No frontTimelineItems found. URL: ${issueUrl}, Response: ${JSON.stringify(rawResponse)}`);
                        }
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                        return rawResponse.data.node.frontTimelineItems;
                    }
                    catch (e) {
                        const statusCode = e instanceof Error && e.message.startsWith('HTTP error ')
                            ? parseInt(e.message.replace('HTTP error ', ''), 10)
                            : null;
                        const isRetryableError = statusCode !== null && [500, 502, 503, 504].includes(statusCode);
                        if (i === maxRetries - 1) {
                            throw e;
                        }
                        const delay = getRetryDelay(i);
                        console.log(`Request failed (attempt ${i + 1}/${maxRetries}). ${isRetryableError ? `Status: ${statusCode}. ` : ''}Retrying in ${delay / 1000}s...`);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
                throw new Error('Unreachable');
            };
            const frontTimelineItems = [];
            let nextCursor = cursor;
            const maxCountPerRequest = 250;
            while (frontTimelineItems.length < maxCount) {
                const response = await callQuery(query, maxCountPerRequest, nextCursor, issueId);
                for (const edge of response.edges) {
                    frontTimelineItems.push(edge);
                    if (frontTimelineItems.length >= maxCount) {
                        return frontTimelineItems;
                    }
                }
                nextCursor = response.pageInfo.endCursor;
                if (!response.pageInfo.hasNextPage) {
                    break;
                }
            }
            return frontTimelineItems;
        };
        this.getIssueFromBetaFeatureView = async (issueUrl, html) => {
            const pattern = /<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/;
            const match = html.match(pattern);
            if (!match || !match[1]) {
                throw new Error(`No script content found. URL: ${issueUrl}, HTML: ${html}`);
            }
            const scriptContent = match[1];
            if (!scriptContent) {
                throw new Error('No script content found');
            }
            const data = JSON.parse(scriptContent);
            const isValidStructure = (d) => {
                return (typeof d === 'object' &&
                    d !== null &&
                    'payload' in d &&
                    typeof d.payload === 'object' &&
                    d.payload !== null &&
                    'preloadedQueries' in d.payload &&
                    Array.isArray(d.payload.preloadedQueries) &&
                    d.payload.preloadedQueries.length > 0);
            };
            if (!typia_1.default.is(data)) {
                if (!isValidStructure(data)) {
                    const validateResult = typia_1.default.validate(data);
                    throw new Error(`Invalid data: validateResult: ${JSON.stringify(validateResult)}, data: ${JSON.stringify(data)}`);
                }
            }
            if (!isValidStructure(data)) {
                throw new Error('Data structure validation failed');
            }
            const issueData = data.payload.preloadedQueries[0].result.data.repository.issue;
            const issueRemainingCount = issueData.frontTimelineItems.totalCount -
                issueData.frontTimelineItems.edges.length -
                issueData.backTimelineItems.edges.length;
            const loadedMoreIssues = issueUrl.includes('/pull/')
                ? []
                : await this.getFrontTimelineItems(issueUrl, issueData.frontTimelineItems.pageInfo.endCursor, issueData.id, issueRemainingCount);
            const statusTimeline = issueData.frontTimelineItems.edges
                .concat(loadedMoreIssues)
                .concat(issueData.backTimelineItems.edges)
                .filter((edge, index, self) => self.findIndex((t) => !!t.node && !!edge.node && t.node.id === edge.node.id) === index)
                .filter((edge) => !!edge.node &&
                edge.node.__typename === 'ProjectV2ItemStatusChangedEvent')
                .map((edge) => ({
                time: edge.node.createdAt,
                author: edge.node.actor?.login || '',
                from: edge.node.previousStatus || '',
                to: edge.node.status || '',
            }));
            return {
                url: issueUrl,
                title: issueData.title,
                status: statusTimeline.length > 0
                    ? statusTimeline[statusTimeline.length - 1].to
                    : '',
                assignees: issueData.assignedActors.nodes.map((node) => node.login),
                labels: issueData.labels.edges.map((edge) => edge.node.name),
                project: issueData.projectItemsNext?.edges[0]?.node.project.title ?? '',
                statusTimeline,
                createdAt: new Date(issueData.createdAt),
            };
        };
    }
}
exports.InternalGraphqlIssueRepository = InternalGraphqlIssueRepository;
//# sourceMappingURL=InternalGraphqlIssueRepository.js.map