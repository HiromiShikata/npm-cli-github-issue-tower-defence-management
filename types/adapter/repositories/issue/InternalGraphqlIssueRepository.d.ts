import { BaseGitHubRepository } from '../BaseGitHubRepository';
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
type GraphqlResponse = {
  data: {
    node: {
      __typename: 'Issue';
      frontTimelineItems: GitHubBetaFeatureViewData['payload']['preloadedQueries'][0]['result']['data']['repository']['issue']['frontTimelineItems'];
      id: string;
    };
  };
};
export declare class InternalGraphqlIssueRepository extends BaseGitHubRepository {
  removeIssueFromProject: (
    issueUrl: string,
    projectId: string,
  ) => Promise<void>;
  getFrontTimelineItems: (
    issueUrl: string,
    cursor: string | null,
    issueId: string,
    maxCount?: number,
  ) => Promise<GraphqlResponse['data']['node']['frontTimelineItems']['edges']>;
  getIssueFromBetaFeatureView: (
    issueUrl: string,
    html: string,
  ) => Promise<Issue>;
}
export {};
//# sourceMappingURL=InternalGraphqlIssueRepository.d.ts.map
