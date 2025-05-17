"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalGraphqlIssueRepository = void 0;
const __typia_transform__accessExpressionAsString = __importStar(require("typia/lib/internal/_accessExpressionAsString.js"));
const __typia_transform__validateReport = __importStar(require("typia/lib/internal/_validateReport.js"));
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
            if (!(() => { const _io0 = input => "object" === typeof input.payload && null !== input.payload && _io1(input.payload) && (null === input.title || undefined === input.title) && (undefined === input.appPayload || "object" === typeof input.appPayload && null !== input.appPayload && false === Array.isArray(input.appPayload) && _io50(input.appPayload)); const _io1 = input => (undefined === input.preloaded_records || "object" === typeof input.preloaded_records && null !== input.preloaded_records && false === Array.isArray(input.preloaded_records) && _io2(input.preloaded_records)) && (Array.isArray(input.preloadedQueries) && (input.preloadedQueries.length === 1 && ("object" === typeof input.preloadedQueries[0] && null !== input.preloadedQueries[0] && _io3(input.preloadedQueries[0])))) && (undefined === input.preloadedSubscriptions || "object" === typeof input.preloadedSubscriptions && null !== input.preloadedSubscriptions && false === Array.isArray(input.preloadedSubscriptions) && _io44(input.preloadedSubscriptions)); const _io2 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return true;
            }); const _io3 = input => "string" === typeof input.queryId && "string" === typeof input.queryName && ("object" === typeof input.variables && null !== input.variables && _io4(input.variables)) && ("object" === typeof input.result && null !== input.result && _io5(input.result)) && "number" === typeof input.timestamp; const _io4 = input => "string" === typeof input.id && "number" === typeof input.number && "string" === typeof input.owner && "string" === typeof input.repo; const _io5 = input => "object" === typeof input.data && null !== input.data && _io6(input.data); const _io6 = input => "object" === typeof input.repository && null !== input.repository && _io7(input.repository) && ("object" === typeof input.safeViewer && null !== input.safeViewer && _io43(input.safeViewer)); const _io7 = input => "boolean" === typeof input.isOwnerEnterpriseManaged && ("object" === typeof input.issue && null !== input.issue && _io8(input.issue)) && "string" === typeof input.id; const _io8 = input => "string" === typeof input.id && "string" === typeof input.updatedAt && "string" === typeof input.title && "number" === typeof input.number && ("object" === typeof input.repository && null !== input.repository && _io9(input.repository)) && "string" === typeof input.titleHTML && "string" === typeof input.url && "boolean" === typeof input.viewerCanUpdateNext && (null === input.issueType || "object" === typeof input.issueType && null !== input.issueType && _io16(input.issueType)) && ("OPEN" === input.state || "CLOSED" === input.state) && (null === input.stateReason || "string" === typeof input.stateReason) && ("object" === typeof input.linkedPullRequests && null !== input.linkedPullRequests && _io17(input.linkedPullRequests)) && ("object" === typeof input.subIssuesSummary && null !== input.subIssuesSummary && _io18(input.subIssuesSummary)) && "string" === typeof input.__isLabelable && ("object" === typeof input.labels && null !== input.labels && _io19(input.labels)) && "string" === typeof input.__isNode && "number" === typeof input.databaseId && "boolean" === typeof input.viewerDidAuthor && "boolean" === typeof input.locked && ("object" === typeof input.author && null !== input.author && _io23(input.author)) && "string" === typeof input.__isComment && "string" === typeof input.body && "string" === typeof input.bodyHTML && "string" === typeof input.bodyVersion && "string" === typeof input.createdAt && "string" === typeof input.__isReactable && (Array.isArray(input.reactionGroups) && input.reactionGroups.every(elem => "object" === typeof elem && null !== elem && _io24(elem))) && "boolean" === typeof input.viewerCanUpdateMetadata && "boolean" === typeof input.viewerCanComment && "boolean" === typeof input.viewerCanAssign && "boolean" === typeof input.viewerCanLabel && "string" === typeof input.__isIssueOrPullRequest && ("object" === typeof input.projectItemsNext && null !== input.projectItemsNext && _io26(input.projectItemsNext)) && "boolean" === typeof input.viewerCanSetMilestone && "boolean" === typeof input.isPinned && "boolean" === typeof input.viewerCanDelete && "boolean" === typeof input.viewerCanTransfer && "boolean" === typeof input.viewerCanConvertToDiscussion && "boolean" === typeof input.viewerCanLock && "boolean" === typeof input.viewerCanType && ("object" === typeof input.frontTimelineItems && null !== input.frontTimelineItems && _io34(input.frontTimelineItems)) && ("object" === typeof input.backTimelineItems && null !== input.backTimelineItems && _io38(input.backTimelineItems)) && ("object" === typeof input.assignedActors && null !== input.assignedActors && _io41(input.assignedActors)); const _io9 = input => "string" === typeof input.nameWithOwner && "string" === typeof input.id && "string" === typeof input.name && ("object" === typeof input.owner && null !== input.owner && _io10(input.owner)) && "boolean" === typeof input.isArchived && "boolean" === typeof input.isPrivate && "number" === typeof input.databaseId && "boolean" === typeof input.slashCommandsEnabled && "boolean" === typeof input.viewerCanInteract && "string" === typeof input.viewerInteractionLimitReasonHTML && ("object" === typeof input.planFeatures && null !== input.planFeatures && _io11(input.planFeatures)) && "string" === typeof input.visibility && ("object" === typeof input.pinnedIssues && null !== input.pinnedIssues && _io12(input.pinnedIssues)) && "boolean" === typeof input.viewerCanPinIssues && (null === input.issueTypes || "object" === typeof input.issueTypes && null !== input.issueTypes && _io13(input.issueTypes)); const _io10 = input => ("User" === input.__typename || "Organization" === input.__typename) && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.url; const _io11 = input => "number" === typeof input.maximumAssignees; const _io12 = input => "number" === typeof input.totalCount; const _io13 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io14(elem)); const _io14 = input => "object" === typeof input.node && null !== input.node && _io15(input.node); const _io15 = input => "string" === typeof input.id; const _io16 = input => "string" === typeof input.name && "string" === typeof input.color && "string" === typeof input.id && (undefined === input.isEnabled || "boolean" === typeof input.isEnabled) && (undefined === input.description || "string" === typeof input.description); const _io17 = input => Array.isArray(input.nodes); const _io18 = input => "number" === typeof input.total && "number" === typeof input.completed; const _io19 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io20(elem)) && ("object" === typeof input.pageInfo && null !== input.pageInfo && _io22(input.pageInfo)); const _io20 = input => "object" === typeof input.node && null !== input.node && _io21(input.node) && "string" === typeof input.cursor; const _io21 = input => "string" === typeof input.id && "string" === typeof input.color && "string" === typeof input.name && "string" === typeof input.nameHTML && (null === input.description || "string" === typeof input.description) && "string" === typeof input.url && "string" === typeof input.__typename; const _io22 = input => (null === input.endCursor || "string" === typeof input.endCursor) && "boolean" === typeof input.hasNextPage; const _io23 = input => "string" === typeof input.__typename && "string" === typeof input.__isActor && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.profileUrl && "string" === typeof input.avatarUrl; const _io24 = input => "string" === typeof input.content && "boolean" === typeof input.viewerHasReacted && ("object" === typeof input.reactors && null !== input.reactors && _io25(input.reactors)); const _io25 = input => "number" === typeof input.totalCount && Array.isArray(input.nodes); const _io26 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io27(elem)) && ("object" === typeof input.pageInfo && null !== input.pageInfo && _io33(input.pageInfo)); const _io27 = input => "object" === typeof input.node && null !== input.node && _io28(input.node) && "string" === typeof input.cursor; const _io28 = input => "string" === typeof input.id && "boolean" === typeof input.isArchived && ("object" === typeof input.project && null !== input.project && _io29(input.project)) && ("object" === typeof input.fieldValueByName && null !== input.fieldValueByName && _io32(input.fieldValueByName)) && "string" === typeof input.__typename; const _io29 = input => "string" === typeof input.id && "string" === typeof input.title && "boolean" === typeof input.template && "boolean" === typeof input.viewerCanUpdate && "string" === typeof input.url && ("object" === typeof input.field && null !== input.field && _io30(input.field)) && "boolean" === typeof input.closed && "number" === typeof input.number && "boolean" === typeof input.hasReachedItemsLimit && "string" === typeof input.__typename; const _io30 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.name && (Array.isArray(input.options) && input.options.every(elem => "object" === typeof elem && null !== elem && _io31(elem))) && "string" === typeof input.__isNode; const _io31 = input => "string" === typeof input.id && "string" === typeof input.optionId && "string" === typeof input.name && "string" === typeof input.nameHTML && "string" === typeof input.color && "string" === typeof input.descriptionHTML && "string" === typeof input.description; const _io32 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.optionId && "string" === typeof input.name && "string" === typeof input.nameHTML && "string" === typeof input.color && "string" === typeof input.__isNode; const _io33 = input => "string" === typeof input.endCursor && "boolean" === typeof input.hasNextPage; const _io34 = input => "object" === typeof input.pageInfo && null !== input.pageInfo && _io35(input.pageInfo) && "number" === typeof input.totalCount && (Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io36(elem))); const _io35 = input => "boolean" === typeof input.hasNextPage && "string" === typeof input.endCursor; const _io36 = input => (null === input.node || "object" === typeof input.node && null !== input.node && _io37(input.node)) && "string" === typeof input.cursor; const _io37 = input => "string" === typeof input.id && "string" === typeof input.__typename; const _io38 = input => "object" === typeof input.pageInfo && null !== input.pageInfo && _io39(input.pageInfo) && "number" === typeof input.totalCount && (Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io40(elem))); const _io39 = input => "boolean" === typeof input.hasPreviousPage && (null === input.startCursor || "string" === typeof input.startCursor); const _io40 = input => (null === input.node || "object" === typeof input.node && null !== input.node && _io37(input.node)) && "string" === typeof input.cursor; const _io41 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io42(elem)); const _io42 = input => "string" === typeof input.__typename && "string" === typeof input.__isActor && "string" === typeof input.id && "string" === typeof input.login && (null === input.name || "string" === typeof input.name) && "string" === typeof input.profileResourcePath && "string" === typeof input.avatarUrl && "string" === typeof input.__isNode; const _io43 = input => "boolean" === typeof input.isEnterpriseManagedUser && (undefined !== input.enterpriseManagedEnterpriseId && null === input.enterpriseManagedEnterpriseId) && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.avatarUrl && "string" === typeof input.__isActor && "string" === typeof input.__typename && (null === input.name || "string" === typeof input.name) && "string" === typeof input.profileResourcePath; const _io44 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return "object" === typeof value && null !== value && false === Array.isArray(value) && _io45(value);
            }); const _io45 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return "object" === typeof value && null !== value && _io46(value);
            }); const _io46 = input => "object" === typeof input.response && null !== input.response && _io47(input.response) && "string" === typeof input.subscriptionId; const _io47 = input => "object" === typeof input.data && null !== input.data && _io48(input.data); const _io48 = input => "object" === typeof input.issueUpdated && null !== input.issueUpdated && _io49(input.issueUpdated); const _io49 = input => undefined !== input.deletedCommentId && null === input.deletedCommentId && (undefined !== input.issueBodyUpdated && null === input.issueBodyUpdated) && (undefined !== input.issueMetadataUpdated && null === input.issueMetadataUpdated) && (undefined !== input.issueStateUpdated && null === input.issueStateUpdated) && (undefined !== input.issueTimelineUpdated && null === input.issueTimelineUpdated) && (undefined !== input.issueTitleUpdated && null === input.issueTitleUpdated) && (undefined !== input.issueReactionUpdated && null === input.issueReactionUpdated) && (undefined !== input.issueTransferStateUpdated && null === input.issueTransferStateUpdated) && (undefined !== input.issueTypeUpdated && null === input.issueTypeUpdated) && (undefined !== input.commentReactionUpdated && null === input.commentReactionUpdated) && (undefined !== input.commentUpdated && null === input.commentUpdated) && (undefined !== input.subIssuesUpdated && null === input.subIssuesUpdated) && (undefined !== input.subIssuesSummaryUpdated && null === input.subIssuesSummaryUpdated) && (undefined !== input.parentIssueUpdated && null === input.parentIssueUpdated) && (undefined !== input.issueDependenciesSummaryUpdated && null === input.issueDependenciesSummaryUpdated); const _io50 = input => (undefined === input.initial_view_content || "object" === typeof input.initial_view_content && null !== input.initial_view_content && _io51(input.initial_view_content)) && (undefined === input.current_user || "object" === typeof input.current_user && null !== input.current_user && _io52(input.current_user)) && (undefined === input.current_user_settings || "object" === typeof input.current_user_settings && null !== input.current_user_settings && _io53(input.current_user_settings)) && (undefined === input.paste_url_link_as_plain_text || "boolean" === typeof input.paste_url_link_as_plain_text) && (undefined === input.base_avatar_url || "string" === typeof input.base_avatar_url) && (undefined === input.help_url || "string" === typeof input.help_url) && (null === input.sso_organizations || undefined === input.sso_organizations) && (undefined === input.multi_tenant || "boolean" === typeof input.multi_tenant) && (undefined === input.tracing || "boolean" === typeof input.tracing) && (undefined === input.tracing_flamegraph || "boolean" === typeof input.tracing_flamegraph) && (undefined === input.catalog_service || "string" === typeof input.catalog_service) && (undefined === input.scoped_repository || "object" === typeof input.scoped_repository && null !== input.scoped_repository && _io54(input.scoped_repository)) && (null === input.copilot_api_url || undefined === input.copilot_api_url) && (undefined === input.enabled_features || "object" === typeof input.enabled_features && null !== input.enabled_features && false === Array.isArray(input.enabled_features) && _io55(input.enabled_features)); const _io51 = input => undefined !== input.team_id && null === input.team_id && "boolean" === typeof input.can_edit_view; const _io52 = input => "string" === typeof input.id && "string" === typeof input.login && "string" === typeof input.avatarUrl && "boolean" === typeof input.is_staff && "boolean" === typeof input.is_emu; const _io53 = input => "boolean" === typeof input.use_monospace_font && "boolean" === typeof input.use_single_key_shortcut && "number" === typeof input.preferred_emoji_skin_tone; const _io54 = input => "string" === typeof input.id && "string" === typeof input.owner && "string" === typeof input.name && "boolean" === typeof input.is_archived; const _io55 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return "boolean" === typeof value;
            }); return input => "object" === typeof input && null !== input && _io0(input); })()(data)) {
                const validateResult = (() => { const _io0 = input => "object" === typeof input.payload && null !== input.payload && _io1(input.payload) && (null === input.title || undefined === input.title) && (undefined === input.appPayload || "object" === typeof input.appPayload && null !== input.appPayload && false === Array.isArray(input.appPayload) && _io50(input.appPayload)); const _io1 = input => (undefined === input.preloaded_records || "object" === typeof input.preloaded_records && null !== input.preloaded_records && false === Array.isArray(input.preloaded_records) && _io2(input.preloaded_records)) && (Array.isArray(input.preloadedQueries) && (input.preloadedQueries.length === 1 && ("object" === typeof input.preloadedQueries[0] && null !== input.preloadedQueries[0] && _io3(input.preloadedQueries[0])))) && (undefined === input.preloadedSubscriptions || "object" === typeof input.preloadedSubscriptions && null !== input.preloadedSubscriptions && false === Array.isArray(input.preloadedSubscriptions) && _io44(input.preloadedSubscriptions)); const _io2 = input => Object.keys(input).every(key => {
                    const value = input[key];
                    if (undefined === value)
                        return true;
                    return true;
                }); const _io3 = input => "string" === typeof input.queryId && "string" === typeof input.queryName && ("object" === typeof input.variables && null !== input.variables && _io4(input.variables)) && ("object" === typeof input.result && null !== input.result && _io5(input.result)) && "number" === typeof input.timestamp; const _io4 = input => "string" === typeof input.id && "number" === typeof input.number && "string" === typeof input.owner && "string" === typeof input.repo; const _io5 = input => "object" === typeof input.data && null !== input.data && _io6(input.data); const _io6 = input => "object" === typeof input.repository && null !== input.repository && _io7(input.repository) && ("object" === typeof input.safeViewer && null !== input.safeViewer && _io43(input.safeViewer)); const _io7 = input => "boolean" === typeof input.isOwnerEnterpriseManaged && ("object" === typeof input.issue && null !== input.issue && _io8(input.issue)) && "string" === typeof input.id; const _io8 = input => "string" === typeof input.id && "string" === typeof input.updatedAt && "string" === typeof input.title && "number" === typeof input.number && ("object" === typeof input.repository && null !== input.repository && _io9(input.repository)) && "string" === typeof input.titleHTML && "string" === typeof input.url && "boolean" === typeof input.viewerCanUpdateNext && (null === input.issueType || "object" === typeof input.issueType && null !== input.issueType && _io16(input.issueType)) && ("OPEN" === input.state || "CLOSED" === input.state) && (null === input.stateReason || "string" === typeof input.stateReason) && ("object" === typeof input.linkedPullRequests && null !== input.linkedPullRequests && _io17(input.linkedPullRequests)) && ("object" === typeof input.subIssuesSummary && null !== input.subIssuesSummary && _io18(input.subIssuesSummary)) && "string" === typeof input.__isLabelable && ("object" === typeof input.labels && null !== input.labels && _io19(input.labels)) && "string" === typeof input.__isNode && "number" === typeof input.databaseId && "boolean" === typeof input.viewerDidAuthor && "boolean" === typeof input.locked && ("object" === typeof input.author && null !== input.author && _io23(input.author)) && "string" === typeof input.__isComment && "string" === typeof input.body && "string" === typeof input.bodyHTML && "string" === typeof input.bodyVersion && "string" === typeof input.createdAt && "string" === typeof input.__isReactable && (Array.isArray(input.reactionGroups) && input.reactionGroups.every(elem => "object" === typeof elem && null !== elem && _io24(elem))) && "boolean" === typeof input.viewerCanUpdateMetadata && "boolean" === typeof input.viewerCanComment && "boolean" === typeof input.viewerCanAssign && "boolean" === typeof input.viewerCanLabel && "string" === typeof input.__isIssueOrPullRequest && ("object" === typeof input.projectItemsNext && null !== input.projectItemsNext && _io26(input.projectItemsNext)) && "boolean" === typeof input.viewerCanSetMilestone && "boolean" === typeof input.isPinned && "boolean" === typeof input.viewerCanDelete && "boolean" === typeof input.viewerCanTransfer && "boolean" === typeof input.viewerCanConvertToDiscussion && "boolean" === typeof input.viewerCanLock && "boolean" === typeof input.viewerCanType && ("object" === typeof input.frontTimelineItems && null !== input.frontTimelineItems && _io34(input.frontTimelineItems)) && ("object" === typeof input.backTimelineItems && null !== input.backTimelineItems && _io38(input.backTimelineItems)) && ("object" === typeof input.assignedActors && null !== input.assignedActors && _io41(input.assignedActors)); const _io9 = input => "string" === typeof input.nameWithOwner && "string" === typeof input.id && "string" === typeof input.name && ("object" === typeof input.owner && null !== input.owner && _io10(input.owner)) && "boolean" === typeof input.isArchived && "boolean" === typeof input.isPrivate && "number" === typeof input.databaseId && "boolean" === typeof input.slashCommandsEnabled && "boolean" === typeof input.viewerCanInteract && "string" === typeof input.viewerInteractionLimitReasonHTML && ("object" === typeof input.planFeatures && null !== input.planFeatures && _io11(input.planFeatures)) && "string" === typeof input.visibility && ("object" === typeof input.pinnedIssues && null !== input.pinnedIssues && _io12(input.pinnedIssues)) && "boolean" === typeof input.viewerCanPinIssues && (null === input.issueTypes || "object" === typeof input.issueTypes && null !== input.issueTypes && _io13(input.issueTypes)); const _io10 = input => ("User" === input.__typename || "Organization" === input.__typename) && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.url; const _io11 = input => "number" === typeof input.maximumAssignees; const _io12 = input => "number" === typeof input.totalCount; const _io13 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io14(elem)); const _io14 = input => "object" === typeof input.node && null !== input.node && _io15(input.node); const _io15 = input => "string" === typeof input.id; const _io16 = input => "string" === typeof input.name && "string" === typeof input.color && "string" === typeof input.id && (undefined === input.isEnabled || "boolean" === typeof input.isEnabled) && (undefined === input.description || "string" === typeof input.description); const _io17 = input => Array.isArray(input.nodes); const _io18 = input => "number" === typeof input.total && "number" === typeof input.completed; const _io19 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io20(elem)) && ("object" === typeof input.pageInfo && null !== input.pageInfo && _io22(input.pageInfo)); const _io20 = input => "object" === typeof input.node && null !== input.node && _io21(input.node) && "string" === typeof input.cursor; const _io21 = input => "string" === typeof input.id && "string" === typeof input.color && "string" === typeof input.name && "string" === typeof input.nameHTML && (null === input.description || "string" === typeof input.description) && "string" === typeof input.url && "string" === typeof input.__typename; const _io22 = input => (null === input.endCursor || "string" === typeof input.endCursor) && "boolean" === typeof input.hasNextPage; const _io23 = input => "string" === typeof input.__typename && "string" === typeof input.__isActor && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.profileUrl && "string" === typeof input.avatarUrl; const _io24 = input => "string" === typeof input.content && "boolean" === typeof input.viewerHasReacted && ("object" === typeof input.reactors && null !== input.reactors && _io25(input.reactors)); const _io25 = input => "number" === typeof input.totalCount && Array.isArray(input.nodes); const _io26 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io27(elem)) && ("object" === typeof input.pageInfo && null !== input.pageInfo && _io33(input.pageInfo)); const _io27 = input => "object" === typeof input.node && null !== input.node && _io28(input.node) && "string" === typeof input.cursor; const _io28 = input => "string" === typeof input.id && "boolean" === typeof input.isArchived && ("object" === typeof input.project && null !== input.project && _io29(input.project)) && ("object" === typeof input.fieldValueByName && null !== input.fieldValueByName && _io32(input.fieldValueByName)) && "string" === typeof input.__typename; const _io29 = input => "string" === typeof input.id && "string" === typeof input.title && "boolean" === typeof input.template && "boolean" === typeof input.viewerCanUpdate && "string" === typeof input.url && ("object" === typeof input.field && null !== input.field && _io30(input.field)) && "boolean" === typeof input.closed && "number" === typeof input.number && "boolean" === typeof input.hasReachedItemsLimit && "string" === typeof input.__typename; const _io30 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.name && (Array.isArray(input.options) && input.options.every(elem => "object" === typeof elem && null !== elem && _io31(elem))) && "string" === typeof input.__isNode; const _io31 = input => "string" === typeof input.id && "string" === typeof input.optionId && "string" === typeof input.name && "string" === typeof input.nameHTML && "string" === typeof input.color && "string" === typeof input.descriptionHTML && "string" === typeof input.description; const _io32 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.optionId && "string" === typeof input.name && "string" === typeof input.nameHTML && "string" === typeof input.color && "string" === typeof input.__isNode; const _io33 = input => "string" === typeof input.endCursor && "boolean" === typeof input.hasNextPage; const _io34 = input => "object" === typeof input.pageInfo && null !== input.pageInfo && _io35(input.pageInfo) && "number" === typeof input.totalCount && (Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io36(elem))); const _io35 = input => "boolean" === typeof input.hasNextPage && "string" === typeof input.endCursor; const _io36 = input => (null === input.node || "object" === typeof input.node && null !== input.node && _io37(input.node)) && "string" === typeof input.cursor; const _io37 = input => "string" === typeof input.id && "string" === typeof input.__typename; const _io38 = input => "object" === typeof input.pageInfo && null !== input.pageInfo && _io39(input.pageInfo) && "number" === typeof input.totalCount && (Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io40(elem))); const _io39 = input => "boolean" === typeof input.hasPreviousPage && (null === input.startCursor || "string" === typeof input.startCursor); const _io40 = input => (null === input.node || "object" === typeof input.node && null !== input.node && _io37(input.node)) && "string" === typeof input.cursor; const _io41 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io42(elem)); const _io42 = input => "string" === typeof input.__typename && "string" === typeof input.__isActor && "string" === typeof input.id && "string" === typeof input.login && (null === input.name || "string" === typeof input.name) && "string" === typeof input.profileResourcePath && "string" === typeof input.avatarUrl && "string" === typeof input.__isNode; const _io43 = input => "boolean" === typeof input.isEnterpriseManagedUser && (undefined !== input.enterpriseManagedEnterpriseId && null === input.enterpriseManagedEnterpriseId) && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.avatarUrl && "string" === typeof input.__isActor && "string" === typeof input.__typename && (null === input.name || "string" === typeof input.name) && "string" === typeof input.profileResourcePath; const _io44 = input => Object.keys(input).every(key => {
                    const value = input[key];
                    if (undefined === value)
                        return true;
                    return "object" === typeof value && null !== value && false === Array.isArray(value) && _io45(value);
                }); const _io45 = input => Object.keys(input).every(key => {
                    const value = input[key];
                    if (undefined === value)
                        return true;
                    return "object" === typeof value && null !== value && _io46(value);
                }); const _io46 = input => "object" === typeof input.response && null !== input.response && _io47(input.response) && "string" === typeof input.subscriptionId; const _io47 = input => "object" === typeof input.data && null !== input.data && _io48(input.data); const _io48 = input => "object" === typeof input.issueUpdated && null !== input.issueUpdated && _io49(input.issueUpdated); const _io49 = input => undefined !== input.deletedCommentId && null === input.deletedCommentId && (undefined !== input.issueBodyUpdated && null === input.issueBodyUpdated) && (undefined !== input.issueMetadataUpdated && null === input.issueMetadataUpdated) && (undefined !== input.issueStateUpdated && null === input.issueStateUpdated) && (undefined !== input.issueTimelineUpdated && null === input.issueTimelineUpdated) && (undefined !== input.issueTitleUpdated && null === input.issueTitleUpdated) && (undefined !== input.issueReactionUpdated && null === input.issueReactionUpdated) && (undefined !== input.issueTransferStateUpdated && null === input.issueTransferStateUpdated) && (undefined !== input.issueTypeUpdated && null === input.issueTypeUpdated) && (undefined !== input.commentReactionUpdated && null === input.commentReactionUpdated) && (undefined !== input.commentUpdated && null === input.commentUpdated) && (undefined !== input.subIssuesUpdated && null === input.subIssuesUpdated) && (undefined !== input.subIssuesSummaryUpdated && null === input.subIssuesSummaryUpdated) && (undefined !== input.parentIssueUpdated && null === input.parentIssueUpdated) && (undefined !== input.issueDependenciesSummaryUpdated && null === input.issueDependenciesSummaryUpdated); const _io50 = input => (undefined === input.initial_view_content || "object" === typeof input.initial_view_content && null !== input.initial_view_content && _io51(input.initial_view_content)) && (undefined === input.current_user || "object" === typeof input.current_user && null !== input.current_user && _io52(input.current_user)) && (undefined === input.current_user_settings || "object" === typeof input.current_user_settings && null !== input.current_user_settings && _io53(input.current_user_settings)) && (undefined === input.paste_url_link_as_plain_text || "boolean" === typeof input.paste_url_link_as_plain_text) && (undefined === input.base_avatar_url || "string" === typeof input.base_avatar_url) && (undefined === input.help_url || "string" === typeof input.help_url) && (null === input.sso_organizations || undefined === input.sso_organizations) && (undefined === input.multi_tenant || "boolean" === typeof input.multi_tenant) && (undefined === input.tracing || "boolean" === typeof input.tracing) && (undefined === input.tracing_flamegraph || "boolean" === typeof input.tracing_flamegraph) && (undefined === input.catalog_service || "string" === typeof input.catalog_service) && (undefined === input.scoped_repository || "object" === typeof input.scoped_repository && null !== input.scoped_repository && _io54(input.scoped_repository)) && (null === input.copilot_api_url || undefined === input.copilot_api_url) && (undefined === input.enabled_features || "object" === typeof input.enabled_features && null !== input.enabled_features && false === Array.isArray(input.enabled_features) && _io55(input.enabled_features)); const _io51 = input => undefined !== input.team_id && null === input.team_id && "boolean" === typeof input.can_edit_view; const _io52 = input => "string" === typeof input.id && "string" === typeof input.login && "string" === typeof input.avatarUrl && "boolean" === typeof input.is_staff && "boolean" === typeof input.is_emu; const _io53 = input => "boolean" === typeof input.use_monospace_font && "boolean" === typeof input.use_single_key_shortcut && "number" === typeof input.preferred_emoji_skin_tone; const _io54 = input => "string" === typeof input.id && "string" === typeof input.owner && "string" === typeof input.name && "boolean" === typeof input.is_archived; const _io55 = input => Object.keys(input).every(key => {
                    const value = input[key];
                    if (undefined === value)
                        return true;
                    return "boolean" === typeof value;
                }); const _vo0 = (input, _path, _exceptionable = true) => [("object" === typeof input.payload && null !== input.payload || _report(_exceptionable, {
                        path: _path + ".payload",
                        expected: "__type",
                        value: input.payload
                    })) && _vo1(input.payload, _path + ".payload", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".payload",
                        expected: "__type",
                        value: input.payload
                    }), null === input.title || undefined === input.title || _report(_exceptionable, {
                        path: _path + ".title",
                        expected: "(null | undefined)",
                        value: input.title
                    }), undefined === input.appPayload || ("object" === typeof input.appPayload && null !== input.appPayload && false === Array.isArray(input.appPayload) || _report(_exceptionable, {
                        path: _path + ".appPayload",
                        expected: "(__type.o40 | undefined)",
                        value: input.appPayload
                    })) && _vo50(input.appPayload, _path + ".appPayload", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".appPayload",
                        expected: "(__type.o40 | undefined)",
                        value: input.appPayload
                    })].every(flag => flag); const _vo1 = (input, _path, _exceptionable = true) => [undefined === input.preloaded_records || ("object" === typeof input.preloaded_records && null !== input.preloaded_records && false === Array.isArray(input.preloaded_records) || _report(_exceptionable, {
                        path: _path + ".preloaded_records",
                        expected: "(Record<string, unknown> | undefined)",
                        value: input.preloaded_records
                    })) && _vo2(input.preloaded_records, _path + ".preloaded_records", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".preloaded_records",
                        expected: "(Record<string, unknown> | undefined)",
                        value: input.preloaded_records
                    }), (Array.isArray(input.preloadedQueries) || _report(_exceptionable, {
                        path: _path + ".preloadedQueries",
                        expected: "[GitHubIssueQuery]",
                        value: input.preloadedQueries
                    })) && ((input.preloadedQueries.length === 1 || _report(_exceptionable, {
                        path: _path + ".preloadedQueries",
                        expected: "[GitHubIssueQuery]",
                        value: input.preloadedQueries
                    })) && [
                        ("object" === typeof input.preloadedQueries[0] && null !== input.preloadedQueries[0] || _report(_exceptionable, {
                            path: _path + ".preloadedQueries[0]",
                            expected: "GitHubIssueQuery",
                            value: input.preloadedQueries[0]
                        })) && _vo3(input.preloadedQueries[0], _path + ".preloadedQueries[0]", true && _exceptionable) || _report(_exceptionable, {
                            path: _path + ".preloadedQueries[0]",
                            expected: "GitHubIssueQuery",
                            value: input.preloadedQueries[0]
                        })
                    ].every(flag => flag)) || _report(_exceptionable, {
                        path: _path + ".preloadedQueries",
                        expected: "[GitHubIssueQuery]",
                        value: input.preloadedQueries
                    }), undefined === input.preloadedSubscriptions || ("object" === typeof input.preloadedSubscriptions && null !== input.preloadedSubscriptions && false === Array.isArray(input.preloadedSubscriptions) || _report(_exceptionable, {
                        path: _path + ".preloadedSubscriptions",
                        expected: "(Record<string, Record<string, IssueUpdateSubscriptionResponse>> | undefined)",
                        value: input.preloadedSubscriptions
                    })) && _vo44(input.preloadedSubscriptions, _path + ".preloadedSubscriptions", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".preloadedSubscriptions",
                        expected: "(Record<string, Record<string, IssueUpdateSubscriptionResponse>> | undefined)",
                        value: input.preloadedSubscriptions
                    })].every(flag => flag); const _vo2 = (input, _path, _exceptionable = true) => [false === _exceptionable || Object.keys(input).map(key => {
                        const value = input[key];
                        if (undefined === value)
                            return true;
                        return true;
                    }).every(flag => flag)].every(flag => flag); const _vo3 = (input, _path, _exceptionable = true) => ["string" === typeof input.queryId || _report(_exceptionable, {
                        path: _path + ".queryId",
                        expected: "string",
                        value: input.queryId
                    }), "string" === typeof input.queryName || _report(_exceptionable, {
                        path: _path + ".queryName",
                        expected: "string",
                        value: input.queryName
                    }), ("object" === typeof input.variables && null !== input.variables || _report(_exceptionable, {
                        path: _path + ".variables",
                        expected: "__type.o1",
                        value: input.variables
                    })) && _vo4(input.variables, _path + ".variables", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".variables",
                        expected: "__type.o1",
                        value: input.variables
                    }), ("object" === typeof input.result && null !== input.result || _report(_exceptionable, {
                        path: _path + ".result",
                        expected: "__type.o2",
                        value: input.result
                    })) && _vo5(input.result, _path + ".result", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".result",
                        expected: "__type.o2",
                        value: input.result
                    }), "number" === typeof input.timestamp || _report(_exceptionable, {
                        path: _path + ".timestamp",
                        expected: "number",
                        value: input.timestamp
                    })].every(flag => flag); const _vo4 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "number" === typeof input.number || _report(_exceptionable, {
                        path: _path + ".number",
                        expected: "number",
                        value: input.number
                    }), "string" === typeof input.owner || _report(_exceptionable, {
                        path: _path + ".owner",
                        expected: "string",
                        value: input.owner
                    }), "string" === typeof input.repo || _report(_exceptionable, {
                        path: _path + ".repo",
                        expected: "string",
                        value: input.repo
                    })].every(flag => flag); const _vo5 = (input, _path, _exceptionable = true) => [("object" === typeof input.data && null !== input.data || _report(_exceptionable, {
                        path: _path + ".data",
                        expected: "__type.o3",
                        value: input.data
                    })) && _vo6(input.data, _path + ".data", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".data",
                        expected: "__type.o3",
                        value: input.data
                    })].every(flag => flag); const _vo6 = (input, _path, _exceptionable = true) => [("object" === typeof input.repository && null !== input.repository || _report(_exceptionable, {
                        path: _path + ".repository",
                        expected: "__type.o4",
                        value: input.repository
                    })) && _vo7(input.repository, _path + ".repository", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".repository",
                        expected: "__type.o4",
                        value: input.repository
                    }), ("object" === typeof input.safeViewer && null !== input.safeViewer || _report(_exceptionable, {
                        path: _path + ".safeViewer",
                        expected: "__type.o36",
                        value: input.safeViewer
                    })) && _vo43(input.safeViewer, _path + ".safeViewer", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".safeViewer",
                        expected: "__type.o36",
                        value: input.safeViewer
                    })].every(flag => flag); const _vo7 = (input, _path, _exceptionable = true) => ["boolean" === typeof input.isOwnerEnterpriseManaged || _report(_exceptionable, {
                        path: _path + ".isOwnerEnterpriseManaged",
                        expected: "boolean",
                        value: input.isOwnerEnterpriseManaged
                    }), ("object" === typeof input.issue && null !== input.issue || _report(_exceptionable, {
                        path: _path + ".issue",
                        expected: "IssueData",
                        value: input.issue
                    })) && _vo8(input.issue, _path + ".issue", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".issue",
                        expected: "IssueData",
                        value: input.issue
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    })].every(flag => flag); const _vo8 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.updatedAt || _report(_exceptionable, {
                        path: _path + ".updatedAt",
                        expected: "string",
                        value: input.updatedAt
                    }), "string" === typeof input.title || _report(_exceptionable, {
                        path: _path + ".title",
                        expected: "string",
                        value: input.title
                    }), "number" === typeof input.number || _report(_exceptionable, {
                        path: _path + ".number",
                        expected: "number",
                        value: input.number
                    }), ("object" === typeof input.repository && null !== input.repository || _report(_exceptionable, {
                        path: _path + ".repository",
                        expected: "__type.o5",
                        value: input.repository
                    })) && _vo9(input.repository, _path + ".repository", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".repository",
                        expected: "__type.o5",
                        value: input.repository
                    }), "string" === typeof input.titleHTML || _report(_exceptionable, {
                        path: _path + ".titleHTML",
                        expected: "string",
                        value: input.titleHTML
                    }), "string" === typeof input.url || _report(_exceptionable, {
                        path: _path + ".url",
                        expected: "string",
                        value: input.url
                    }), "boolean" === typeof input.viewerCanUpdateNext || _report(_exceptionable, {
                        path: _path + ".viewerCanUpdateNext",
                        expected: "boolean",
                        value: input.viewerCanUpdateNext
                    }), null === input.issueType || ("object" === typeof input.issueType && null !== input.issueType || _report(_exceptionable, {
                        path: _path + ".issueType",
                        expected: "(IssueTypeData | null)",
                        value: input.issueType
                    })) && _vo16(input.issueType, _path + ".issueType", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".issueType",
                        expected: "(IssueTypeData | null)",
                        value: input.issueType
                    }), "OPEN" === input.state || "CLOSED" === input.state || _report(_exceptionable, {
                        path: _path + ".state",
                        expected: "(\"CLOSED\" | \"OPEN\")",
                        value: input.state
                    }), null === input.stateReason || "string" === typeof input.stateReason || _report(_exceptionable, {
                        path: _path + ".stateReason",
                        expected: "(null | string)",
                        value: input.stateReason
                    }), ("object" === typeof input.linkedPullRequests && null !== input.linkedPullRequests || _report(_exceptionable, {
                        path: _path + ".linkedPullRequests",
                        expected: "__type.o12",
                        value: input.linkedPullRequests
                    })) && _vo17(input.linkedPullRequests, _path + ".linkedPullRequests", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".linkedPullRequests",
                        expected: "__type.o12",
                        value: input.linkedPullRequests
                    }), ("object" === typeof input.subIssuesSummary && null !== input.subIssuesSummary || _report(_exceptionable, {
                        path: _path + ".subIssuesSummary",
                        expected: "__type.o13",
                        value: input.subIssuesSummary
                    })) && _vo18(input.subIssuesSummary, _path + ".subIssuesSummary", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".subIssuesSummary",
                        expected: "__type.o13",
                        value: input.subIssuesSummary
                    }), "string" === typeof input.__isLabelable || _report(_exceptionable, {
                        path: _path + ".__isLabelable",
                        expected: "string",
                        value: input.__isLabelable
                    }), ("object" === typeof input.labels && null !== input.labels || _report(_exceptionable, {
                        path: _path + ".labels",
                        expected: "__type.o14",
                        value: input.labels
                    })) && _vo19(input.labels, _path + ".labels", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".labels",
                        expected: "__type.o14",
                        value: input.labels
                    }), "string" === typeof input.__isNode || _report(_exceptionable, {
                        path: _path + ".__isNode",
                        expected: "string",
                        value: input.__isNode
                    }), "number" === typeof input.databaseId || _report(_exceptionable, {
                        path: _path + ".databaseId",
                        expected: "number",
                        value: input.databaseId
                    }), "boolean" === typeof input.viewerDidAuthor || _report(_exceptionable, {
                        path: _path + ".viewerDidAuthor",
                        expected: "boolean",
                        value: input.viewerDidAuthor
                    }), "boolean" === typeof input.locked || _report(_exceptionable, {
                        path: _path + ".locked",
                        expected: "boolean",
                        value: input.locked
                    }), ("object" === typeof input.author && null !== input.author || _report(_exceptionable, {
                        path: _path + ".author",
                        expected: "__type.o17",
                        value: input.author
                    })) && _vo23(input.author, _path + ".author", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".author",
                        expected: "__type.o17",
                        value: input.author
                    }), "string" === typeof input.__isComment || _report(_exceptionable, {
                        path: _path + ".__isComment",
                        expected: "string",
                        value: input.__isComment
                    }), "string" === typeof input.body || _report(_exceptionable, {
                        path: _path + ".body",
                        expected: "string",
                        value: input.body
                    }), "string" === typeof input.bodyHTML || _report(_exceptionable, {
                        path: _path + ".bodyHTML",
                        expected: "string",
                        value: input.bodyHTML
                    }), "string" === typeof input.bodyVersion || _report(_exceptionable, {
                        path: _path + ".bodyVersion",
                        expected: "string",
                        value: input.bodyVersion
                    }), "string" === typeof input.createdAt || _report(_exceptionable, {
                        path: _path + ".createdAt",
                        expected: "string",
                        value: input.createdAt
                    }), "string" === typeof input.__isReactable || _report(_exceptionable, {
                        path: _path + ".__isReactable",
                        expected: "string",
                        value: input.__isReactable
                    }), (Array.isArray(input.reactionGroups) || _report(_exceptionable, {
                        path: _path + ".reactionGroups",
                        expected: "Array<__type>.o2",
                        value: input.reactionGroups
                    })) && input.reactionGroups.map((elem, _index9) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".reactionGroups[" + _index9 + "]",
                        expected: "__type.o18",
                        value: elem
                    })) && _vo24(elem, _path + ".reactionGroups[" + _index9 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".reactionGroups[" + _index9 + "]",
                        expected: "__type.o18",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".reactionGroups",
                        expected: "Array<__type>.o2",
                        value: input.reactionGroups
                    }), "boolean" === typeof input.viewerCanUpdateMetadata || _report(_exceptionable, {
                        path: _path + ".viewerCanUpdateMetadata",
                        expected: "boolean",
                        value: input.viewerCanUpdateMetadata
                    }), "boolean" === typeof input.viewerCanComment || _report(_exceptionable, {
                        path: _path + ".viewerCanComment",
                        expected: "boolean",
                        value: input.viewerCanComment
                    }), "boolean" === typeof input.viewerCanAssign || _report(_exceptionable, {
                        path: _path + ".viewerCanAssign",
                        expected: "boolean",
                        value: input.viewerCanAssign
                    }), "boolean" === typeof input.viewerCanLabel || _report(_exceptionable, {
                        path: _path + ".viewerCanLabel",
                        expected: "boolean",
                        value: input.viewerCanLabel
                    }), "string" === typeof input.__isIssueOrPullRequest || _report(_exceptionable, {
                        path: _path + ".__isIssueOrPullRequest",
                        expected: "string",
                        value: input.__isIssueOrPullRequest
                    }), ("object" === typeof input.projectItemsNext && null !== input.projectItemsNext || _report(_exceptionable, {
                        path: _path + ".projectItemsNext",
                        expected: "__type.o20",
                        value: input.projectItemsNext
                    })) && _vo26(input.projectItemsNext, _path + ".projectItemsNext", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".projectItemsNext",
                        expected: "__type.o20",
                        value: input.projectItemsNext
                    }), "boolean" === typeof input.viewerCanSetMilestone || _report(_exceptionable, {
                        path: _path + ".viewerCanSetMilestone",
                        expected: "boolean",
                        value: input.viewerCanSetMilestone
                    }), "boolean" === typeof input.isPinned || _report(_exceptionable, {
                        path: _path + ".isPinned",
                        expected: "boolean",
                        value: input.isPinned
                    }), "boolean" === typeof input.viewerCanDelete || _report(_exceptionable, {
                        path: _path + ".viewerCanDelete",
                        expected: "boolean",
                        value: input.viewerCanDelete
                    }), "boolean" === typeof input.viewerCanTransfer || _report(_exceptionable, {
                        path: _path + ".viewerCanTransfer",
                        expected: "boolean",
                        value: input.viewerCanTransfer
                    }), "boolean" === typeof input.viewerCanConvertToDiscussion || _report(_exceptionable, {
                        path: _path + ".viewerCanConvertToDiscussion",
                        expected: "boolean",
                        value: input.viewerCanConvertToDiscussion
                    }), "boolean" === typeof input.viewerCanLock || _report(_exceptionable, {
                        path: _path + ".viewerCanLock",
                        expected: "boolean",
                        value: input.viewerCanLock
                    }), "boolean" === typeof input.viewerCanType || _report(_exceptionable, {
                        path: _path + ".viewerCanType",
                        expected: "boolean",
                        value: input.viewerCanType
                    }), ("object" === typeof input.frontTimelineItems && null !== input.frontTimelineItems || _report(_exceptionable, {
                        path: _path + ".frontTimelineItems",
                        expected: "__type.o28",
                        value: input.frontTimelineItems
                    })) && _vo34(input.frontTimelineItems, _path + ".frontTimelineItems", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".frontTimelineItems",
                        expected: "__type.o28",
                        value: input.frontTimelineItems
                    }), ("object" === typeof input.backTimelineItems && null !== input.backTimelineItems || _report(_exceptionable, {
                        path: _path + ".backTimelineItems",
                        expected: "__type.o31",
                        value: input.backTimelineItems
                    })) && _vo38(input.backTimelineItems, _path + ".backTimelineItems", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".backTimelineItems",
                        expected: "__type.o31",
                        value: input.backTimelineItems
                    }), ("object" === typeof input.assignedActors && null !== input.assignedActors || _report(_exceptionable, {
                        path: _path + ".assignedActors",
                        expected: "__type.o34",
                        value: input.assignedActors
                    })) && _vo41(input.assignedActors, _path + ".assignedActors", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".assignedActors",
                        expected: "__type.o34",
                        value: input.assignedActors
                    })].every(flag => flag); const _vo9 = (input, _path, _exceptionable = true) => ["string" === typeof input.nameWithOwner || _report(_exceptionable, {
                        path: _path + ".nameWithOwner",
                        expected: "string",
                        value: input.nameWithOwner
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), ("object" === typeof input.owner && null !== input.owner || _report(_exceptionable, {
                        path: _path + ".owner",
                        expected: "__type.o6",
                        value: input.owner
                    })) && _vo10(input.owner, _path + ".owner", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".owner",
                        expected: "__type.o6",
                        value: input.owner
                    }), "boolean" === typeof input.isArchived || _report(_exceptionable, {
                        path: _path + ".isArchived",
                        expected: "boolean",
                        value: input.isArchived
                    }), "boolean" === typeof input.isPrivate || _report(_exceptionable, {
                        path: _path + ".isPrivate",
                        expected: "boolean",
                        value: input.isPrivate
                    }), "number" === typeof input.databaseId || _report(_exceptionable, {
                        path: _path + ".databaseId",
                        expected: "number",
                        value: input.databaseId
                    }), "boolean" === typeof input.slashCommandsEnabled || _report(_exceptionable, {
                        path: _path + ".slashCommandsEnabled",
                        expected: "boolean",
                        value: input.slashCommandsEnabled
                    }), "boolean" === typeof input.viewerCanInteract || _report(_exceptionable, {
                        path: _path + ".viewerCanInteract",
                        expected: "boolean",
                        value: input.viewerCanInteract
                    }), "string" === typeof input.viewerInteractionLimitReasonHTML || _report(_exceptionable, {
                        path: _path + ".viewerInteractionLimitReasonHTML",
                        expected: "string",
                        value: input.viewerInteractionLimitReasonHTML
                    }), ("object" === typeof input.planFeatures && null !== input.planFeatures || _report(_exceptionable, {
                        path: _path + ".planFeatures",
                        expected: "__type.o7",
                        value: input.planFeatures
                    })) && _vo11(input.planFeatures, _path + ".planFeatures", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".planFeatures",
                        expected: "__type.o7",
                        value: input.planFeatures
                    }), "string" === typeof input.visibility || _report(_exceptionable, {
                        path: _path + ".visibility",
                        expected: "string",
                        value: input.visibility
                    }), ("object" === typeof input.pinnedIssues && null !== input.pinnedIssues || _report(_exceptionable, {
                        path: _path + ".pinnedIssues",
                        expected: "__type.o8",
                        value: input.pinnedIssues
                    })) && _vo12(input.pinnedIssues, _path + ".pinnedIssues", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".pinnedIssues",
                        expected: "__type.o8",
                        value: input.pinnedIssues
                    }), "boolean" === typeof input.viewerCanPinIssues || _report(_exceptionable, {
                        path: _path + ".viewerCanPinIssues",
                        expected: "boolean",
                        value: input.viewerCanPinIssues
                    }), null === input.issueTypes || ("object" === typeof input.issueTypes && null !== input.issueTypes || _report(_exceptionable, {
                        path: _path + ".issueTypes",
                        expected: "(__type.o9 | null)",
                        value: input.issueTypes
                    })) && _vo13(input.issueTypes, _path + ".issueTypes", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".issueTypes",
                        expected: "(__type.o9 | null)",
                        value: input.issueTypes
                    })].every(flag => flag); const _vo10 = (input, _path, _exceptionable = true) => ["User" === input.__typename || "Organization" === input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "(\"Organization\" | \"User\")",
                        value: input.__typename
                    }), "string" === typeof input.login || _report(_exceptionable, {
                        path: _path + ".login",
                        expected: "string",
                        value: input.login
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.url || _report(_exceptionable, {
                        path: _path + ".url",
                        expected: "string",
                        value: input.url
                    })].every(flag => flag); const _vo11 = (input, _path, _exceptionable = true) => ["number" === typeof input.maximumAssignees || _report(_exceptionable, {
                        path: _path + ".maximumAssignees",
                        expected: "number",
                        value: input.maximumAssignees
                    })].every(flag => flag); const _vo12 = (input, _path, _exceptionable = true) => ["number" === typeof input.totalCount || _report(_exceptionable, {
                        path: _path + ".totalCount",
                        expected: "number",
                        value: input.totalCount
                    })].every(flag => flag); const _vo13 = (input, _path, _exceptionable = true) => [(Array.isArray(input.edges) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>",
                        value: input.edges
                    })) && input.edges.map((elem, _index10) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".edges[" + _index10 + "]",
                        expected: "__type.o10",
                        value: elem
                    })) && _vo14(elem, _path + ".edges[" + _index10 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".edges[" + _index10 + "]",
                        expected: "__type.o10",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>",
                        value: input.edges
                    })].every(flag => flag); const _vo14 = (input, _path, _exceptionable = true) => [("object" === typeof input.node && null !== input.node || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "__type.o11",
                        value: input.node
                    })) && _vo15(input.node, _path + ".node", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "__type.o11",
                        value: input.node
                    })].every(flag => flag); const _vo15 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    })].every(flag => flag); const _vo16 = (input, _path, _exceptionable = true) => ["string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "string" === typeof input.color || _report(_exceptionable, {
                        path: _path + ".color",
                        expected: "string",
                        value: input.color
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), undefined === input.isEnabled || "boolean" === typeof input.isEnabled || _report(_exceptionable, {
                        path: _path + ".isEnabled",
                        expected: "(boolean | undefined)",
                        value: input.isEnabled
                    }), undefined === input.description || "string" === typeof input.description || _report(_exceptionable, {
                        path: _path + ".description",
                        expected: "(string | undefined)",
                        value: input.description
                    })].every(flag => flag); const _vo17 = (input, _path, _exceptionable = true) => [Array.isArray(input.nodes) || _report(_exceptionable, {
                        path: _path + ".nodes",
                        expected: "Array<unknown>",
                        value: input.nodes
                    })].every(flag => flag); const _vo18 = (input, _path, _exceptionable = true) => ["number" === typeof input.total || _report(_exceptionable, {
                        path: _path + ".total",
                        expected: "number",
                        value: input.total
                    }), "number" === typeof input.completed || _report(_exceptionable, {
                        path: _path + ".completed",
                        expected: "number",
                        value: input.completed
                    })].every(flag => flag); const _vo19 = (input, _path, _exceptionable = true) => [(Array.isArray(input.edges) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o1",
                        value: input.edges
                    })) && input.edges.map((elem, _index11) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".edges[" + _index11 + "]",
                        expected: "__type.o15",
                        value: elem
                    })) && _vo20(elem, _path + ".edges[" + _index11 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".edges[" + _index11 + "]",
                        expected: "__type.o15",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o1",
                        value: input.edges
                    }), ("object" === typeof input.pageInfo && null !== input.pageInfo || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o16",
                        value: input.pageInfo
                    })) && _vo22(input.pageInfo, _path + ".pageInfo", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o16",
                        value: input.pageInfo
                    })].every(flag => flag); const _vo20 = (input, _path, _exceptionable = true) => [("object" === typeof input.node && null !== input.node || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "LabelNode",
                        value: input.node
                    })) && _vo21(input.node, _path + ".node", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "LabelNode",
                        value: input.node
                    }), "string" === typeof input.cursor || _report(_exceptionable, {
                        path: _path + ".cursor",
                        expected: "string",
                        value: input.cursor
                    })].every(flag => flag); const _vo21 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.color || _report(_exceptionable, {
                        path: _path + ".color",
                        expected: "string",
                        value: input.color
                    }), "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "string" === typeof input.nameHTML || _report(_exceptionable, {
                        path: _path + ".nameHTML",
                        expected: "string",
                        value: input.nameHTML
                    }), null === input.description || "string" === typeof input.description || _report(_exceptionable, {
                        path: _path + ".description",
                        expected: "(null | string)",
                        value: input.description
                    }), "string" === typeof input.url || _report(_exceptionable, {
                        path: _path + ".url",
                        expected: "string",
                        value: input.url
                    }), "string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    })].every(flag => flag); const _vo22 = (input, _path, _exceptionable = true) => [null === input.endCursor || "string" === typeof input.endCursor || _report(_exceptionable, {
                        path: _path + ".endCursor",
                        expected: "(null | string)",
                        value: input.endCursor
                    }), "boolean" === typeof input.hasNextPage || _report(_exceptionable, {
                        path: _path + ".hasNextPage",
                        expected: "boolean",
                        value: input.hasNextPage
                    })].every(flag => flag); const _vo23 = (input, _path, _exceptionable = true) => ["string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    }), "string" === typeof input.__isActor || _report(_exceptionable, {
                        path: _path + ".__isActor",
                        expected: "string",
                        value: input.__isActor
                    }), "string" === typeof input.login || _report(_exceptionable, {
                        path: _path + ".login",
                        expected: "string",
                        value: input.login
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.profileUrl || _report(_exceptionable, {
                        path: _path + ".profileUrl",
                        expected: "string",
                        value: input.profileUrl
                    }), "string" === typeof input.avatarUrl || _report(_exceptionable, {
                        path: _path + ".avatarUrl",
                        expected: "string",
                        value: input.avatarUrl
                    })].every(flag => flag); const _vo24 = (input, _path, _exceptionable = true) => ["string" === typeof input.content || _report(_exceptionable, {
                        path: _path + ".content",
                        expected: "string",
                        value: input.content
                    }), "boolean" === typeof input.viewerHasReacted || _report(_exceptionable, {
                        path: _path + ".viewerHasReacted",
                        expected: "boolean",
                        value: input.viewerHasReacted
                    }), ("object" === typeof input.reactors && null !== input.reactors || _report(_exceptionable, {
                        path: _path + ".reactors",
                        expected: "__type.o19",
                        value: input.reactors
                    })) && _vo25(input.reactors, _path + ".reactors", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".reactors",
                        expected: "__type.o19",
                        value: input.reactors
                    })].every(flag => flag); const _vo25 = (input, _path, _exceptionable = true) => ["number" === typeof input.totalCount || _report(_exceptionable, {
                        path: _path + ".totalCount",
                        expected: "number",
                        value: input.totalCount
                    }), Array.isArray(input.nodes) || _report(_exceptionable, {
                        path: _path + ".nodes",
                        expected: "Array<unknown>",
                        value: input.nodes
                    })].every(flag => flag); const _vo26 = (input, _path, _exceptionable = true) => [(Array.isArray(input.edges) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o3",
                        value: input.edges
                    })) && input.edges.map((elem, _index12) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".edges[" + _index12 + "]",
                        expected: "__type.o21",
                        value: elem
                    })) && _vo27(elem, _path + ".edges[" + _index12 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".edges[" + _index12 + "]",
                        expected: "__type.o21",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o3",
                        value: input.edges
                    }), ("object" === typeof input.pageInfo && null !== input.pageInfo || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o27",
                        value: input.pageInfo
                    })) && _vo33(input.pageInfo, _path + ".pageInfo", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o27",
                        value: input.pageInfo
                    })].every(flag => flag); const _vo27 = (input, _path, _exceptionable = true) => [("object" === typeof input.node && null !== input.node || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "__type.o22",
                        value: input.node
                    })) && _vo28(input.node, _path + ".node", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "__type.o22",
                        value: input.node
                    }), "string" === typeof input.cursor || _report(_exceptionable, {
                        path: _path + ".cursor",
                        expected: "string",
                        value: input.cursor
                    })].every(flag => flag); const _vo28 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "boolean" === typeof input.isArchived || _report(_exceptionable, {
                        path: _path + ".isArchived",
                        expected: "boolean",
                        value: input.isArchived
                    }), ("object" === typeof input.project && null !== input.project || _report(_exceptionable, {
                        path: _path + ".project",
                        expected: "__type.o23",
                        value: input.project
                    })) && _vo29(input.project, _path + ".project", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".project",
                        expected: "__type.o23",
                        value: input.project
                    }), ("object" === typeof input.fieldValueByName && null !== input.fieldValueByName || _report(_exceptionable, {
                        path: _path + ".fieldValueByName",
                        expected: "__type.o26",
                        value: input.fieldValueByName
                    })) && _vo32(input.fieldValueByName, _path + ".fieldValueByName", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".fieldValueByName",
                        expected: "__type.o26",
                        value: input.fieldValueByName
                    }), "string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    })].every(flag => flag); const _vo29 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.title || _report(_exceptionable, {
                        path: _path + ".title",
                        expected: "string",
                        value: input.title
                    }), "boolean" === typeof input.template || _report(_exceptionable, {
                        path: _path + ".template",
                        expected: "boolean",
                        value: input.template
                    }), "boolean" === typeof input.viewerCanUpdate || _report(_exceptionable, {
                        path: _path + ".viewerCanUpdate",
                        expected: "boolean",
                        value: input.viewerCanUpdate
                    }), "string" === typeof input.url || _report(_exceptionable, {
                        path: _path + ".url",
                        expected: "string",
                        value: input.url
                    }), ("object" === typeof input.field && null !== input.field || _report(_exceptionable, {
                        path: _path + ".field",
                        expected: "__type.o24",
                        value: input.field
                    })) && _vo30(input.field, _path + ".field", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".field",
                        expected: "__type.o24",
                        value: input.field
                    }), "boolean" === typeof input.closed || _report(_exceptionable, {
                        path: _path + ".closed",
                        expected: "boolean",
                        value: input.closed
                    }), "number" === typeof input.number || _report(_exceptionable, {
                        path: _path + ".number",
                        expected: "number",
                        value: input.number
                    }), "boolean" === typeof input.hasReachedItemsLimit || _report(_exceptionable, {
                        path: _path + ".hasReachedItemsLimit",
                        expected: "boolean",
                        value: input.hasReachedItemsLimit
                    }), "string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    })].every(flag => flag); const _vo30 = (input, _path, _exceptionable = true) => ["string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), (Array.isArray(input.options) || _report(_exceptionable, {
                        path: _path + ".options",
                        expected: "Array<__type>.o4",
                        value: input.options
                    })) && input.options.map((elem, _index13) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".options[" + _index13 + "]",
                        expected: "__type.o25",
                        value: elem
                    })) && _vo31(elem, _path + ".options[" + _index13 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".options[" + _index13 + "]",
                        expected: "__type.o25",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".options",
                        expected: "Array<__type>.o4",
                        value: input.options
                    }), "string" === typeof input.__isNode || _report(_exceptionable, {
                        path: _path + ".__isNode",
                        expected: "string",
                        value: input.__isNode
                    })].every(flag => flag); const _vo31 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.optionId || _report(_exceptionable, {
                        path: _path + ".optionId",
                        expected: "string",
                        value: input.optionId
                    }), "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "string" === typeof input.nameHTML || _report(_exceptionable, {
                        path: _path + ".nameHTML",
                        expected: "string",
                        value: input.nameHTML
                    }), "string" === typeof input.color || _report(_exceptionable, {
                        path: _path + ".color",
                        expected: "string",
                        value: input.color
                    }), "string" === typeof input.descriptionHTML || _report(_exceptionable, {
                        path: _path + ".descriptionHTML",
                        expected: "string",
                        value: input.descriptionHTML
                    }), "string" === typeof input.description || _report(_exceptionable, {
                        path: _path + ".description",
                        expected: "string",
                        value: input.description
                    })].every(flag => flag); const _vo32 = (input, _path, _exceptionable = true) => ["string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.optionId || _report(_exceptionable, {
                        path: _path + ".optionId",
                        expected: "string",
                        value: input.optionId
                    }), "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "string" === typeof input.nameHTML || _report(_exceptionable, {
                        path: _path + ".nameHTML",
                        expected: "string",
                        value: input.nameHTML
                    }), "string" === typeof input.color || _report(_exceptionable, {
                        path: _path + ".color",
                        expected: "string",
                        value: input.color
                    }), "string" === typeof input.__isNode || _report(_exceptionable, {
                        path: _path + ".__isNode",
                        expected: "string",
                        value: input.__isNode
                    })].every(flag => flag); const _vo33 = (input, _path, _exceptionable = true) => ["string" === typeof input.endCursor || _report(_exceptionable, {
                        path: _path + ".endCursor",
                        expected: "string",
                        value: input.endCursor
                    }), "boolean" === typeof input.hasNextPage || _report(_exceptionable, {
                        path: _path + ".hasNextPage",
                        expected: "boolean",
                        value: input.hasNextPage
                    })].every(flag => flag); const _vo34 = (input, _path, _exceptionable = true) => [("object" === typeof input.pageInfo && null !== input.pageInfo || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o29",
                        value: input.pageInfo
                    })) && _vo35(input.pageInfo, _path + ".pageInfo", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o29",
                        value: input.pageInfo
                    }), "number" === typeof input.totalCount || _report(_exceptionable, {
                        path: _path + ".totalCount",
                        expected: "number",
                        value: input.totalCount
                    }), (Array.isArray(input.edges) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o5",
                        value: input.edges
                    })) && input.edges.map((elem, _index14) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".edges[" + _index14 + "]",
                        expected: "__type.o30",
                        value: elem
                    })) && _vo36(elem, _path + ".edges[" + _index14 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".edges[" + _index14 + "]",
                        expected: "__type.o30",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o5",
                        value: input.edges
                    })].every(flag => flag); const _vo35 = (input, _path, _exceptionable = true) => ["boolean" === typeof input.hasNextPage || _report(_exceptionable, {
                        path: _path + ".hasNextPage",
                        expected: "boolean",
                        value: input.hasNextPage
                    }), "string" === typeof input.endCursor || _report(_exceptionable, {
                        path: _path + ".endCursor",
                        expected: "string",
                        value: input.endCursor
                    })].every(flag => flag); const _vo36 = (input, _path, _exceptionable = true) => [null === input.node || ("object" === typeof input.node && null !== input.node || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "(TimelineItem | null)",
                        value: input.node
                    })) && _vo37(input.node, _path + ".node", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "(TimelineItem | null)",
                        value: input.node
                    }), "string" === typeof input.cursor || _report(_exceptionable, {
                        path: _path + ".cursor",
                        expected: "string",
                        value: input.cursor
                    })].every(flag => flag); const _vo37 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    })].every(flag => flag); const _vo38 = (input, _path, _exceptionable = true) => [("object" === typeof input.pageInfo && null !== input.pageInfo || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o32",
                        value: input.pageInfo
                    })) && _vo39(input.pageInfo, _path + ".pageInfo", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".pageInfo",
                        expected: "__type.o32",
                        value: input.pageInfo
                    }), "number" === typeof input.totalCount || _report(_exceptionable, {
                        path: _path + ".totalCount",
                        expected: "number",
                        value: input.totalCount
                    }), (Array.isArray(input.edges) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o6",
                        value: input.edges
                    })) && input.edges.map((elem, _index15) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".edges[" + _index15 + "]",
                        expected: "__type.o33",
                        value: elem
                    })) && _vo40(elem, _path + ".edges[" + _index15 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".edges[" + _index15 + "]",
                        expected: "__type.o33",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".edges",
                        expected: "Array<__type>.o6",
                        value: input.edges
                    })].every(flag => flag); const _vo39 = (input, _path, _exceptionable = true) => ["boolean" === typeof input.hasPreviousPage || _report(_exceptionable, {
                        path: _path + ".hasPreviousPage",
                        expected: "boolean",
                        value: input.hasPreviousPage
                    }), null === input.startCursor || "string" === typeof input.startCursor || _report(_exceptionable, {
                        path: _path + ".startCursor",
                        expected: "(null | string)",
                        value: input.startCursor
                    })].every(flag => flag); const _vo40 = (input, _path, _exceptionable = true) => [null === input.node || ("object" === typeof input.node && null !== input.node || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "(TimelineItem | null)",
                        value: input.node
                    })) && _vo37(input.node, _path + ".node", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".node",
                        expected: "(TimelineItem | null)",
                        value: input.node
                    }), "string" === typeof input.cursor || _report(_exceptionable, {
                        path: _path + ".cursor",
                        expected: "string",
                        value: input.cursor
                    })].every(flag => flag); const _vo41 = (input, _path, _exceptionable = true) => [(Array.isArray(input.nodes) || _report(_exceptionable, {
                        path: _path + ".nodes",
                        expected: "Array<__type>.o7",
                        value: input.nodes
                    })) && input.nodes.map((elem, _index16) => ("object" === typeof elem && null !== elem || _report(_exceptionable, {
                        path: _path + ".nodes[" + _index16 + "]",
                        expected: "__type.o35",
                        value: elem
                    })) && _vo42(elem, _path + ".nodes[" + _index16 + "]", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".nodes[" + _index16 + "]",
                        expected: "__type.o35",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".nodes",
                        expected: "Array<__type>.o7",
                        value: input.nodes
                    })].every(flag => flag); const _vo42 = (input, _path, _exceptionable = true) => ["string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    }), "string" === typeof input.__isActor || _report(_exceptionable, {
                        path: _path + ".__isActor",
                        expected: "string",
                        value: input.__isActor
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.login || _report(_exceptionable, {
                        path: _path + ".login",
                        expected: "string",
                        value: input.login
                    }), null === input.name || "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "(null | string)",
                        value: input.name
                    }), "string" === typeof input.profileResourcePath || _report(_exceptionable, {
                        path: _path + ".profileResourcePath",
                        expected: "string",
                        value: input.profileResourcePath
                    }), "string" === typeof input.avatarUrl || _report(_exceptionable, {
                        path: _path + ".avatarUrl",
                        expected: "string",
                        value: input.avatarUrl
                    }), "string" === typeof input.__isNode || _report(_exceptionable, {
                        path: _path + ".__isNode",
                        expected: "string",
                        value: input.__isNode
                    })].every(flag => flag); const _vo43 = (input, _path, _exceptionable = true) => ["boolean" === typeof input.isEnterpriseManagedUser || _report(_exceptionable, {
                        path: _path + ".isEnterpriseManagedUser",
                        expected: "boolean",
                        value: input.isEnterpriseManagedUser
                    }), (undefined !== input.enterpriseManagedEnterpriseId || _report(_exceptionable, {
                        path: _path + ".enterpriseManagedEnterpriseId",
                        expected: "null",
                        value: input.enterpriseManagedEnterpriseId
                    })) && (null === input.enterpriseManagedEnterpriseId || _report(_exceptionable, {
                        path: _path + ".enterpriseManagedEnterpriseId",
                        expected: "null",
                        value: input.enterpriseManagedEnterpriseId
                    })), "string" === typeof input.login || _report(_exceptionable, {
                        path: _path + ".login",
                        expected: "string",
                        value: input.login
                    }), "string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.avatarUrl || _report(_exceptionable, {
                        path: _path + ".avatarUrl",
                        expected: "string",
                        value: input.avatarUrl
                    }), "string" === typeof input.__isActor || _report(_exceptionable, {
                        path: _path + ".__isActor",
                        expected: "string",
                        value: input.__isActor
                    }), "string" === typeof input.__typename || _report(_exceptionable, {
                        path: _path + ".__typename",
                        expected: "string",
                        value: input.__typename
                    }), null === input.name || "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "(null | string)",
                        value: input.name
                    }), "string" === typeof input.profileResourcePath || _report(_exceptionable, {
                        path: _path + ".profileResourcePath",
                        expected: "string",
                        value: input.profileResourcePath
                    })].every(flag => flag); const _vo44 = (input, _path, _exceptionable = true) => [false === _exceptionable || Object.keys(input).map(key => {
                        const value = input[key];
                        if (undefined === value)
                            return true;
                        return ("object" === typeof value && null !== value && false === Array.isArray(value) || _report(_exceptionable, {
                            path: _path + __typia_transform__accessExpressionAsString._accessExpressionAsString(key),
                            expected: "Record<string, IssueUpdateSubscriptionResponse>",
                            value: value
                        })) && _vo45(value, _path + __typia_transform__accessExpressionAsString._accessExpressionAsString(key), true && _exceptionable) || _report(_exceptionable, {
                            path: _path + __typia_transform__accessExpressionAsString._accessExpressionAsString(key),
                            expected: "Record<string, IssueUpdateSubscriptionResponse>",
                            value: value
                        });
                    }).every(flag => flag)].every(flag => flag); const _vo45 = (input, _path, _exceptionable = true) => [false === _exceptionable || Object.keys(input).map(key => {
                        const value = input[key];
                        if (undefined === value)
                            return true;
                        return ("object" === typeof value && null !== value || _report(_exceptionable, {
                            path: _path + __typia_transform__accessExpressionAsString._accessExpressionAsString(key),
                            expected: "IssueUpdateSubscriptionResponse",
                            value: value
                        })) && _vo46(value, _path + __typia_transform__accessExpressionAsString._accessExpressionAsString(key), true && _exceptionable) || _report(_exceptionable, {
                            path: _path + __typia_transform__accessExpressionAsString._accessExpressionAsString(key),
                            expected: "IssueUpdateSubscriptionResponse",
                            value: value
                        });
                    }).every(flag => flag)].every(flag => flag); const _vo46 = (input, _path, _exceptionable = true) => [("object" === typeof input.response && null !== input.response || _report(_exceptionable, {
                        path: _path + ".response",
                        expected: "__type.o37",
                        value: input.response
                    })) && _vo47(input.response, _path + ".response", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".response",
                        expected: "__type.o37",
                        value: input.response
                    }), "string" === typeof input.subscriptionId || _report(_exceptionable, {
                        path: _path + ".subscriptionId",
                        expected: "string",
                        value: input.subscriptionId
                    })].every(flag => flag); const _vo47 = (input, _path, _exceptionable = true) => [("object" === typeof input.data && null !== input.data || _report(_exceptionable, {
                        path: _path + ".data",
                        expected: "__type.o38",
                        value: input.data
                    })) && _vo48(input.data, _path + ".data", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".data",
                        expected: "__type.o38",
                        value: input.data
                    })].every(flag => flag); const _vo48 = (input, _path, _exceptionable = true) => [("object" === typeof input.issueUpdated && null !== input.issueUpdated || _report(_exceptionable, {
                        path: _path + ".issueUpdated",
                        expected: "__type.o39",
                        value: input.issueUpdated
                    })) && _vo49(input.issueUpdated, _path + ".issueUpdated", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".issueUpdated",
                        expected: "__type.o39",
                        value: input.issueUpdated
                    })].every(flag => flag); const _vo49 = (input, _path, _exceptionable = true) => [(undefined !== input.deletedCommentId || _report(_exceptionable, {
                        path: _path + ".deletedCommentId",
                        expected: "null",
                        value: input.deletedCommentId
                    })) && (null === input.deletedCommentId || _report(_exceptionable, {
                        path: _path + ".deletedCommentId",
                        expected: "null",
                        value: input.deletedCommentId
                    })), (undefined !== input.issueBodyUpdated || _report(_exceptionable, {
                        path: _path + ".issueBodyUpdated",
                        expected: "null",
                        value: input.issueBodyUpdated
                    })) && (null === input.issueBodyUpdated || _report(_exceptionable, {
                        path: _path + ".issueBodyUpdated",
                        expected: "null",
                        value: input.issueBodyUpdated
                    })), (undefined !== input.issueMetadataUpdated || _report(_exceptionable, {
                        path: _path + ".issueMetadataUpdated",
                        expected: "null",
                        value: input.issueMetadataUpdated
                    })) && (null === input.issueMetadataUpdated || _report(_exceptionable, {
                        path: _path + ".issueMetadataUpdated",
                        expected: "null",
                        value: input.issueMetadataUpdated
                    })), (undefined !== input.issueStateUpdated || _report(_exceptionable, {
                        path: _path + ".issueStateUpdated",
                        expected: "null",
                        value: input.issueStateUpdated
                    })) && (null === input.issueStateUpdated || _report(_exceptionable, {
                        path: _path + ".issueStateUpdated",
                        expected: "null",
                        value: input.issueStateUpdated
                    })), (undefined !== input.issueTimelineUpdated || _report(_exceptionable, {
                        path: _path + ".issueTimelineUpdated",
                        expected: "null",
                        value: input.issueTimelineUpdated
                    })) && (null === input.issueTimelineUpdated || _report(_exceptionable, {
                        path: _path + ".issueTimelineUpdated",
                        expected: "null",
                        value: input.issueTimelineUpdated
                    })), (undefined !== input.issueTitleUpdated || _report(_exceptionable, {
                        path: _path + ".issueTitleUpdated",
                        expected: "null",
                        value: input.issueTitleUpdated
                    })) && (null === input.issueTitleUpdated || _report(_exceptionable, {
                        path: _path + ".issueTitleUpdated",
                        expected: "null",
                        value: input.issueTitleUpdated
                    })), (undefined !== input.issueReactionUpdated || _report(_exceptionable, {
                        path: _path + ".issueReactionUpdated",
                        expected: "null",
                        value: input.issueReactionUpdated
                    })) && (null === input.issueReactionUpdated || _report(_exceptionable, {
                        path: _path + ".issueReactionUpdated",
                        expected: "null",
                        value: input.issueReactionUpdated
                    })), (undefined !== input.issueTransferStateUpdated || _report(_exceptionable, {
                        path: _path + ".issueTransferStateUpdated",
                        expected: "null",
                        value: input.issueTransferStateUpdated
                    })) && (null === input.issueTransferStateUpdated || _report(_exceptionable, {
                        path: _path + ".issueTransferStateUpdated",
                        expected: "null",
                        value: input.issueTransferStateUpdated
                    })), (undefined !== input.issueTypeUpdated || _report(_exceptionable, {
                        path: _path + ".issueTypeUpdated",
                        expected: "null",
                        value: input.issueTypeUpdated
                    })) && (null === input.issueTypeUpdated || _report(_exceptionable, {
                        path: _path + ".issueTypeUpdated",
                        expected: "null",
                        value: input.issueTypeUpdated
                    })), (undefined !== input.commentReactionUpdated || _report(_exceptionable, {
                        path: _path + ".commentReactionUpdated",
                        expected: "null",
                        value: input.commentReactionUpdated
                    })) && (null === input.commentReactionUpdated || _report(_exceptionable, {
                        path: _path + ".commentReactionUpdated",
                        expected: "null",
                        value: input.commentReactionUpdated
                    })), (undefined !== input.commentUpdated || _report(_exceptionable, {
                        path: _path + ".commentUpdated",
                        expected: "null",
                        value: input.commentUpdated
                    })) && (null === input.commentUpdated || _report(_exceptionable, {
                        path: _path + ".commentUpdated",
                        expected: "null",
                        value: input.commentUpdated
                    })), (undefined !== input.subIssuesUpdated || _report(_exceptionable, {
                        path: _path + ".subIssuesUpdated",
                        expected: "null",
                        value: input.subIssuesUpdated
                    })) && (null === input.subIssuesUpdated || _report(_exceptionable, {
                        path: _path + ".subIssuesUpdated",
                        expected: "null",
                        value: input.subIssuesUpdated
                    })), (undefined !== input.subIssuesSummaryUpdated || _report(_exceptionable, {
                        path: _path + ".subIssuesSummaryUpdated",
                        expected: "null",
                        value: input.subIssuesSummaryUpdated
                    })) && (null === input.subIssuesSummaryUpdated || _report(_exceptionable, {
                        path: _path + ".subIssuesSummaryUpdated",
                        expected: "null",
                        value: input.subIssuesSummaryUpdated
                    })), (undefined !== input.parentIssueUpdated || _report(_exceptionable, {
                        path: _path + ".parentIssueUpdated",
                        expected: "null",
                        value: input.parentIssueUpdated
                    })) && (null === input.parentIssueUpdated || _report(_exceptionable, {
                        path: _path + ".parentIssueUpdated",
                        expected: "null",
                        value: input.parentIssueUpdated
                    })), (undefined !== input.issueDependenciesSummaryUpdated || _report(_exceptionable, {
                        path: _path + ".issueDependenciesSummaryUpdated",
                        expected: "null",
                        value: input.issueDependenciesSummaryUpdated
                    })) && (null === input.issueDependenciesSummaryUpdated || _report(_exceptionable, {
                        path: _path + ".issueDependenciesSummaryUpdated",
                        expected: "null",
                        value: input.issueDependenciesSummaryUpdated
                    }))].every(flag => flag); const _vo50 = (input, _path, _exceptionable = true) => [undefined === input.initial_view_content || ("object" === typeof input.initial_view_content && null !== input.initial_view_content || _report(_exceptionable, {
                        path: _path + ".initial_view_content",
                        expected: "(__type.o41 | undefined)",
                        value: input.initial_view_content
                    })) && _vo51(input.initial_view_content, _path + ".initial_view_content", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".initial_view_content",
                        expected: "(__type.o41 | undefined)",
                        value: input.initial_view_content
                    }), undefined === input.current_user || ("object" === typeof input.current_user && null !== input.current_user || _report(_exceptionable, {
                        path: _path + ".current_user",
                        expected: "(__type.o42 | undefined)",
                        value: input.current_user
                    })) && _vo52(input.current_user, _path + ".current_user", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".current_user",
                        expected: "(__type.o42 | undefined)",
                        value: input.current_user
                    }), undefined === input.current_user_settings || ("object" === typeof input.current_user_settings && null !== input.current_user_settings || _report(_exceptionable, {
                        path: _path + ".current_user_settings",
                        expected: "(__type.o43 | undefined)",
                        value: input.current_user_settings
                    })) && _vo53(input.current_user_settings, _path + ".current_user_settings", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".current_user_settings",
                        expected: "(__type.o43 | undefined)",
                        value: input.current_user_settings
                    }), undefined === input.paste_url_link_as_plain_text || "boolean" === typeof input.paste_url_link_as_plain_text || _report(_exceptionable, {
                        path: _path + ".paste_url_link_as_plain_text",
                        expected: "(boolean | undefined)",
                        value: input.paste_url_link_as_plain_text
                    }), undefined === input.base_avatar_url || "string" === typeof input.base_avatar_url || _report(_exceptionable, {
                        path: _path + ".base_avatar_url",
                        expected: "(string | undefined)",
                        value: input.base_avatar_url
                    }), undefined === input.help_url || "string" === typeof input.help_url || _report(_exceptionable, {
                        path: _path + ".help_url",
                        expected: "(string | undefined)",
                        value: input.help_url
                    }), null === input.sso_organizations || undefined === input.sso_organizations || _report(_exceptionable, {
                        path: _path + ".sso_organizations",
                        expected: "(null | undefined)",
                        value: input.sso_organizations
                    }), undefined === input.multi_tenant || "boolean" === typeof input.multi_tenant || _report(_exceptionable, {
                        path: _path + ".multi_tenant",
                        expected: "(boolean | undefined)",
                        value: input.multi_tenant
                    }), undefined === input.tracing || "boolean" === typeof input.tracing || _report(_exceptionable, {
                        path: _path + ".tracing",
                        expected: "(boolean | undefined)",
                        value: input.tracing
                    }), undefined === input.tracing_flamegraph || "boolean" === typeof input.tracing_flamegraph || _report(_exceptionable, {
                        path: _path + ".tracing_flamegraph",
                        expected: "(boolean | undefined)",
                        value: input.tracing_flamegraph
                    }), undefined === input.catalog_service || "string" === typeof input.catalog_service || _report(_exceptionable, {
                        path: _path + ".catalog_service",
                        expected: "(string | undefined)",
                        value: input.catalog_service
                    }), undefined === input.scoped_repository || ("object" === typeof input.scoped_repository && null !== input.scoped_repository || _report(_exceptionable, {
                        path: _path + ".scoped_repository",
                        expected: "(__type.o44 | undefined)",
                        value: input.scoped_repository
                    })) && _vo54(input.scoped_repository, _path + ".scoped_repository", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".scoped_repository",
                        expected: "(__type.o44 | undefined)",
                        value: input.scoped_repository
                    }), null === input.copilot_api_url || undefined === input.copilot_api_url || _report(_exceptionable, {
                        path: _path + ".copilot_api_url",
                        expected: "(null | undefined)",
                        value: input.copilot_api_url
                    }), undefined === input.enabled_features || ("object" === typeof input.enabled_features && null !== input.enabled_features && false === Array.isArray(input.enabled_features) || _report(_exceptionable, {
                        path: _path + ".enabled_features",
                        expected: "(Record<string, boolean> | undefined)",
                        value: input.enabled_features
                    })) && _vo55(input.enabled_features, _path + ".enabled_features", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".enabled_features",
                        expected: "(Record<string, boolean> | undefined)",
                        value: input.enabled_features
                    })].every(flag => flag); const _vo51 = (input, _path, _exceptionable = true) => [(undefined !== input.team_id || _report(_exceptionable, {
                        path: _path + ".team_id",
                        expected: "null",
                        value: input.team_id
                    })) && (null === input.team_id || _report(_exceptionable, {
                        path: _path + ".team_id",
                        expected: "null",
                        value: input.team_id
                    })), "boolean" === typeof input.can_edit_view || _report(_exceptionable, {
                        path: _path + ".can_edit_view",
                        expected: "boolean",
                        value: input.can_edit_view
                    })].every(flag => flag); const _vo52 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.login || _report(_exceptionable, {
                        path: _path + ".login",
                        expected: "string",
                        value: input.login
                    }), "string" === typeof input.avatarUrl || _report(_exceptionable, {
                        path: _path + ".avatarUrl",
                        expected: "string",
                        value: input.avatarUrl
                    }), "boolean" === typeof input.is_staff || _report(_exceptionable, {
                        path: _path + ".is_staff",
                        expected: "boolean",
                        value: input.is_staff
                    }), "boolean" === typeof input.is_emu || _report(_exceptionable, {
                        path: _path + ".is_emu",
                        expected: "boolean",
                        value: input.is_emu
                    })].every(flag => flag); const _vo53 = (input, _path, _exceptionable = true) => ["boolean" === typeof input.use_monospace_font || _report(_exceptionable, {
                        path: _path + ".use_monospace_font",
                        expected: "boolean",
                        value: input.use_monospace_font
                    }), "boolean" === typeof input.use_single_key_shortcut || _report(_exceptionable, {
                        path: _path + ".use_single_key_shortcut",
                        expected: "boolean",
                        value: input.use_single_key_shortcut
                    }), "number" === typeof input.preferred_emoji_skin_tone || _report(_exceptionable, {
                        path: _path + ".preferred_emoji_skin_tone",
                        expected: "number",
                        value: input.preferred_emoji_skin_tone
                    })].every(flag => flag); const _vo54 = (input, _path, _exceptionable = true) => ["string" === typeof input.id || _report(_exceptionable, {
                        path: _path + ".id",
                        expected: "string",
                        value: input.id
                    }), "string" === typeof input.owner || _report(_exceptionable, {
                        path: _path + ".owner",
                        expected: "string",
                        value: input.owner
                    }), "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "boolean" === typeof input.is_archived || _report(_exceptionable, {
                        path: _path + ".is_archived",
                        expected: "boolean",
                        value: input.is_archived
                    })].every(flag => flag); const _vo55 = (input, _path, _exceptionable = true) => [false === _exceptionable || Object.keys(input).map(key => {
                        const value = input[key];
                        if (undefined === value)
                            return true;
                        return "boolean" === typeof value || _report(_exceptionable, {
                            path: _path + __typia_transform__accessExpressionAsString._accessExpressionAsString(key),
                            expected: "boolean",
                            value: value
                        });
                    }).every(flag => flag)].every(flag => flag); const __is = input => "object" === typeof input && null !== input && _io0(input); let errors; let _report; return input => {
                    if (false === __is(input)) {
                        errors = [];
                        _report = __typia_transform__validateReport._validateReport(errors);
                        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || _report(true, {
                            path: _path + "",
                            expected: "GitHubBetaFeatureViewData",
                            value: input
                        })) && _vo0(input, _path + "", true) || _report(true, {
                            path: _path + "",
                            expected: "GitHubBetaFeatureViewData",
                            value: input
                        }))(input, "$input", true);
                        const success = 0 === errors.length;
                        return success ? {
                            success,
                            data: input
                        } : {
                            success,
                            errors,
                            data: input
                        };
                    }
                    return {
                        success: true,
                        data: input
                    };
                }; })()(data);
                throw new Error(`Invalid data: validateResult: ${JSON.stringify(validateResult)}, data: ${JSON.stringify(data)}`);
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
            const inProgressTimeline = await (0, issueTimelineUtils_1.getInProgressTimeline)(statusTimeline, issueUrl);
            return {
                url: issueUrl,
                title: issueData.title,
                status: statusTimeline.length > 0
                    ? statusTimeline[statusTimeline.length - 1].to
                    : '',
                assignees: issueData.assignedActors.nodes.map((node) => node.login),
                labels: issueData.labels.edges.map((edge) => edge.node.name),
                project: issueData.projectItemsNext.edges[0].node.project.title,
                statusTimeline,
                inProgressTimeline,
                createdAt: new Date(issueData.createdAt),
                workingTimeline: inProgressTimeline,
            };
        };
    }
}
exports.InternalGraphqlIssueRepository = InternalGraphqlIssueRepository;
//# sourceMappingURL=InternalGraphqlIssueRepository.js.map