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
            if (!(() => { const _io0 = input => "object" === typeof input.payload && null !== input.payload && _io1(input.payload) && (null === input.title || undefined === input.title) && (undefined === input.appPayload || "object" === typeof input.appPayload && null !== input.appPayload && false === Array.isArray(input.appPayload) && _io70(input.appPayload)); const _io1 = input => (undefined === input.preloaded_records || "object" === typeof input.preloaded_records && null !== input.preloaded_records && false === Array.isArray(input.preloaded_records) && _io2(input.preloaded_records)) && (Array.isArray(input.preloadedQueries) && (input.preloadedQueries.length === 1 && ("object" === typeof input.preloadedQueries[0] && null !== input.preloadedQueries[0] && _io3(input.preloadedQueries[0])))) && (undefined === input.preloadedSubscriptions || "object" === typeof input.preloadedSubscriptions && null !== input.preloadedSubscriptions && false === Array.isArray(input.preloadedSubscriptions) && _io64(input.preloadedSubscriptions)); const _io2 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return true;
            }); const _io3 = input => "string" === typeof input.queryId && "string" === typeof input.queryName && ("object" === typeof input.variables && null !== input.variables && _io4(input.variables)) && ("object" === typeof input.result && null !== input.result && _io5(input.result)) && "number" === typeof input.timestamp; const _io4 = input => "string" === typeof input.id && "number" === typeof input.number && "string" === typeof input.owner && "string" === typeof input.repo; const _io5 = input => "object" === typeof input.data && null !== input.data && _io6(input.data); const _io6 = input => "object" === typeof input.repository && null !== input.repository && _io7(input.repository) && ("object" === typeof input.safeViewer && null !== input.safeViewer && _io63(input.safeViewer)); const _io7 = input => "boolean" === typeof input.isOwnerEnterpriseManaged && ("object" === typeof input.issue && null !== input.issue && _io8(input.issue)) && "string" === typeof input.id; const _io8 = input => "string" === typeof input.id && "string" === typeof input.updatedAt && "string" === typeof input.title && "number" === typeof input.number && ("object" === typeof input.repository && null !== input.repository && _io9(input.repository)) && "string" === typeof input.titleHTML && "string" === typeof input.url && "boolean" === typeof input.viewerCanUpdateNext && (null === input.issueType || "string" === typeof input.issueType) && ("OPEN" === input.state || "CLOSED" === input.state) && (null === input.stateReason || "string" === typeof input.stateReason) && ("object" === typeof input.linkedPullRequests && null !== input.linkedPullRequests && _io16(input.linkedPullRequests)) && ("object" === typeof input.subIssuesSummary && null !== input.subIssuesSummary && _io17(input.subIssuesSummary)) && "string" === typeof input.__isLabelable && ("object" === typeof input.labels && null !== input.labels && _io18(input.labels)) && "string" === typeof input.__isNode && ("object" === typeof input.assignedActors && null !== input.assignedActors && _io22(input.assignedActors)) && "number" === typeof input.databaseId && "boolean" === typeof input.viewerDidAuthor && "boolean" === typeof input.locked && ("object" === typeof input.author && null !== input.author && _io24(input.author)) && "string" === typeof input.__isComment && "string" === typeof input.body && "string" === typeof input.bodyHTML && "string" === typeof input.bodyVersion && "string" === typeof input.createdAt && "string" === typeof input.__isReactable && (Array.isArray(input.reactionGroups) && input.reactionGroups.every(elem => "object" === typeof elem && null !== elem && _io25(elem))) && "boolean" === typeof input.viewerCanUpdateMetadata && "boolean" === typeof input.viewerCanComment && "boolean" === typeof input.viewerCanAssign && "boolean" === typeof input.viewerCanLabel && "string" === typeof input.__isIssueOrPullRequest && ("object" === typeof input.projectItemsNext && null !== input.projectItemsNext && _io27(input.projectItemsNext)) && "boolean" === typeof input.viewerCanSetMilestone && "boolean" === typeof input.isPinned && "boolean" === typeof input.viewerCanDelete && "boolean" === typeof input.viewerCanTransfer && "boolean" === typeof input.viewerCanConvertToDiscussion && "boolean" === typeof input.viewerCanLock && "boolean" === typeof input.viewerCanType && ("object" === typeof input.frontTimelineItems && null !== input.frontTimelineItems && _io35(input.frontTimelineItems)) && ("object" === typeof input.backTimelineItems && null !== input.backTimelineItems && _io60(input.backTimelineItems)); const _io9 = input => "string" === typeof input.nameWithOwner && "string" === typeof input.id && "string" === typeof input.name && ("object" === typeof input.owner && null !== input.owner && _io10(input.owner)) && "boolean" === typeof input.isArchived && "boolean" === typeof input.isPrivate && "number" === typeof input.databaseId && "boolean" === typeof input.slashCommandsEnabled && "boolean" === typeof input.viewerCanInteract && "string" === typeof input.viewerInteractionLimitReasonHTML && ("object" === typeof input.planFeatures && null !== input.planFeatures && _io11(input.planFeatures)) && "string" === typeof input.visibility && ("object" === typeof input.pinnedIssues && null !== input.pinnedIssues && _io12(input.pinnedIssues)) && "boolean" === typeof input.viewerCanPinIssues && (null === input.issueTypes || "object" === typeof input.issueTypes && null !== input.issueTypes && _io13(input.issueTypes)); const _io10 = input => ("User" === input.__typename || "Organization" === input.__typename) && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.url; const _io11 = input => "number" === typeof input.maximumAssignees; const _io12 = input => "number" === typeof input.totalCount; const _io13 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io14(elem)); const _io14 = input => "object" === typeof input.node && null !== input.node && _io15(input.node); const _io15 = input => "string" === typeof input.id; const _io16 = input => Array.isArray(input.nodes); const _io17 = input => "number" === typeof input.total && "number" === typeof input.completed; const _io18 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io19(elem)) && ("object" === typeof input.pageInfo && null !== input.pageInfo && _io21(input.pageInfo)); const _io19 = input => "object" === typeof input.node && null !== input.node && _io20(input.node) && "string" === typeof input.cursor; const _io20 = input => "string" === typeof input.id && "string" === typeof input.color && "string" === typeof input.name && "string" === typeof input.nameHTML && "string" === typeof input.description && "string" === typeof input.url && "string" === typeof input.__typename; const _io21 = input => (null === input.endCursor || "string" === typeof input.endCursor) && "boolean" === typeof input.hasNextPage; const _io22 = input => Array.isArray(input.nodes) && input.nodes.every(elem => "object" === typeof elem && null !== elem && _io23(elem)); const _io23 = input => "string" === typeof input.__typename && "string" === typeof input.__isActor && "string" === typeof input.id && "string" === typeof input.login && "string" === typeof input.name && "string" === typeof input.profileResourcePath && "string" === typeof input.avatarUrl && "string" === typeof input.__isNode; const _io24 = input => "string" === typeof input.__typename && "string" === typeof input.__isActor && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.profileUrl && "string" === typeof input.avatarUrl; const _io25 = input => "string" === typeof input.content && "boolean" === typeof input.viewerHasReacted && ("object" === typeof input.reactors && null !== input.reactors && _io26(input.reactors)); const _io26 = input => "number" === typeof input.totalCount && Array.isArray(input.nodes); const _io27 = input => Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io28(elem)) && ("object" === typeof input.pageInfo && null !== input.pageInfo && _io34(input.pageInfo)); const _io28 = input => "object" === typeof input.node && null !== input.node && _io29(input.node) && "string" === typeof input.cursor; const _io29 = input => "string" === typeof input.id && "boolean" === typeof input.isArchived && ("object" === typeof input.project && null !== input.project && _io30(input.project)) && ("object" === typeof input.fieldValueByName && null !== input.fieldValueByName && _io33(input.fieldValueByName)) && "string" === typeof input.__typename; const _io30 = input => "string" === typeof input.id && "string" === typeof input.title && "boolean" === typeof input.template && "boolean" === typeof input.viewerCanUpdate && "string" === typeof input.url && ("object" === typeof input.field && null !== input.field && _io31(input.field)) && "boolean" === typeof input.closed && "number" === typeof input.number && "boolean" === typeof input.hasReachedItemsLimit && "string" === typeof input.__typename; const _io31 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.name && (Array.isArray(input.options) && input.options.every(elem => "object" === typeof elem && null !== elem && _io32(elem))) && "string" === typeof input.__isNode; const _io32 = input => "string" === typeof input.id && "string" === typeof input.optionId && "string" === typeof input.name && "string" === typeof input.nameHTML && "string" === typeof input.color && "string" === typeof input.descriptionHTML && "string" === typeof input.description; const _io33 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.optionId && "string" === typeof input.name && "string" === typeof input.nameHTML && "string" === typeof input.color && "string" === typeof input.__isNode; const _io34 = input => "string" === typeof input.endCursor && "boolean" === typeof input.hasNextPage; const _io35 = input => "object" === typeof input.pageInfo && null !== input.pageInfo && _io36(input.pageInfo) && "number" === typeof input.totalCount && (Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io37(elem))); const _io36 = input => "boolean" === typeof input.hasNextPage && "string" === typeof input.endCursor; const _io37 = input => "object" === typeof input.node && null !== input.node && _iu0(input.node) && "string" === typeof input.cursor; const _io38 = input => "AssignedEvent" === input.__typename && "string" === typeof input.__isIssueTimelineItems && (undefined === input.__isTimelineEvent || "string" === typeof input.__isTimelineEvent) && "number" === typeof input.databaseId && "string" === typeof input.createdAt && ("object" === typeof input.actor && null !== input.actor && _io39(input.actor)) && "string" === typeof input.__isNode && "string" === typeof input.id && ("object" === typeof input.assignee && null !== input.assignee && _io40(input.assignee)); const _io39 = input => ("User" === input.__typename || "Bot" === input.__typename || "Organization" === input.__typename) && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.__isActor && "string" === typeof input.avatarUrl && (undefined === input.profileResourcePath || "string" === typeof input.profileResourcePath) && (undefined === input.isCopilot || "boolean" === typeof input.isCopilot); const _io40 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.__isNode && "string" === typeof input.__isActor && "string" === typeof input.login && "string" === typeof input.resourcePath; const _io41 = input => "AddedToProjectV2Event" === input.__typename && "string" === typeof input.__isIssueTimelineItems && (undefined === input.__isTimelineEvent || "string" === typeof input.__isTimelineEvent) && "number" === typeof input.databaseId && "string" === typeof input.createdAt && ("object" === typeof input.actor && null !== input.actor && _io39(input.actor)) && "string" === typeof input.__isNode && "string" === typeof input.id && ("object" === typeof input.project && null !== input.project && _io42(input.project)); const _io42 = input => "string" === typeof input.title && "string" === typeof input.url && "string" === typeof input.id; const _io43 = input => "RemovedFromProjectV2Event" === input.__typename && "string" === typeof input.__isIssueTimelineItems && (undefined === input.__isTimelineEvent || "string" === typeof input.__isTimelineEvent) && "number" === typeof input.databaseId && "string" === typeof input.createdAt && ("object" === typeof input.actor && null !== input.actor && _io39(input.actor)) && "string" === typeof input.__isNode && "string" === typeof input.id && ("object" === typeof input.project && null !== input.project && _io44(input.project)); const _io44 = input => "string" === typeof input.title && "string" === typeof input.url && "string" === typeof input.id; const _io45 = input => "ProjectV2ItemStatusChangedEvent" === input.__typename && "string" === typeof input.__isIssueTimelineItems && (undefined === input.__isTimelineEvent || "string" === typeof input.__isTimelineEvent) && "number" === typeof input.databaseId && "string" === typeof input.createdAt && ("object" === typeof input.actor && null !== input.actor && _io39(input.actor)) && "string" === typeof input.__isNode && "string" === typeof input.id && "string" === typeof input.previousStatus && "string" === typeof input.status && ("object" === typeof input.project && null !== input.project && _io46(input.project)); const _io46 = input => "string" === typeof input.title && "string" === typeof input.url && "string" === typeof input.id; const _io47 = input => "RenamedTitleEvent" === input.__typename && "string" === typeof input.__isIssueTimelineItems && (undefined === input.__isTimelineEvent || "string" === typeof input.__isTimelineEvent) && "number" === typeof input.databaseId && "string" === typeof input.createdAt && ("object" === typeof input.actor && null !== input.actor && _io39(input.actor)) && "string" === typeof input.__isNode && "string" === typeof input.id && "string" === typeof input.currentTitle && "string" === typeof input.previousTitle; const _io48 = input => "LabeledEvent" === input.__typename && "string" === typeof input.__isIssueTimelineItems && (undefined === input.__isTimelineEvent || "string" === typeof input.__isTimelineEvent) && "number" === typeof input.databaseId && "string" === typeof input.createdAt && ("object" === typeof input.actor && null !== input.actor && _io39(input.actor)) && "string" === typeof input.__isNode && "string" === typeof input.id && ("object" === typeof input.label && null !== input.label && _io49(input.label)); const _io49 = input => "string" === typeof input.id && "string" === typeof input.nameHTML && "string" === typeof input.name && "string" === typeof input.color && "string" === typeof input.description; const _io50 = input => "UnlabeledEvent" === input.__typename && "string" === typeof input.__isIssueTimelineItems && (undefined === input.__isTimelineEvent || "string" === typeof input.__isTimelineEvent) && "number" === typeof input.databaseId && "string" === typeof input.createdAt && ("object" === typeof input.actor && null !== input.actor && _io39(input.actor)) && "string" === typeof input.__isNode && "string" === typeof input.id && ("object" === typeof input.label && null !== input.label && _io51(input.label)); const _io51 = input => "string" === typeof input.id && "string" === typeof input.nameHTML && "string" === typeof input.name && "string" === typeof input.color && "string" === typeof input.description; const _io52 = input => "IssueComment" === input.__typename && "string" === typeof input.__isIssueTimelineItems && "number" === typeof input.databaseId && "boolean" === typeof input.viewerDidAuthor && ("object" === typeof input.issue && null !== input.issue && _io53(input.issue)) && ("object" === typeof input.author && null !== input.author && _io55(input.author)) && "string" === typeof input.id && "string" === typeof input.body && "string" === typeof input.bodyHTML && "string" === typeof input.bodyVersion && "boolean" === typeof input.viewerCanUpdate && "string" === typeof input.url && "string" === typeof input.createdAt && "string" === typeof input.authorAssociation && "boolean" === typeof input.viewerCanDelete && "boolean" === typeof input.viewerCanMinimize && "boolean" === typeof input.viewerCanReport && "boolean" === typeof input.viewerCanReportToMaintainer && "boolean" === typeof input.viewerCanBlockFromOrg && "boolean" === typeof input.viewerCanUnblockFromOrg && "boolean" === typeof input.isHidden && (null === input.minimizedReason || "string" === typeof input.minimizedReason) && "boolean" === typeof input.showSpammyBadge && "boolean" === typeof input.createdViaEmail && ("object" === typeof input.repository && null !== input.repository && _io56(input.repository)) && "string" === typeof input.__isComment && "boolean" === typeof input.viewerCanReadUserContentEdits && (null === input.lastEditedAt || "string" === typeof input.lastEditedAt) && "string" === typeof input.__isReactable && (Array.isArray(input.reactionGroups) && input.reactionGroups.every(elem => "object" === typeof elem && null !== elem && _io58(elem))) && "string" === typeof input.__isNode; const _io53 = input => "object" === typeof input.author && null !== input.author && _io54(input.author) && "string" === typeof input.id && "number" === typeof input.number && "boolean" === typeof input.locked && "number" === typeof input.databaseId; const _io54 = input => "string" === typeof input.__typename && "string" === typeof input.login && "string" === typeof input.id; const _io55 = input => "string" === typeof input.__typename && "string" === typeof input.login && "string" === typeof input.avatarUrl && "string" === typeof input.profileUrl && "string" === typeof input.id; const _io56 = input => "string" === typeof input.id && "string" === typeof input.name && ("object" === typeof input.owner && null !== input.owner && _io57(input.owner)) && "boolean" === typeof input.isPrivate && "boolean" === typeof input.slashCommandsEnabled && "string" === typeof input.nameWithOwner && "number" === typeof input.databaseId; const _io57 = input => "string" === typeof input.__typename && "string" === typeof input.id && "string" === typeof input.login && "string" === typeof input.url; const _io58 = input => "string" === typeof input.content && "boolean" === typeof input.viewerHasReacted && ("object" === typeof input.reactors && null !== input.reactors && _io59(input.reactors)); const _io59 = input => "number" === typeof input.totalCount && Array.isArray(input.nodes); const _io60 = input => "object" === typeof input.pageInfo && null !== input.pageInfo && _io61(input.pageInfo) && "number" === typeof input.totalCount && (Array.isArray(input.edges) && input.edges.every(elem => "object" === typeof elem && null !== elem && _io62(elem))); const _io61 = input => "boolean" === typeof input.hasPreviousPage && (null === input.startCursor || "string" === typeof input.startCursor); const _io62 = input => "object" === typeof input.node && null !== input.node && _iu0(input.node) && "string" === typeof input.cursor; const _io63 = input => "boolean" === typeof input.isEnterpriseManagedUser && (undefined !== input.enterpriseManagedEnterpriseId && null === input.enterpriseManagedEnterpriseId) && "string" === typeof input.login && "string" === typeof input.id && "string" === typeof input.avatarUrl && "string" === typeof input.__isActor && "string" === typeof input.__typename && (null === input.name || "string" === typeof input.name) && "string" === typeof input.profileResourcePath; const _io64 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return "object" === typeof value && null !== value && false === Array.isArray(value) && _io65(value);
            }); const _io65 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return "object" === typeof value && null !== value && _io66(value);
            }); const _io66 = input => "object" === typeof input.response && null !== input.response && _io67(input.response) && "string" === typeof input.subscriptionId; const _io67 = input => "object" === typeof input.data && null !== input.data && _io68(input.data); const _io68 = input => "object" === typeof input.issueUpdated && null !== input.issueUpdated && _io69(input.issueUpdated); const _io69 = input => undefined !== input.deletedCommentId && null === input.deletedCommentId && (undefined !== input.issueBodyUpdated && null === input.issueBodyUpdated) && (undefined !== input.issueMetadataUpdated && null === input.issueMetadataUpdated) && (undefined !== input.issueStateUpdated && null === input.issueStateUpdated) && (undefined !== input.issueTimelineUpdated && null === input.issueTimelineUpdated) && (undefined !== input.issueTitleUpdated && null === input.issueTitleUpdated) && (undefined !== input.issueReactionUpdated && null === input.issueReactionUpdated) && (undefined !== input.issueTransferStateUpdated && null === input.issueTransferStateUpdated) && (undefined !== input.issueTypeUpdated && null === input.issueTypeUpdated) && (undefined !== input.commentReactionUpdated && null === input.commentReactionUpdated) && (undefined !== input.commentUpdated && null === input.commentUpdated) && (undefined !== input.subIssuesUpdated && null === input.subIssuesUpdated) && (undefined !== input.subIssuesSummaryUpdated && null === input.subIssuesSummaryUpdated) && (undefined !== input.parentIssueUpdated && null === input.parentIssueUpdated) && (undefined !== input.issueDependenciesSummaryUpdated && null === input.issueDependenciesSummaryUpdated); const _io70 = input => (undefined === input.initial_view_content || "object" === typeof input.initial_view_content && null !== input.initial_view_content && _io71(input.initial_view_content)) && (undefined === input.current_user || "object" === typeof input.current_user && null !== input.current_user && _io72(input.current_user)) && (undefined === input.current_user_settings || "object" === typeof input.current_user_settings && null !== input.current_user_settings && _io73(input.current_user_settings)) && (undefined === input.paste_url_link_as_plain_text || "boolean" === typeof input.paste_url_link_as_plain_text) && (undefined === input.base_avatar_url || "string" === typeof input.base_avatar_url) && (undefined === input.help_url || "string" === typeof input.help_url) && (null === input.sso_organizations || undefined === input.sso_organizations) && (undefined === input.multi_tenant || "boolean" === typeof input.multi_tenant) && (undefined === input.tracing || "boolean" === typeof input.tracing) && (undefined === input.tracing_flamegraph || "boolean" === typeof input.tracing_flamegraph) && (undefined === input.catalog_service || "string" === typeof input.catalog_service) && (undefined === input.scoped_repository || "object" === typeof input.scoped_repository && null !== input.scoped_repository && _io74(input.scoped_repository)) && (null === input.copilot_api_url || undefined === input.copilot_api_url) && (undefined === input.enabled_features || "object" === typeof input.enabled_features && null !== input.enabled_features && false === Array.isArray(input.enabled_features) && _io75(input.enabled_features)); const _io71 = input => undefined !== input.team_id && null === input.team_id && "boolean" === typeof input.can_edit_view; const _io72 = input => "string" === typeof input.id && "string" === typeof input.login && "string" === typeof input.avatarUrl && "boolean" === typeof input.is_staff && "boolean" === typeof input.is_emu; const _io73 = input => "boolean" === typeof input.use_monospace_font && "boolean" === typeof input.use_single_key_shortcut && "number" === typeof input.preferred_emoji_skin_tone; const _io74 = input => "string" === typeof input.id && "string" === typeof input.owner && "string" === typeof input.name && "boolean" === typeof input.is_archived; const _io75 = input => Object.keys(input).every(key => {
                const value = input[key];
                if (undefined === value)
                    return true;
                return "boolean" === typeof value;
            }); const _iu0 = input => (() => {
                if ("AssignedEvent" === input.__typename)
                    return _io38(input);
                else if ("RemovedFromProjectV2Event" === input.__typename)
                    return _io43(input);
                else if ("AddedToProjectV2Event" === input.__typename)
                    return _io41(input);
                else if ("ProjectV2ItemStatusChangedEvent" === input.__typename)
                    return _io45(input);
                else if ("RenamedTitleEvent" === input.__typename)
                    return _io47(input);
                else if ("UnlabeledEvent" === input.__typename)
                    return _io50(input);
                else if ("LabeledEvent" === input.__typename)
                    return _io48(input);
                else if ("IssueComment" === input.__typename)
                    return _io52(input);
                else
                    return false;
            })(); return input => "object" === typeof input && null !== input && _io0(input); })()(data)) {
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