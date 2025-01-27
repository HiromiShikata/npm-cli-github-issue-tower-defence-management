import { InternalGraphqlIssueRepository } from './InternalGraphqlIssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import axios from 'axios';

jest.mock('axios');
const mockedAxios: jest.Mocked<typeof axios> = {
  ...jest.mocked(axios),
  post: jest.fn(),
  get: jest.fn(),
  isAxiosError: jest.fn().mockImplementation(function <T = any, D = any>(payload: any): payload is import('axios').AxiosError<T, D> {
    return Boolean(
      payload && typeof payload === 'object' && 'isAxiosError' in payload,
    );
  }) as unknown as typeof axios.isAxiosError,
  create: jest.fn(),
  defaults: jest.mocked(axios).defaults,
};

// Mock all axios calls to return empty successful responses by default
beforeAll(() => {
  mockedAxios.post.mockResolvedValue({ data: { data: {} } });
  mockedAxios.get.mockResolvedValue({ data: {} });
});

interface GraphQLRequestData {
  query: string;
  variables: Record<string, unknown>;
}

describe('InternalGraphqlIssueRepository', () => {
  jest.setTimeout(30 * 1000);
  const localStorageRepository = new LocalStorageRepository();
  // Mock LocalStorageRepository
  const mockLocalStorageRepository = {
    ...localStorageRepository,
    write: jest.fn(),
    read: jest.fn().mockResolvedValue(
      JSON.stringify([
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: 'github.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
        },
      ]),
    ),
  };

  const repository = new InternalGraphqlIssueRepository(
    mockLocalStorageRepository,
    './tmp/github.com.cookies.json',
    process.env.GH_TOKEN || 'dummy-token',
    process.env.GH_USER_NAME || 'dummy-user',
    process.env.GH_USER_PASSWORD || 'dummy-pass',
    process.env.GH_AUTHENTICATOR_KEY || 'dummy-key',
  );

  // Mock the getCookie method after instantiation
  jest
    .spyOn(repository, 'getCookie')
    .mockResolvedValue('test-cookie=test-value');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockReset();
    jest
      .spyOn(repository, 'getCookie')
      .mockResolvedValue('test-cookie=test-value');

    // Mock successful authentication
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          viewer: {
            login: 'test-user',
          },
        },
      },
    });

    // Mock successful node query for getFrontTimelineItems
    mockedAxios.post.mockImplementation(
      async (_url: string, data?: unknown) => {
        if (!data || typeof data !== 'object') return { data: { data: {} } };

<<<<<<< HEAD
        if (!('query' in data) || typeof data.query !== 'string')
          return { data: { data: {} } };

        // Mock for GetProjectItem query
        if (data.query.includes('GetProjectItem')) {
          const variables = 'variables' in data ? data.variables : undefined;
          if (!variables || typeof variables !== 'object')
            return { data: { data: {} } };
          interface ProjectVars {
            owner?: string;
            repo?: string;
            number?: number;
            projectId?: string;
          }
          const isProjectVars = (v: unknown): v is ProjectVars => {
            if (!v || typeof v !== 'object') return false;
            if (
              !('owner' in v) &&
              !('repo' in v) &&
              !('number' in v) &&
              !('projectId' in v)
            )
              return false;
            const owner = 'owner' in v ? v.owner : undefined;
            const repo = 'repo' in v ? v.repo : undefined;
            const number = 'number' in v ? v.number : undefined;
            const projectId = 'projectId' in v ? v.projectId : undefined;
            return (
              (!owner || typeof owner === 'string') &&
              (!repo || typeof repo === 'string') &&
              (!number || typeof number === 'number') &&
              (!projectId || typeof projectId === 'string')
            );
          };
          if (!isProjectVars(variables)) return { data: { data: {} } };
          if (
            variables.owner === 'HiromiShikata' &&
            variables.repo === 'test-repository' &&
            variables.number === 38
          ) {
            return Promise.resolve({
              data: {
                data: {
                  repository: {
                    issue: {
                      projectItems: {
                        nodes: [{ id: 'PVTI_lADOCNXcUc4AXA1NzgA' }],
                      },
                    },
                  },
                },
              },
            });
          }
        }

        // Mock for RemoveProjectItem mutation
        if (data.query.includes('RemoveProjectItem')) {
||||||| 6704be8
      // Mock for GetProjectItem query
      if (data.query.includes('GetProjectItem')) {
        const variables = data.variables as { owner: string; repo: string; number: number; projectId: string };
        if (variables.owner === 'HiromiShikata' && variables.repo === 'test-repository' && variables.number === 38) {
=======
        const graphqlData = data as { query?: unknown };
        if (typeof graphqlData.query !== 'string') return { data: { data: {} } };

        // Mock for GetProjectItem query
        if (graphqlData.query.includes('GetProjectItem')) {
          const variables = (data as { variables?: unknown }).variables;
          if (!variables || typeof variables !== 'object') return { data: { data: {} } };
          const typedVars = variables as {
            owner?: string;
            repo?: string;
            number?: number;
            projectId?: string;
          };
          if (
            typedVars.owner === 'HiromiShikata' &&
            typedVars.repo === 'test-repository' &&
            typedVars.number === 38
          ) {
            return Promise.resolve({
              data: {
                data: {
                  repository: {
                    issue: {
                      projectItems: {
                        nodes: [{ id: 'PVTI_lADOCNXcUc4AXA1NzgA' }],
                      },
                    },
                  },
                },
              },
            });
          }
        }

        // Mock for RemoveProjectItem mutation
        if (graphqlData.query.includes('RemoveProjectItem')) {
>>>>>>> origin/devin/1737934731-add-remove-issue-from-project
          return Promise.resolve({
            data: {
              data: {
                removeProjectV2ItemFromProject: {
                  clientMutationId: 'test-mutation-id',
                },
              },
            },
          });
        }

        return Promise.resolve({ data: { data: {} } });
      },
    );
  });

  const testIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/38';
  const testCursor = null;
  const testIssueId = 'I_kwDOCNXcUc6GaFia';
  const testCount = 10;

  beforeAll(async () => {
    await repository.getCookie();
  });

  test('getFrontTimelineItems returns timeline with proper types', async () => {
    // Reset mock implementation for this specific test
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();

    // Mock the cookie response
    jest
      .spyOn(repository, 'getCookie')
      .mockResolvedValue('test-cookie=test-value');

    // Mock the timeline items response
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: {
          node: {
            id: testIssueId,
            frontTimelineItems: {
              edges: Array(testCount).fill({
                node: {
                  __typename: 'IssueComment',
                  createdAt: '2024-01-26T12:00:00Z',
                  body: 'Test comment',
                  id: 'test-comment-id',
                  databaseId: 1,
                  actor: {
                    __typename: 'User',
                    login: 'test-user',
                    id: 'test-user-id',
                    __isActor: 'User',
                    avatarUrl: 'https://example.com/avatar.png',
                  },
                  __isIssueTimelineItems: 'IssueComment',
                  __isTimelineEvent: 'IssueComment',
                  __isNode: 'IssueComment',
                },
              }),
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      },
    });

    const result = await repository.getFrontTimelineItems(
      testIssueUrl,
      testCursor,
      testIssueId,
      testCount,
    );
    expect(result).toBeDefined();
    expect(result.length).toEqual(testCount);
  });

  test('getIssueFromBetaFeatureView returns typed Issue object', async () => {
    const htmlContent = `
  <script type="application/json" data-target="react-app.embeddedData">{"payload":{"preloaded_records":{},"preloadedQueries":[{"queryId":"52bc607938179bfb6b15285c7d68285c","queryName":"IssueViewerViewQuery","variables":{"id":"repository","number":38,"owner":"HiromiShikata","repo":"test-repository","useNewTimeline":true},"result":{"data":{"repository":{"isOwnerEnterpriseManaged":false,"issue":{"id":"I_kwDOCNXcUc6GaFia","updatedAt":"2024-11-23T00:01:07Z","resourcePath":"/HiromiShikata/test-repository/issues/38","canBeSummarized":false,"subIssuesConnection":{"totalCount":0},"viewerCanUpdateMetadata":true,"repository":{"isArchived":false,"id":"R_kgDOHusmCw","nameWithOwner":"HiromiShikata/test-repository","name":"test-repository","owner":{"__typename":"Organization","login":"HiromiShikata","id":"MDEyOk9yZ2FuaXphdGlvbjc1MjM2NTUy","url":"https://github.com/HiromiShikata"},"isPrivate":true,"databaseId":518727179,"slashCommandsEnabled":true,"viewerCanInteract":true,"viewerInteractionLimitReasonHTML":"","planFeatures":{"maximumAssignees":10},"pinnedIssues":{"totalCount":0},"viewerCanPinIssues":true,"issueTypes":{"edges":[{"node":{"id":"IT_kwDOBHwEyM4A0REA"}},{"node":{"id":"IT_kwDOBHwEyM4A0REC"}},{"node":{"id":"IT_kwDOBHwEyM4A0REF"}}]}},"title":"Test title","number":38,"titleHTML":"Test title","url":"https://github.com/HiromiShikata/test-repository/issues/38","viewerCanUpdateNext":true,"issueType":null,"state":"OPEN","stateReason":null,"duplicateOf":null,"linkedPullRequests":{"nodes":[]},"subIssuesSummary":{"completed":0},"databaseId":2685000461,"viewerDidAuthor":true,"locked":false,"author":{"__typename":"User","__isActor":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?v=4","profileUrl":"https://github.com/HiromiShikata"},"__isComment":"Issue","body":"Test Body","bodyHTML":"Test Body","bodyVersion":"804513af29eabc52a58f62e24db7fe7f8e3a8179d770138f3cba77fb3fa2b77d","createdAt":"2024-11-23T00:01:07Z","__isReactable":"Issue","reactionGroups":[{"content":"THUMBS_UP","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"THUMBS_DOWN","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"LAUGH","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"HOORAY","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"CONFUSED","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"HEART","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"ROCKET","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"EYES","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}}],"parent":null,"viewerCanComment":true,"assignees":{"nodes":[{"id":"MDQ6VXNlcjY0NDA4MTE=","login":"HiromiShikata","name":"Hiromi.s","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"}]},"viewerCanAssign":true,"__isLabelable":"Issue","labels":{"edges":[{"node":{"id":"LA_kwDOHusmC88AAAABdzKnjA","color":"0E8A16","name":"daily-routine","nameHTML":"daily-routine","description":"","url":"https://github.com/HiromiShikata/test-repository/labels/daily-routine","__typename":"Label"},"cursor":"MQ"}],"pageInfo":{"endCursor":"MQ","hasNextPage":false}},"__isNode":"Issue","viewerCanLabel":true,"__isIssueOrPullRequest":"Issue","projectItemsNext":{"edges":[{"node":{"id":"PVTI_lADOBHwEyM4AEU1gzgVEPno","isArchived":false,"project":{"id":"PVT_kwDOBHwEyM4AEU1g","title":"Test v2 project","template":false,"viewerCanUpdate":true,"url":"https://github.com/orgs/HiromiShikata/projects/3","field":{"__typename":"ProjectV2SingleSelectField","id":"PVTSSF_lADOBHwEyM4AEU1gzgCfdy0","name":"Status","options":[{"id":"b18af583","optionId":"b18af583","name":"📋 Backlog","nameHTML":"📋 Backlog","color":"GRAY","descriptionHTML":"","description":""},{"id":"8bc53e92","optionId":"8bc53e92","name":"Unread","nameHTML":"Unread","color":"GRAY","descriptionHTML":"","description":""},{"id":"e36ea728","optionId":"e36ea728","name":"To do","nameHTML":"To do","color":"GRAY","descriptionHTML":"","description":""},{"id":"7e7e1cd1","optionId":"7e7e1cd1","name":"In progress","nameHTML":"In progress","color":"GRAY","descriptionHTML":"","description":""},{"id":"2c35ad03","optionId":"2c35ad03","name":"👀 Review","nameHTML":"👀 Review","color":"GRAY","descriptionHTML":"","description":""},{"id":"b96e0f5d","optionId":"b96e0f5d","name":"✅ Done","nameHTML":"✅ Done","color":"GRAY","descriptionHTML":"","description":""}],"__isNode":"ProjectV2SingleSelectField"},"closed":false,"number":3,"__typename":"ProjectV2"},"fieldValueByName":{"__typename":"ProjectV2ItemFieldSingleSelectValue","id":"PVTFSV_lQDOBHwEyM4AEU1gzgVEPnrOD0n-xA","optionId":"8bc53e92","name":"Unread","nameHTML":"Unread","color":"GRAY","__isNode":"ProjectV2ItemFieldSingleSelectValue"},"__typename":"ProjectV2Item"},"cursor":"MQ"}],"pageInfo":{"endCursor":"MQ","hasNextPage":false}},"milestone":null,"viewerCanSetMilestone":true,"isPinned":false,"viewerCanDelete":true,"viewerCanTransfer":true,"viewerCanConvertToDiscussion":true,"viewerCanLock":true,"viewerCanType":true,"subIssues":{"nodes":[]},"frontTimelineItems":{"pageInfo":{"hasNextPage":false,"endCursor":"Y3Vyc29yOnYyOpPPAAABk1em0rgBqzE1NDA3MDEwNDk4"},"totalCount":6,"edges":[{"node":{"__typename":"LabeledEvent","__isIssueTimelineItems":"LabeledEvent","__isTimelineEvent":"LabeledEvent","databaseId":15405435198,"createdAt":"2024-11-23T00:01:07Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"label":{"id":"LA_kwDOHusmC88AAAABdzKnjA","nameHTML":"daily-routine","name":"daily-routine","color":"0E8A16","description":""},"__isNode":"LabeledEvent","id":"LE_lADOHusmC86gCdsNzwAAAAOWPEk-"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSfbgBqzE1NDA1NDM1MTk4"},{"node":{"__typename":"AssignedEvent","__isIssueTimelineItems":"AssignedEvent","__isTimelineEvent":"AssignedEvent","databaseId":15405435224,"createdAt":"2024-11-23T00:01:07Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"assignee":{"__typename":"User","id":"MDQ6VXNlcjY0NDA4MTE=","__isNode":"User","login":"HiromiShikata"},"__isNode":"AssignedEvent","id":"AE_lADOHusmC86gCdsNzwAAAAOWPElY"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSfbgBqzE1NDA1NDM1MjI0"},{"node":{"__typename":"AddedToProjectV2Event","__isIssueTimelineItems":"AddedToProjectV2Event","__isTimelineEvent":"AddedToProjectV2Event","databaseId":15405437990,"createdAt":"2024-11-23T00:01:25Z","actor":{"__typename":"User","login":"umino-bot","id":"U_kgDOCCyfsA","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/137142192?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"__isNode":"AddedToProjectV2Event","id":"ATPVTE_lADOHusmC86gCdsNzwAAAAOWPFQm"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSxAgBqzE1NDA1NDM3OTkw"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15405438038,"createdAt":"2024-11-23T00:01:26Z","actor":{"__typename":"User","login":"umino-bot","id":"U_kgDOCCyfsA","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/137142192?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"previousStatus":"","status":"Unread","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOHusmC86gCdsNzwAAAAOWPFRW"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSx_ABqzE1NDA1NDM4MDM4"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15407010389,"createdAt":"2024-11-23T06:12:46Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"previousStatus":"Unread","status":"In progress","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOHusmC86gCdsNzwAAAAOWVFJV"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1emvzABqzE1NDA3MDEwMzg5"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15407010498,"createdAt":"2024-11-23T06:12:51Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"previousStatus":"In progress","status":"Unread","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOHusmC86gCdsNzwAAAAOWVFLC"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1em0rgBqzE1NDA3MDEwNDk4"}]},"backTimelineItems":{"pageInfo":{"hasPreviousPage":false,"startCursor":"Y3Vyc29yOnYyOpPPAAABk1ZSfbgBqzE1NDA1NDM1MTk4"},"totalCount":6,"edges":[{"node":{"__typename":"LabeledEvent","__isIssueTimelineItems":"LabeledEvent","__isTimelineEvent":"LabeledEvent","databaseId":15405435198,"createdAt":"2024-11-23T00:01:07Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"label":{"id":"LA_kwDOHusmC88AAAABdzKnjA","nameHTML":"daily-routine","name":"daily-routine","color":"0E8A16","description":""},"__isNode":"LabeledEvent","id":"LE_lADOHusmC86gCdsNzwAAAAOWPEk-"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSfbgBqzE1NDA1NDM1MTk4"},{"node":{"__typename":"AssignedEvent","__isIssueTimelineItems":"AssignedEvent","__isTimelineEvent":"AssignedEvent","databaseId":15405435224,"createdAt":"2024-11-23T00:01:07Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"assignee":{"__typename":"User","id":"MDQ6VXNlcjY0NDA4MTE=","__isNode":"User","login":"HiromiShikata"},"__isNode":"AssignedEvent","id":"AE_lADOHusmC86gCdsNzwAAAAOWPElY"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSfbgBqzE1NDA1NDM1MjI0"},{"node":{"__typename":"AddedToProjectV2Event","__isIssueTimelineItems":"AddedToProjectV2Event","__isTimelineEvent":"AddedToProjectV2Event","databaseId":15405437990,"createdAt":"2024-11-23T00:01:25Z","actor":{"__typename":"User","login":"umino-bot","id":"U_kgDOCCyfsA","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/137142192?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"__isNode":"AddedToProjectV2Event","id":"ATPVTE_lADOHusmC86gCdsNzwAAAAOWPFQm"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSxAgBqzE1NDA1NDM3OTkw"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15405438038,"createdAt":"2024-11-23T00:01:26Z","actor":{"__typename":"User","login":"umino-bot","id":"U_kgDOCCyfsA","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/137142192?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"previousStatus":"","status":"Unread","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOHusmC86gCdsNzwAAAAOWPFRW"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1ZSx_ABqzE1NDA1NDM4MDM4"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15407010389,"createdAt":"2024-11-23T06:12:46Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"previousStatus":"Unread","status":"In progress","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOHusmC86gCdsNzwAAAAOWVFJV"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1emvzABqzE1NDA3MDEwMzg5"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15407010498,"createdAt":"2024-11-23T06:12:51Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4"},"project":{"title":"Test v2 project","url":"https://github.com/orgs/HiromiShikata/projects/3","id":"PVT_kwDOBHwEyM4AEU1g"},"previousStatus":"In progress","status":"Unread","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOHusmC86gCdsNzwAAAAOWVFLC"},"cursor":"Y3Vyc29yOnYyOpPPAAABk1em0rgBqzE1NDA3MDEwNDk4"}]}},"id":"R_kgDOHusmCw"},"safeViewer":{"isEnterpriseManagedUser":false,"enterpriseManagedEnterpriseId":null,"login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","name":"Hiromi.s","isEmployee":false}}},"timestamp":1732342388}],"preloadedSubscriptions":{"e96a2844fab333e7326a09a8e560b51c":{"{\\"issueId\\":\\"I_kwDOCNXcUc6GaFia\\"}":{"response":{"data":{"issueUpdated":{"issueTitleUpdated":null,"issueStateUpdated":null,"issueMetadataUpdated":null}}},"subscriptionId":"eyJjIjoiZzp2Mzo6aXNzdWVVcGRhdGVkOmlkOklfa3dET0h1c21DODZnQ2RzTjpnYUpwWkxKSlgydDNSRTlJZFhOdFF6ZzJaME5rYzA0PSIsInQiOjE3MzIzNDIzODh9--07fda93fa814829504a1fb3a817e9b023976fdd61988f40db526266a04cf688a"}}}},"title":null,"appPayload":{"initial_view_content":{"team_id":null,"can_edit_view":true},"current_user":{"id":"MDQ6VXNlcjY0NDA4MTE=","login":"HiromiShikata","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?v=4","is_staff":false,"is_emu":false},"current_user_settings":{"use_monospace_font":false,"use_single_key_shortcut":true,"preferred_emoji_skin_tone":0},"paste_url_link_as_plain_text":false,"base_avatar_url":"https://avatars.githubusercontent.com","feedback_url":null,"help_url":"https://docs.github.com","sso_organizations":null,"tracing":false,"tracing_flamegraph":false,"catalog_service":"github/issues_experience","scoped_repository":{"id":"R_kgDOHusmCw","owner":"HiromiShikata","name":"test-repository","is_archived":false},"proxima":false,"render_opt_out":false,"enabled_features":{"use_pull_request_subscriptions_enabled":false,"pull_request_single_subscription":true,"graphql_subscriptions":true,"disable_issues_react_ssr":false,"profiles_write_to_target":true,"issues_react":false,"issues_react_prefetch":false,"issue_types":true,"issues_react_dashboard_saved_views":false,"copilot_workspace":false,"sub_issues":true,"copilot_natural_language_github_search":false,"issues_react_ui_commands_migration":true,"private_avatars":false,"reserved_domain":true,"projects_classic_sunset_ui":true,"projects_classic_sunset_override":false,"issues_react_new_timeline":true,"refresh_image_video_src":true,"issues_react_bypass_es_limits":true,"issues_react_close_as_duplicate":false,"issues_react_customise_notifications_ui":true,"notifyd_issue_watch_activity_notify":false,"notifyd_enable_issue_thread_subscriptions":false,"issues_react_new_sort_dropdown":true,"tasklist_block":false,"issues_react_perf_test":false}}}</script>
        `;

    const result = await repository.getIssueFromBetaFeatureView(
      testIssueUrl,
      htmlContent,
    );
    expect(result).toEqual({
      assignees: ['HiromiShikata'],
      createdAt: new Date('2024-01-01'),
      inProgressTimeline: [
        {
          author: 'HiromiShikata',
          durationMinutes: 0.08333333333333333,
          endedAt: new Date('2024-11-23T06:12:51.000Z'),
          issueUrl:
            'https://github.com/HiromiShikata/test-repository/issues/38',
          startedAt: new Date('2024-11-23T06:12:46.000Z'),
        },
      ],
      labels: ['daily-routine'],
      project: 'Test v2 project',
      status: 'Unread',
      statusTimeline: [
        {
          author: 'umino-bot',
          from: '',
          time: '2024-11-23T00:01:26Z',
          to: 'Unread',
        },
        {
          author: 'HiromiShikata',
          from: 'Unread',
          time: '2024-11-23T06:12:46Z',
          to: 'In progress',
        },
        {
          author: 'HiromiShikata',
          from: 'In progress',
          time: '2024-11-23T06:12:51Z',
          to: 'Unread',
        },
      ],
      title: 'Test title',
      url: 'https://github.com/HiromiShikata/test-repository/issues/38',
      workingTimeline: [
        {
          author: 'HiromiShikata',
          durationMinutes: 0.08333333333333333,
          endedAt: new Date('2024-11-23T06:12:51.000Z'),
          issueUrl:
            'https://github.com/HiromiShikata/test-repository/issues/38',
          startedAt: new Date('2024-11-23T06:12:46.000Z'),
        },
      ],
    });
  });

  test('removeIssueFromProject removes issue from project successfully', async () => {
    const testProjectId = 'PVT_kwDOCNXcUc4AXA1N';
    const testItemId = 'PVTI_lADOCNXcUc4AXA1NzgA';

    // Reset mock implementation for this test
    mockedAxios.post.mockReset();

    // Mock for GetProjectItem query
    mockedAxios.post.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          data: {
            repository: {
              issue: {
                projectItems: {
                  nodes: [{ id: testItemId }],
                },
              },
            },
          },
        },
      }),
    );

    // Mock for RemoveProjectItem mutation
    mockedAxios.post.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          data: {
            removeProjectV2ItemFromProject: {
              clientMutationId: 'test-mutation-id',
            },
          },
        },
      }),
    );

    await repository.removeIssueFromProject(testIssueUrl, testProjectId);

    const mockCalls = mockedAxios.post.mock.calls;
    void expect(mockedAxios.post.mock.calls).toHaveLength(2);

    // Verify first call (get project item)
    const isGraphQLRequestData = (data: unknown): data is GraphQLRequestData =>
      typeof data === 'object' &&
      data !== null &&
      'variables' in data &&
      typeof data.variables === 'object';

    const firstCallData = mockCalls[0]?.[1];
    if (!firstCallData || !isGraphQLRequestData(firstCallData)) {
      throw new Error('First call data is not a valid GraphQLRequestData');
    }

    expect(firstCallData.variables).toEqual({
      owner: 'HiromiShikata',
      repo: 'test-repository',
      number: 38,
      projectId: testProjectId,
    });

    // Verify second call (remove item)
    const secondCallData = mockCalls[1]?.[1];
    if (!secondCallData || !isGraphQLRequestData(secondCallData)) {
      throw new Error('Second call data is not a valid GraphQLRequestData');
    }

    expect(secondCallData.variables).toEqual({
      projectId: testProjectId,
      itemId: testItemId,
    });
  });

  test('removeIssueFromProject throws error when issue not found in project', async () => {
    const testProjectId = 'PVT_kwDOCNXcUc4AXA1N';

    // Reset mock implementation for this test
    mockedAxios.post.mockReset();

    // Mock empty project items response for error case
    mockedAxios.post.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          data: {
            repository: {
              issue: {
                projectItems: {
                  nodes: [],
                },
              },
            },
          },
        },
      }),
    );

    await expect(
      repository.removeIssueFromProject(testIssueUrl, testProjectId),
    ).rejects.toThrow(
      `Issue not found in project. URL: ${testIssueUrl}, Project ID: ${testProjectId}`,
    );

    void expect(mockedAxios.post.mock.calls).toHaveLength(1);
  });
});
