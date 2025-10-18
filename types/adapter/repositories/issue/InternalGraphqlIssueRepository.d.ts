import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from './CheerioIssueRepository';
type IssueTypeData = {
    name: string;
    color: string;
    id: string;
    isEnabled?: boolean;
    description?: string;
};
type LabelNode = {
    id: string;
    color: string;
    name: string;
    nameHTML: string;
    description: string | null;
    url: string;
    __typename: string;
};
type TimelineItem = {
    id: string;
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
        planFeatures?: {
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
    issueType: null | IssueTypeData;
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
                } | null;
                __typename: string;
            };
            cursor: string;
        }>;
        pageInfo: {
            endCursor: string | null;
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
            endCursor: string | null;
        };
        totalCount: number;
        edges: Array<{
            node: TimelineItem | null;
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
            node: TimelineItem | null;
            cursor: string;
        }>;
    };
    assignedActors: {
        nodes: Array<{
            __typename: string;
            __isActor: string;
            id: string;
            login: string;
            name: string | null;
            profileResourcePath: string;
            avatarUrl: string;
            __isNode: string;
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