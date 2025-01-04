import axios from 'axios';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import typia from 'typia';
import {
  getInProgressTimeline,
  IssueStatusTimeline,
} from './issueTimelineUtils';
import { Issue } from './CheerioIssueRepository';

type GitHubBetaFeatureViewData = {
  payload: {
    preloadedQueries: [
      {
        variables: {
          owner: string;
          repo: string;
          number: number;
        };
        result: {
          data: {
            repository: {
              issue: {
                id: string;
                title: string;
                state: string;
                assignees: {
                  nodes: Array<{
                    login: string;
                  }>;
                };
                labels: {
                  edges: Array<{
                    node: {
                      name: string;
                    };
                  }>;
                };
                projectItemsNext: {
                  edges: Array<{
                    node: {
                      project: {
                        title: string;
                      };
                    };
                  }>;
                };
                frontTimelineItems: {
                  edges: Array<{
                    node: {
                      __typename: string;
                      id: string;
                    };
                  }>;
                  pageInfo: {
                    hasNextPage: boolean;
                    endCursor: string;
                  };
                  totalCount: number;
                };
                backTimelineItems: {
                  edges: Array<{
                    node: {
                      __typename: string;
                      id: string;
                    };
                  }>;
                };
              };
            };
          };
        };
      },
    ];
  };
};

type ProjectV2ItemStatusChangedEvent = BaseTimelineItem & {
  __typename: 'ProjectV2ItemStatusChangedEvent';
  id: string;
  createdAt: string;
  actor: {
    login: string;
  };
  previousStatus: string;
  status: string;
};
type BaseUser = {
  __typename: 'User';
  login: string;
  id: string;
  __isActor: 'User';
  avatarUrl: string;
};

type BaseTimelineItem = {
  __typename: string;
  __isIssueTimelineItems: string;
  __isTimelineEvent: string;
  databaseId: number;
  createdAt: string;
  actor: BaseUser;
  __isNode: string;
  id: string;
};

type GraphqlResponse = {
  data: {
    node: {
      __typename: 'Issue';
      frontTimelineItems: GitHubBetaFeatureViewData['payload']['preloadedQueries'][0]['result']['data']['repository']['issue']['frontTimelineItems'];
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
    let remainingCount = maxCount;
    while (frontTimelineItems.length < maxCount) {
      const response = await callQuery(
        query,
        remainingCount,
        nextCursor,
        issueId,
      );
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
      throw new Error(`Invalid data: ${JSON.stringify(data)}`);
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
          self.findIndex((t) => t.node.id === edge.node.id) === index,
      )
      .filter(
        (edge): edge is { node: ProjectV2ItemStatusChangedEvent } =>
          edge.node.__typename === 'ProjectV2ItemStatusChangedEvent',
      )
      .map(
        (edge): IssueStatusTimeline => ({
          time: edge.node.createdAt,
          author: edge.node.actor?.login || '',
          from: edge.node.previousStatus,
          to: edge.node.status,
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
      assignees: issueData.assignees.nodes.map((node) => node.login),
      labels: issueData.labels.edges.map((edge) => edge.node.name),
      project: issueData.projectItemsNext.edges[0].node.project.title,
      statusTimeline,
      inProgressTimeline,
    };
  };
}
