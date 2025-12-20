import axios from 'axios';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import typia from 'typia';
import {
  getInProgressTimeline,
  IssueStatusTimeline,
} from './issueTimelineUtils';
import { Issue } from './CheerioIssueRepository';

type IssueTypeData = {
  name: string;
  color: string;
  id: string;
  isEnabled?: boolean;
  description?: string;
};

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

type GitHubIssueQuery = {
  queryId: string;
  queryName: string;
  variables: {
    id: string;
    number: number;
    owner: string;
    repo: string;
  };
  result: {
    data: {
      repository: {
        isOwnerEnterpriseManaged: boolean;
        issue: IssueData;
        id: string;
      };
      safeViewer: {
        isEnterpriseManagedUser: boolean;
        enterpriseManagedEnterpriseId: null;
        login: string;
        id: string;
        avatarUrl: string;
        __isActor: string;
        __typename: string;
        name: string | null;
        profileResourcePath: string;
      };
    };
  };
  timestamp: number;
};

type IssueUpdateSubscriptionResponse = {
  response: {
    data: {
      issueUpdated: {
        deletedCommentId: unknown;
        issueBodyUpdated: unknown;
        issueMetadataUpdated: unknown;
        issueStateUpdated: unknown;
        issueTimelineUpdated: unknown;
        issueTitleUpdated: unknown;
        issueReactionUpdated: unknown;
        issueTransferStateUpdated: unknown;
        issueTypeUpdated: unknown;
        commentReactionUpdated: unknown;
        commentUpdated: unknown;
        subIssuesUpdated: unknown;
        subIssuesSummaryUpdated: unknown;
        parentIssueUpdated: unknown;
        issueDependenciesSummaryUpdated: unknown;
      };
    };
  };
  subscriptionId: string;
};

type GitHubBetaFeatureViewData = {
  payload: {
    preloaded_records?: Record<string, unknown>;
    preloadedQueries: [GitHubIssueQuery];
    preloadedSubscriptions?: Record<
      string,
      Record<string, IssueUpdateSubscriptionResponse>
    >;
  };
  title?: unknown;
  appPayload?: {
    initial_view_content?: {
      team_id?: unknown;
      can_edit_view?: boolean;
      [key: string]: unknown;
    };
    current_user?: {
      id: string;
      login: string;
      avatarUrl: string;
      is_staff: boolean;
      is_emu: boolean;
      name?: unknown;
      [key: string]: unknown;
    };
    current_user_settings?: {
      use_monospace_font?: boolean;
      use_single_key_shortcut?: boolean;
      preferred_emoji_skin_tone?: number;
      copilot_show_functionality?: boolean;
      [key: string]: unknown;
    };
    paste_url_link_as_plain_text?: boolean;
    base_avatar_url?: string;
    help_url?: string;
    sso_organizations?: unknown;
    current_sso_orgs_match_dismissed_cookie?: unknown;
    multi_tenant?: boolean;
    tracing?: boolean;
    tracing_flamegraph?: boolean;
    catalog_service?: string;
    scoped_repository?: {
      id: string;
      owner: string;
      name: string;
      is_archived: boolean;
      [key: string]: unknown;
    };
    semantic_search_enrolled?: boolean;
    semantic_search_feedback_url?: unknown;
    copilot_api_url?: unknown;
    enabled_features?: Record<string, boolean>;
    [key: string]: unknown;
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
export class InternalGraphqlIssueRepository extends BaseGitHubRepository {
  getFrontTimelineItems = async (
    issueUrl: string,
    cursor: string | null,
    issueId: string,
    maxCount: number = 9999,
  ): Promise<
    GraphqlResponse['data']['node']['frontTimelineItems']['edges']
  > => {
    const query = 'f6ff036f8e215bd07d00516664e8725c';
    const callQuery = async (
      query: string,
      count: number | null,
      cursor: string | null,
      issueId: string,
    ): Promise<GraphqlResponse['data']['node']['frontTimelineItems']> => {
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
        'sec-ch-ua':
          '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        cookie: await this.getCookie(),
      };

      for (let i = 0; i < 3; i++) {
        try {
          const response = await axios.get<GraphqlResponse>(url, {
            headers: headers,
            withCredentials: true,
          });
          if (!response.data?.data?.node?.frontTimelineItems) {
            throw new Error(
              `No frontTimelineItems found. URL: ${issueUrl}, Response: ${JSON.stringify(
                response.data,
              )}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return response.data.data.node.frontTimelineItems;
        } catch (e) {
          if (i === 2) {
            throw e;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
      throw new Error('Unreachable');
    };

    const frontTimelineItems: GraphqlResponse['data']['node']['frontTimelineItems']['edges'] =
      [];
    let nextCursor = cursor;
    const maxCountPerRequest = 250;
    while (frontTimelineItems.length < maxCount) {
      const response = await callQuery(
        query,
        maxCountPerRequest,
        nextCursor,
        issueId,
      );
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
  getIssueFromBetaFeatureView = async (
    issueUrl: string,
    html: string,
  ): Promise<Issue> => {
    const pattern =
      /<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/;
    const match = html.match(pattern);

    if (!match || !match[1]) {
      throw new Error(
        `No script content found. URL: ${issueUrl}, HTML: ${html}`,
      );
    }
    const scriptContent = match[1];
    if (!scriptContent) {
      throw new Error('No script content found');
    }
    const data: unknown = JSON.parse(scriptContent);
    if (!typia.is<GitHubBetaFeatureViewData>(data)) {
      const validateResult = typia.validate<GitHubBetaFeatureViewData>(data);
      throw new Error(
        `Invalid data: validateResult: ${JSON.stringify(validateResult)}, data: ${JSON.stringify(data)}`,
      );
    }
    const issueData =
      data.payload.preloadedQueries[0].result.data.repository.issue;
    const issueRemainingCount =
      issueData.frontTimelineItems.totalCount -
      issueData.frontTimelineItems.edges.length -
      issueData.backTimelineItems.edges.length;
    const loadedMoreIssues = issueUrl.includes('/pull/')
      ? []
      : await this.getFrontTimelineItems(
          issueUrl,
          issueData.frontTimelineItems.pageInfo.endCursor,
          issueData.id,
          issueRemainingCount,
        );
    const statusTimeline = issueData.frontTimelineItems.edges
      .concat(loadedMoreIssues)
      .concat(issueData.backTimelineItems.edges)
      .filter(
        (edge, index, self) =>
          self.findIndex(
            (t) => !!t.node && !!edge.node && t.node.id === edge.node.id,
          ) === index,
      )
      .filter(
        (
          edge,
        ): edge is {
          node: ProjectV2ItemStatusChangedEventNode;
          cursor: string;
        } =>
          !!edge.node &&
          edge.node.__typename === 'ProjectV2ItemStatusChangedEvent',
      )
      .map(
        (edge): IssueStatusTimeline => ({
          time: edge.node.createdAt,
          author: edge.node.actor?.login || '',
          from: edge.node.previousStatus || '',
          to: edge.node.status || '',
        }),
      );
    const inProgressTimeline = await getInProgressTimeline(
      statusTimeline,
      issueUrl,
    );
    return {
      url: issueUrl,
      title: issueData.title,
      status:
        statusTimeline.length > 0
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
