import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from './CheerioIssueRepository';
type TimelineActor = {
    __typename: 'User' | 'Bot' | 'Organization';
    login: string;
    id: string;
    __isActor: string;
    avatarUrl: string;
    profileResourcePath?: string;
    isCopilot?: boolean;
};
type BaseTimelineNode = {
    __typename: string;
    __isIssueTimelineItems: string;
    __isTimelineEvent?: string;
    databaseId: number;
    createdAt: string;
    actor: TimelineActor;
    __isNode: string;
    id: string;
};
type AssignedEventNode = BaseTimelineNode & {
    __typename: 'AssignedEvent';
    assignee: {
        __typename: string;
        id: string;
        __isNode: string;
        __isActor: string;
        login: string;
        resourcePath: string;
    };
};
type AddedToProjectV2EventNode = BaseTimelineNode & {
    __typename: 'AddedToProjectV2Event';
    project: {
        title: string;
        url: string;
        id: string;
    };
};
type RemovedFromProjectV2EventNode = BaseTimelineNode & {
    __typename: 'RemovedFromProjectV2Event';
    project: {
        title: string;
        url: string;
        id: string;
    };
};
type ProjectV2ItemStatusChangedEventNode = BaseTimelineNode & {
    __typename: 'ProjectV2ItemStatusChangedEvent';
    previousStatus: string;
    status: string;
    project: {
        title: string;
        url: string;
        id: string;
    };
};
type RenamedTitleEventNode = BaseTimelineNode & {
    __typename: 'RenamedTitleEvent';
    currentTitle: string;
    previousTitle: string;
};
type LabeledEventNode = BaseTimelineNode & {
    __typename: 'LabeledEvent';
    label: {
        id: string;
        nameHTML: string;
        name: string;
        color: string;
        description: string;
    };
};
type UnlabeledEventNode = BaseTimelineNode & {
    __typename: 'UnlabeledEvent';
    label: {
        id: string;
        nameHTML: string;
        name: string;
        color: string;
        description: string;
    };
};
type IssueCommentNode = {
    __typename: 'IssueComment';
    __isIssueTimelineItems: string;
    databaseId: number;
    viewerDidAuthor: boolean;
    issue: {
        author: {
            __typename: string;
            login: string;
            id: string;
        };
        id: string;
        number: number;
        locked: boolean;
        databaseId: number;
    };
    author: {
        __typename: string;
        login: string;
        avatarUrl: string;
        profileUrl: string;
        id: string;
    };
    id: string;
    body: string;
    bodyHTML: string;
    bodyVersion: string;
    viewerCanUpdate: boolean;
    url: string;
    createdAt: string;
    authorAssociation: string;
    viewerCanDelete: boolean;
    viewerCanMinimize: boolean;
    viewerCanReport: boolean;
    viewerCanReportToMaintainer: boolean;
    viewerCanBlockFromOrg: boolean;
    viewerCanUnblockFromOrg: boolean;
    isHidden: boolean;
    minimizedReason: string | null;
    showSpammyBadge: boolean;
    createdViaEmail: boolean;
    repository: {
        id: string;
        name: string;
        owner: {
            __typename: string;
            id: string;
            login: string;
            url: string;
        };
        isPrivate: boolean;
        slashCommandsEnabled: boolean;
        nameWithOwner: string;
        databaseId: number;
    };
    __isComment: string;
    viewerCanReadUserContentEdits: boolean;
    lastEditedAt: string | null;
    __isReactable: string;
    reactionGroups: Array<{
        content: string;
        viewerHasReacted: boolean;
        reactors: {
            totalCount: number;
            nodes: Array<unknown>;
        };
    }>;
    __isNode: string;
};
type TimelineItem = AssignedEventNode | AddedToProjectV2EventNode | RemovedFromProjectV2EventNode | ProjectV2ItemStatusChangedEventNode | RenamedTitleEventNode | LabeledEventNode | UnlabeledEventNode | IssueCommentNode;
type LabelNode = {
    id: string;
    color: string;
    name: string;
    nameHTML: string;
    description: string;
    url: string;
    __typename: string;
};
type IssueData = {
    id: string;
    updatedAt: string;
    title: string;
    number: number;
    repository: {
        nameWithOwner: string;
        id: string;
        name: string;
        owner: {
            __typename: 'User' | 'Organization';
            login: string;
            id: string;
            url: string;
        };
        isArchived: boolean;
        isPrivate: boolean;
        databaseId: number;
        slashCommandsEnabled: boolean;
        viewerCanInteract: boolean;
        viewerInteractionLimitReasonHTML: string;
        planFeatures: {
            maximumAssignees: number;
        };
        visibility: string;
        pinnedIssues: {
            totalCount: number;
        };
        viewerCanPinIssues: boolean;
        issueTypes: null | {
            edges: Array<{
                node: {
                    id: string;
                };
            }>;
        };
    };
    titleHTML: string;
    url: string;
    viewerCanUpdateNext: boolean;
    issueType: null | string;
    state: 'OPEN' | 'CLOSED';
    stateReason: string | null;
    linkedPullRequests: {
        nodes: Array<unknown>;
    };
    subIssuesSummary: {
        total: number;
        completed: number;
    };
    __isLabelable: string;
    labels: {
        edges: Array<{
            node: LabelNode;
            cursor: string;
        }>;
        pageInfo: {
            endCursor: string | null;
            hasNextPage: boolean;
        };
    };
    __isNode: string;
    assignedActors: {
        nodes: Array<{
            __typename: string;
            __isActor: string;
            id: string;
            login: string;
            name: string;
            profileResourcePath: string;
            avatarUrl: string;
            __isNode: string;
        }>;
    };
    databaseId: number;
    viewerDidAuthor: boolean;
    locked: boolean;
    author: {
        __typename: string;
        __isActor: string;
        login: string;
        id: string;
        profileUrl: string;
        avatarUrl: string;
    };
    __isComment: string;
    body: string;
    bodyHTML: string;
    bodyVersion: string;
    createdAt: string;
    __isReactable: string;
    reactionGroups: Array<{
        content: string;
        viewerHasReacted: boolean;
        reactors: {
            totalCount: number;
            nodes: Array<unknown>;
        };
    }>;
    viewerCanUpdateMetadata: boolean;
    viewerCanComment: boolean;
    viewerCanAssign: boolean;
    viewerCanLabel: boolean;
    __isIssueOrPullRequest: string;
    projectItemsNext: {
        edges: Array<{
            node: {
                id: string;
                isArchived: boolean;
                project: {
                    id: string;
                    title: string;
                    template: boolean;
                    viewerCanUpdate: boolean;
                    url: string;
                    field: {
                        __typename: string;
                        id: string;
                        name: string;
                        options: Array<{
                            id: string;
                            optionId: string;
                            name: string;
                            nameHTML: string;
                            color: string;
                            descriptionHTML: string;
                            description: string;
                        }>;
                        __isNode: string;
                    };
                    closed: boolean;
                    number: number;
                    hasReachedItemsLimit: boolean;
                    __typename: string;
                };
                fieldValueByName: {
                    __typename: string;
                    id: string;
                    optionId: string;
                    name: string;
                    nameHTML: string;
                    color: string;
                    __isNode: string;
                };
                __typename: string;
            };
            cursor: string;
        }>;
        pageInfo: {
            endCursor: string;
            hasNextPage: boolean;
        };
    };
    viewerCanSetMilestone: boolean;
    isPinned: boolean;
    viewerCanDelete: boolean;
    viewerCanTransfer: boolean;
    viewerCanConvertToDiscussion: boolean;
    viewerCanLock: boolean;
    viewerCanType: boolean;
    frontTimelineItems: {
        pageInfo: {
            hasNextPage: boolean;
            endCursor: string;
        };
        totalCount: number;
        edges: Array<{
            node: TimelineItem;
            cursor: string;
        }>;
    };
    backTimelineItems: {
        pageInfo: {
            hasPreviousPage: boolean;
            startCursor: string | null;
        };
        totalCount: number;
        edges: Array<{
            node: TimelineItem;
            cursor: string;
        }>;
    };
};
type GraphqlResponse = {
    data: {
        node: {
            __typename: 'Issue';
            frontTimelineItems: IssueData['frontTimelineItems'];
            id: string;
        };
    };
};
export declare class InternalGraphqlIssueRepository extends BaseGitHubRepository {
    getFrontTimelineItems: (issueUrl: string, cursor: string | null, issueId: string, maxCount?: number) => Promise<GraphqlResponse["data"]["node"]["frontTimelineItems"]["edges"]>;
    getIssueFromBetaFeatureView: (issueUrl: string, html: string) => Promise<Issue>;
}
export {};
//# sourceMappingURL=InternalGraphqlIssueRepository.d.ts.map