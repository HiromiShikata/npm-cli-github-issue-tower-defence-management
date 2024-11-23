import { InternalGraphqlIssueRepository } from './InternalGraphqlIssueRepository';

describe('InternalGraphqlIssueRepository', () => {
  const repository = new InternalGraphqlIssueRepository();

  const testIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/38';
  const testCursor = null;
  const testIssueId = 'I_kwDOCNXcUc6GaFia';
  const testCount = 10;

  test('getFrontTimelineItems returns timeline with proper types', async () => {
    const result = await repository.getFrontTimelineItems(
      testIssueUrl,
      testCursor,
      testIssueId,
      testCount,
    );
    expect(result).toEqual([
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv_67rgBqzEyNTUwMzU4NjA4',
        node: {
          __isIssueTimelineItems: 'AssignedEvent',
          __isNode: 'AssignedEvent',
          __isTimelineEvent: 'AssignedEvent',
          __typename: 'AssignedEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          assignee: {
            __isNode: 'User',
            __typename: 'User',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T09:26:59Z',
          databaseId: 12550358608,
          id: 'AE_lADOCNXcUc6GaFiazwAAAALsD0ZQ',
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv_7HZgBqzEyNTUwMzU5MzAx',
        node: {
          __isIssueTimelineItems: 'AddedToProjectEvent',
          __isNode: 'AddedToProjectEvent',
          __isTimelineEvent: 'AddedToProjectEvent',
          __typename: 'AddedToProjectEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T09:27:11Z',
          databaseId: 12550359301,
          id: 'ATPE_lADOCNXcUc6GaFiazwAAAALsD0kF',
          project: {
            id: 'MDc6UHJvamVjdDYwNTc1NjA=',
            name: 'test project 2',
            url: 'https://github.com/HiromiShikata/test-repository/projects/2',
          },
          projectColumnName: 'Inbox',
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv_7mpgBqzE0ODg3NDczOTIw',
        node: {
          __isIssueTimelineItems: 'AddedToProjectV2Event',
          __isNode: 'AddedToProjectV2Event',
          __isTimelineEvent: 'AddedToProjectV2Event',
          __typename: 'AddedToProjectV2Event',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T09:27:43Z',
          databaseId: 14887473920,
          id: 'ATPVTE_lADOCNXcUc6GaFiazwAAAAN3XNMA',
          project: {
            id: 'PVT_kwHOAGJHa84AFhgF',
            title: 'V2 project on owner for testing',
            url: 'https://github.com/users/HiromiShikata/projects/49',
          },
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv_74OgBqzEyNTUwMzYxODU5',
        node: {
          __isIssueTimelineItems: 'RemovedFromProjectEvent',
          __isNode: 'RemovedFromProjectEvent',
          __isTimelineEvent: 'RemovedFromProjectEvent',
          __typename: 'RemovedFromProjectEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T09:28:01Z',
          databaseId: 12550361859,
          id: 'RFPE_lADOCNXcUc6GaFiazwAAAALsD1MD',
          project: {
            id: 'MDc6UHJvamVjdDYwNTc1NjA=',
            name: 'test project 2',
            url: 'https://github.com/HiromiShikata/test-repository/projects/2',
          },
          projectColumnName: 'Inbox',
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv_7_EABqzEyNTUwMzYyMjc0',
        node: {
          __isIssueTimelineItems: 'RenamedTitleEvent',
          __isNode: 'RenamedTitleEvent',
          __isTimelineEvent: 'RenamedTitleEvent',
          __typename: 'RenamedTitleEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T09:28:08Z',
          currentTitle: 'In progress test title',
          databaseId: 12550362274,
          id: 'RTE_lADOCNXcUc6GaFiazwAAAALsD1Si',
          previousTitle: 'Test title',
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv_8F5gBqzE1MDgzNzM3OTk2',
        node: {
          __isIssueTimelineItems: 'ProjectV2ItemStatusChangedEvent',
          __isNode: 'ProjectV2ItemStatusChangedEvent',
          __isTimelineEvent: 'ProjectV2ItemStatusChangedEvent',
          __typename: 'ProjectV2ItemStatusChangedEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T09:28:15Z',
          databaseId: 15083737996,
          id: 'PVTISC_lADOCNXcUc6GaFiazwAAAAODD5OM',
          previousStatus: '',
          project: {
            id: 'PVT_kwHOAGJHa84AFhgF',
            title: 'V2 project on owner for testing',
            url: 'https://github.com/users/HiromiShikata/projects/49',
          },
          status: 'In Progress',
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv_8OsAAqjIwNjc5NzY1MjI=',
        node: {
          __isComment: 'IssueComment',
          __isIssueTimelineItems: 'IssueComment',
          __isNode: 'IssueComment',
          __isReactable: 'IssueComment',
          __typename: 'IssueComment',
          author: {
            __typename: 'User',
            avatarUrl: 'https://avatars.githubusercontent.com/u/6440811?v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          authorAssociation: 'OWNER',
          authorToRepoOwnerSponsorship: null,
          body: 'first comment\r\n',
          bodyHTML: '<p dir="auto">first comment</p>',
          bodyVersion:
            '5488e9494e6e47fb5158f81fb4f27a786a0215e322a802c9a9fc9139fe4c20d1',
          createdAt: '2024-04-21T09:28:24Z',
          createdViaEmail: false,
          databaseId: 2067976522,
          id: 'IC_kwDOCNXcUc57QtFK',
          isHidden: false,
          issue: {
            author: {
              __typename: 'User',
              id: 'MDQ6VXNlcjY0NDA4MTE=',
              login: 'HiromiShikata',
            },
            databaseId: 2254985370,
            id: 'I_kwDOCNXcUc6GaFia',
            locked: false,
            number: 38,
          },
          lastEditedAt: null,
          lastUserContentEdit: null,
          minimizedReason: null,
          reactionGroups: [
            {
              content: 'THUMBS_UP',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
            {
              content: 'THUMBS_DOWN',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
            {
              content: 'LAUGH',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
            {
              content: 'HOORAY',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
            {
              content: 'CONFUSED',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
            {
              content: 'HEART',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
            {
              content: 'ROCKET',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
            {
              content: 'EYES',
              reactors: {
                nodes: [],
                totalCount: 0,
              },
              viewerHasReacted: false,
            },
          ],
          repository: {
            databaseId: 148233297,
            id: 'MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc=',
            isPrivate: false,
            name: 'test-repository',
            nameWithOwner: 'HiromiShikata/test-repository',
            owner: {
              __typename: 'User',
              id: 'MDQ6VXNlcjY0NDA4MTE=',
              login: 'HiromiShikata',
              url: 'https://github.com/HiromiShikata',
            },
            slashCommandsEnabled: true,
          },
          showSpammyBadge: false,
          url: 'https://github.com/HiromiShikata/test-repository/issues/38#issuecomment-2067976522',
          viewerCanBlockFromOrg: false,
          viewerCanDelete: true,
          viewerCanMinimize: true,
          viewerCanReadUserContentEdits: true,
          viewerCanReport: true,
          viewerCanReportToMaintainer: false,
          viewerCanUnblockFromOrg: false,
          viewerCanUpdate: true,
          viewerDidAuthor: true,
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjv__T9ABqzE1MDM0NzA1ODk5',
        node: {
          __isIssueTimelineItems: 'ProjectV2ItemStatusChangedEvent',
          __isNode: 'ProjectV2ItemStatusChangedEvent',
          __isTimelineEvent: 'ProjectV2ItemStatusChangedEvent',
          __typename: 'ProjectV2ItemStatusChangedEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T09:31:46Z',
          databaseId: 15034705899,
          id: 'PVTISC_lADOCNXcUc6GaFiazwAAAAOAI2fr',
          previousStatus: 'In Progress',
          project: {
            id: 'PVT_kwHOAGJHa84AFhgF',
            title: 'V2 project on owner for testing',
            url: 'https://github.com/users/HiromiShikata/projects/49',
          },
          status: 'Todo',
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjwAlKzgBqzE0OTI2NjgzOTMz',
        node: {
          __isIssueTimelineItems: 'ProjectV2ItemStatusChangedEvent',
          __isNode: 'ProjectV2ItemStatusChangedEvent',
          __isTimelineEvent: 'ProjectV2ItemStatusChangedEvent',
          __typename: 'ProjectV2ItemStatusChangedEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T10:13:07Z',
          databaseId: 14926683933,
          id: 'PVTISC_lADOCNXcUc6GaFiazwAAAAN5sx8d',
          previousStatus: 'Todo',
          project: {
            id: 'PVT_kwHOAGJHa84AFhgF',
            title: 'V2 project on owner for testing',
            url: 'https://github.com/users/HiromiShikata/projects/49',
          },
          status: 'In Progress',
        },
      },
      {
        cursor: 'Y3Vyc29yOnYyOpPPAAABjwA8AuABqzEyNTUwNTY3ODEz',
        node: {
          __isIssueTimelineItems: 'LabeledEvent',
          __isNode: 'LabeledEvent',
          __isTimelineEvent: 'LabeledEvent',
          __typename: 'LabeledEvent',
          actor: {
            __isActor: 'User',
            __typename: 'User',
            avatarUrl:
              'https://avatars.githubusercontent.com/u/6440811?s=64&v=4',
            id: 'MDQ6VXNlcjY0NDA4MTE=',
            login: 'HiromiShikata',
          },
          createdAt: '2024-04-21T10:38:04Z',
          databaseId: 12550567813,
          id: 'LE_lADOCNXcUc6GaFiazwAAAALsEneF',
          label: {
            color: 'a2eeef',
            description: 'New feature or request',
            id: 'MDU6TGFiZWwxMDUyMzg2NjYy',
            name: 'enhancement',
            nameHTML: 'enhancement',
          },
        },
      },
    ]);
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
    });
  });
});
