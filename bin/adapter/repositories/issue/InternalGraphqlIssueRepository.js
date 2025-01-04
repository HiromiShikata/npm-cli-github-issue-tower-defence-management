"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalGraphqlIssueRepository = void 0;
const axios_1 = __importDefault(require("axios"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
const typia_1 = __importDefault(require("typia"));
const issueTimelineUtils_1 = require("./issueTimelineUtils");
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
                for (let i = 0; i < 3; i++) {
                    try {
                        const response = await axios_1.default.get(url, {
                            headers: headers,
                            withCredentials: true,
                        });
                        if (!response.data?.data?.node?.frontTimelineItems) {
                            throw new Error(`No frontTimelineItems found. URL: ${issueUrl}, Response: ${JSON.stringify(response.data)}`);
                        }
                        return response.data.data.node.frontTimelineItems;
                    }
                    catch (e) {
                        if (i === 2) {
                            throw e;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 5000));
                    }
                }
                throw new Error('Unreachable');
            };
            const frontTimelineItems = [];
            let nextCursor = cursor;
            let remainingCount = maxCount;
            while (frontTimelineItems.length < maxCount) {
                const response = await callQuery(query, remainingCount, nextCursor, issueId);
                frontTimelineItems.push(...response.edges);
                if (response.totalCount < remainingCount) {
                    remainingCount = response.totalCount;
                }
                remainingCount -= response.edges.length;
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
            if (!(() => { const $io0 = input => "object" === typeof input.payload && null !== input.payload && $io1(input.payload); const $io1 = input => Array.isArray(input.preloadedQueries) && (input.preloadedQueries.length === 1 && ("object" === typeof input.preloadedQueries[0] && null !== input.preloadedQueries[0] && $io2(input.preloadedQueries[0]))); const $io2 = input => "object" === typeof input.variables && null !== input.variables && $io3(input.variables) && ("object" === typeof input.result && null !== input.result && $io4(input.result)); const $io3 = input => "string" === typeof input.owner && "string" === typeof input.repo && "number" === typeof input.number; const $io4 = input => "object" === typeof input.data && null !== input.data && $io5(input.data); const $io5 = input => "object" === typeof input.repository && null !== input.repository && $io6(input.repository); const $io6 = input => "object" === typeof input.issue && null !== input.issue && $io7(input.issue); const $io7 = input => "string" === typeof input.id && "string" === typeof input.title && "string" === typeof input.state && ("object" === typeof input.assignees && null !== input.assignees && $io8(input.assignees)) && ("object" === typeof input.labels && null !== input.labels && $io10(input.labels)) && ("object" === typeof input.projectItemsNext && null !== input.projectItemsNext && $io13(input.projectItemsNext)) && ("object" === typeof input.frontTimelineItems && null !== input.frontTimelineItems && $io17(input.frontTimelineItems)) && ("object" === typeof input.backTimelineItems && null !== input.backTimelineItems && $io21(input.backTimelineItems)); const $io8 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && $io9(elem)); const $io9 = input => "string" === typeof input.login; const $io10 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && $io11(elem)); const $io11 = input => "object" === typeof input.node && null !== input.node && $io12(input.node); const $io12 = input => "string" === typeof input.name; const $io13 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && $io14(elem)); const $io14 = input => "object" === typeof input.node && null !== input.node && $io15(input.node); const $io15 = input => "object" === typeof input.project && null !== input.project && $io16(input.project); const $io16 = input => "string" === typeof input.title; const $io17 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && $io18(elem)) && ("object" === typeof input.pageInfo && null !== input.pageInfo && $io20(input.pageInfo)) && "number" === typeof input.totalCount; const $io18 = input => "object" === typeof input.node && null !== input.node && $io19(input.node); const $io19 = input => "string" === typeof input.__typename && "string" === typeof input.id; const $io20 = input => "boolean" === typeof input.hasNextPage && "string" === typeof input.endCursor; const $io21 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && $io22(elem)); const $io22 = input => "object" === typeof input.node && null !== input.node && $io23(input.node); const $io23 = input => "string" === typeof input.__typename && "string" === typeof input.id; return input => "object" === typeof input && null !== input && $io0(input); })()(data)) {
                throw new Error(`Invalid data: ${JSON.stringify(data)}`);
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
                .filter((edge, index, self) => self.findIndex((t) => t.node.id === edge.node.id) === index)
                .filter((edge) => edge.node.__typename === 'ProjectV2ItemStatusChangedEvent')
                .map((edge) => ({
                time: edge.node.createdAt,
                author: edge.node.actor?.login || '',
                from: edge.node.previousStatus,
                to: edge.node.status,
            }));
            const inProgressTimeline = await (0, issueTimelineUtils_1.getInProgressTimeline)(statusTimeline, issueUrl);
            return {
                url: issueUrl,
                title: issueData.title,
                status: statusTimeline.length > 0
                    ? statusTimeline[statusTimeline.length - 1].to
                    : '',
                assignees: issueData.assignees.nodes.map((node) => node.login),
                labels: issueData.labels.edges.map((edge) => edge.node.name),
                project: issueData.projectItemsNext.edges[0].node.project.title,
                statusTimeline,
                inProgressTimeline,
            };
        };
    }
}
exports.InternalGraphqlIssueRepository = InternalGraphqlIssueRepository;
//# sourceMappingURL=InternalGraphqlIssueRepository.js.map