import { InternalGraphqlIssueRepository } from './InternalGraphqlIssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

describe('InternalGraphqlIssueRepository', () => {
  jest.setTimeout(30 * 1000);
  const localStorageRepository = new LocalStorageRepository();
  const repository = new InternalGraphqlIssueRepository(localStorageRepository);

  const testIssueUrl =
    'https://github.com/HiromiShikata/test-repository/issues/38';
  const testCursor = null;
  const testIssueId = 'I_kwDOCNXcUc6GaFia';
  const testCount = 10;

  beforeAll(async () => {
    await repository.getCookie();
  });

  test('getFrontTimelineItems returns timeline with proper types', async () => {
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
 <script type="application/json" data-target="react-app.embeddedData">{"payload":{"preloaded_records":{},"preloadedQueries":[{"queryId":"63ca9e7142c6d44786486b0e437a0152","queryName":"IssueViewerViewQuery","variables":{"id":"repository","number":38,"owner":"HiromiShikata","repo":"test-repository"},"result":{"data":{"repository":{"isOwnerEnterpriseManaged":false,"issue":{"id":"I_kwDOCNXcUc6GaFia","updatedAt":"2024-11-23T05:46:40Z","title":"In progress test title","number":38,"repository":{"nameWithOwner":"HiromiShikata/test-repository","id":"MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc=","name":"test-repository","owner":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","url":"https://github.com/HiromiShikata"},"isArchived":false,"isPrivate":false,"databaseId":148233297,"slashCommandsEnabled":true,"viewerCanInteract":true,"viewerInteractionLimitReasonHTML":"","planFeatures":{"maximumAssignees":10},"visibility":"PUBLIC","pinnedIssues":{"totalCount":0},"viewerCanPinIssues":true,"issueTypes":null},"titleHTML":"In progress test title","url":"https://github.com/HiromiShikata/test-repository/issues/38","viewerCanUpdateNext":true,"issueType":null,"state":"OPEN","stateReason":"REOPENED","duplicateOf":null,"linkedPullRequests":{"nodes":[]},"subIssuesSummary":{"total":0,"completed":0},"__isLabelable":"Issue","labels":{"edges":[{"node":{"id":"MDU6TGFiZWwxMDUyMzg2NjYy","color":"a2eeef","name":"enhancement","nameHTML":"enhancement","description":"New feature or request","url":"https://github.com/HiromiShikata/test-repository/labels/enhancement","__typename":"Label"},"cursor":"MQ"}],"pageInfo":{"endCursor":"MQ","hasNextPage":false}},"__isNode":"Issue","assignedActors":{"nodes":[{"__typename":"User","__isActor":"User","id":"MDQ6VXNlcjY0NDA4MTE=","login":"HiromiShikata","name":"Hiromi.s","profileResourcePath":"/HiromiShikata","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","__isNode":"User"}]},"milestone":null,"databaseId":2254985370,"viewerDidAuthor":true,"locked":false,"author":{"__typename":"User","__isActor":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","profileUrl":"https://github.com/HiromiShikata","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?v=4"},"__isComment":"Issue","body":"Test description\\r\\n- [ ] checkbox 1\\r\\n- list item 1\\r\\n- list item 2\\r\\n","bodyHTML":"\u003cp dir=\\"auto\\"\u003eTest description\u003c/p\u003e\\n\u003cul class=\\"contains-task-list\\"\u003e\\n\u003cli class=\\"task-list-item\\"\u003e\u003cinput type=\\"checkbox\\" id=\\"\\" disabled=\\"\\" class=\\"task-list-item-checkbox\\"\u003e checkbox 1\u003c/li\u003e\\n\u003cli\u003elist item 1\u003c/li\u003e\\n\u003cli\u003elist item 2\u003c/li\u003e\\n\u003c/ul\u003e","bodyVersion":"23fe03b4fb4e7439d0966bd8b0b852ff1d144be1bf2f9e626c9d1124066b0d3c","createdAt":"2024-04-21T09:26:54Z","__isReactable":"Issue","reactionGroups":[{"content":"THUMBS_UP","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"THUMBS_DOWN","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"LAUGH","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"HOORAY","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"CONFUSED","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"HEART","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"ROCKET","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"EYES","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}}],"viewerCanUpdateMetadata":true,"viewerCanComment":true,"viewerCanAssign":true,"viewerCanLabel":true,"__isIssueOrPullRequest":"Issue","projectItemsNext":{"edges":[{"node":{"id":"PVTI_lAHOAGJHa84AFhgFzgTKpJ8","isArchived":false,"project":{"id":"PVT_kwHOAGJHa84AFhgF","title":"V2 project on owner for testing","template":false,"viewerCanUpdate":true,"url":"https://github.com/users/HiromiShikata/projects/49","field":{"__typename":"ProjectV2SingleSelectField","id":"PVTSSF_lAHOAGJHa84AFhgFzgDLt0c","name":"Status","options":[{"id":"f75ad846","optionId":"f75ad846","name":"Todo","nameHTML":"Todo","color":"GRAY","descriptionHTML":"","description":""},{"id":"47fc9ee4","optionId":"47fc9ee4","name":"In Progress","nameHTML":"In Progress","color":"GRAY","descriptionHTML":"","description":""},{"id":"98236657","optionId":"98236657","name":"Done","nameHTML":"Done","color":"GRAY","descriptionHTML":"","description":""}],"__isNode":"ProjectV2SingleSelectField"},"closed":false,"number":49,"hasReachedItemsLimit":false,"__typename":"ProjectV2"},"fieldValueByName":{"__typename":"ProjectV2ItemFieldSingleSelectValue","id":"PVTFSV_lQHOAGJHa84AFhgFzgTKpJ_ODc6aFQ","optionId":"f75ad846","name":"Todo","nameHTML":"Todo","color":"GRAY","__isNode":"ProjectV2ItemFieldSingleSelectValue"},"__typename":"ProjectV2Item"},"cursor":"MQ"}],"pageInfo":{"endCursor":"MQ","hasNextPage":false}},"viewerCanSetMilestone":true,"isPinned":false,"viewerCanDelete":true,"viewerCanTransfer":true,"viewerCanConvertToDiscussion":false,"viewerCanLock":true,"viewerCanType":false,"frontTimelineItems":{"pageInfo":{"hasNextPage":true,"endCursor":"Y3Vyc29yOnYyOpPPAAABkgqXmAABqzE0Nzk0Njg2NjMw"},"totalCount":32,"edges":[{"node":{"__typename":"AssignedEvent","__isIssueTimelineItems":"AssignedEvent","__isTimelineEvent":"AssignedEvent","databaseId":12550358608,"createdAt":"2024-04-21T09:26:59Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"assignee":{"__typename":"User","id":"MDQ6VXNlcjY0NDA4MTE=","__isNode":"User","__isActor":"User","login":"HiromiShikata","resourcePath":"/HiromiShikata"},"__isNode":"AssignedEvent","id":"AE_lADOCNXcUc6GaFiazwAAAALsD0ZQ"},"cursor":"Y3Vyc29yOnYyOpPPAAABjv_67rgBqzEyNTUwMzU4NjA4"},{"node":{"__typename":"AddedToProjectV2Event","__isIssueTimelineItems":"AddedToProjectV2Event","__isTimelineEvent":"AddedToProjectV2Event","databaseId":14887473920,"createdAt":"2024-04-21T09:27:43Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"__isNode":"AddedToProjectV2Event","id":"ATPVTE_lADOCNXcUc6GaFiazwAAAAN3XNMA"},"cursor":"Y3Vyc29yOnYyOpPPAAABjv_7mpgBqzE0ODg3NDczOTIw"},{"node":{"__typename":"RenamedTitleEvent","__isIssueTimelineItems":"RenamedTitleEvent","__isTimelineEvent":"RenamedTitleEvent","databaseId":12550362274,"createdAt":"2024-04-21T09:28:08Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"currentTitle":"In progress test title","previousTitle":"Test title","__isNode":"RenamedTitleEvent","id":"RTE_lADOCNXcUc6GaFiazwAAAALsD1Si"},"cursor":"Y3Vyc29yOnYyOpPPAAABjv_7_EABqzEyNTUwMzYyMjc0"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15083737996,"createdAt":"2024-04-21T09:28:15Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"previousStatus":"","status":"In Progress","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOCNXcUc6GaFiazwAAAAODD5OM"},"cursor":"Y3Vyc29yOnYyOpPPAAABjv_8F5gBqzE1MDgzNzM3OTk2"},{"node":{"__typename":"IssueComment","__isIssueTimelineItems":"IssueComment","databaseId":2067976522,"viewerDidAuthor":true,"issue":{"author":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE="},"id":"I_kwDOCNXcUc6GaFia","number":38,"locked":false,"databaseId":2254985370},"author":{"__typename":"User","login":"HiromiShikata","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?v=4","profileUrl":"https://github.com/HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE="},"id":"IC_kwDOCNXcUc57QtFK","body":"first comment\\r\\n","bodyHTML":"\u003cp dir=\\"auto\\"\u003efirst comment\u003c/p\u003e","bodyVersion":"5488e9494e6e47fb5158f81fb4f27a786a0215e322a802c9a9fc9139fe4c20d1","viewerCanUpdate":true,"url":"https://github.com/HiromiShikata/test-repository/issues/38#issuecomment-2067976522","createdAt":"2024-04-21T09:28:24Z","authorAssociation":"OWNER","viewerCanDelete":true,"viewerCanMinimize":true,"viewerCanReport":true,"viewerCanReportToMaintainer":false,"viewerCanBlockFromOrg":false,"viewerCanUnblockFromOrg":false,"isHidden":false,"minimizedReason":null,"showSpammyBadge":false,"createdViaEmail":false,"authorToRepoOwnerSponsorship":null,"repository":{"id":"MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc=","name":"test-repository","owner":{"__typename":"User","id":"MDQ6VXNlcjY0NDA4MTE=","login":"HiromiShikata","url":"https://github.com/HiromiShikata"},"isPrivate":false,"slashCommandsEnabled":true,"nameWithOwner":"HiromiShikata/test-repository","databaseId":148233297},"__isComment":"IssueComment","viewerCanReadUserContentEdits":true,"lastEditedAt":null,"lastUserContentEdit":null,"__isReactable":"IssueComment","reactionGroups":[{"content":"THUMBS_UP","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"THUMBS_DOWN","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"LAUGH","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"HOORAY","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"CONFUSED","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"HEART","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"ROCKET","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}},{"content":"EYES","viewerHasReacted":false,"reactors":{"totalCount":0,"nodes":[]}}],"__isNode":"IssueComment"},"cursor":"Y3Vyc29yOnYyOpPPAAABjv_8OsAAqjIwNjc5NzY1MjI="},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":15034705899,"createdAt":"2024-04-21T09:31:46Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"previousStatus":"In Progress","status":"Todo","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOCNXcUc6GaFiazwAAAAOAI2fr"},"cursor":"Y3Vyc29yOnYyOpPPAAABjv__T9ABqzE1MDM0NzA1ODk5"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":14926683933,"createdAt":"2024-04-21T10:13:07Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"previousStatus":"Todo","status":"In Progress","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOCNXcUc6GaFiazwAAAAN5sx8d"},"cursor":"Y3Vyc29yOnYyOpPPAAABjwAlKzgBqzE0OTI2NjgzOTMz"},{"node":{"__typename":"LabeledEvent","__isIssueTimelineItems":"LabeledEvent","__isTimelineEvent":"LabeledEvent","databaseId":12550567813,"createdAt":"2024-04-21T10:38:04Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"label":{"id":"MDU6TGFiZWwxMDUyMzg2NjYy","nameHTML":"enhancement","name":"enhancement","color":"a2eeef","description":"New feature or request"},"__isNode":"LabeledEvent","id":"LE_lADOCNXcUc6GaFiazwAAAALsEneF"},"cursor":"Y3Vyc29yOnYyOpPPAAABjwA8AuABqzEyNTUwNTY3ODEz"},{"node":{"__typename":"ProjectV2ItemStatusChangedEvent","__isIssueTimelineItems":"ProjectV2ItemStatusChangedEvent","__isTimelineEvent":"ProjectV2ItemStatusChangedEvent","databaseId":14921360937,"createdAt":"2024-04-21T11:13:38Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"previousStatus":"In Progress","status":"Todo","__isNode":"ProjectV2ItemStatusChangedEvent","id":"PVTISC_lADOCNXcUc6GaFiazwAAAAN5YeYp"},"cursor":"Y3Vyc29yOnYyOpPPAAABjwBcktABqzE0OTIxMzYwOTM3"},{"node":{"__typename":"LabeledEvent","__isIssueTimelineItems":"LabeledEvent","__isTimelineEvent":"LabeledEvent","databaseId":12550661821,"createdAt":"2024-04-21T11:28:26Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"label":{"id":"MDU6TGFiZWwxMDUyMzg2NjYw","nameHTML":"bug","name":"bug","color":"d73a4a","description":"Something isn't working"},"__isNode":"LabeledEvent","id":"LE_lADOCNXcUc6GaFiazwAAAALsE-a9"},"cursor":"Y3Vyc29yOnYyOpPPAAABjwBqH5ABqzEyNTUwNjYxODIx"},{"node":{"__typename":"UnlabeledEvent","__isIssueTimelineItems":"UnlabeledEvent","__isTimelineEvent":"UnlabeledEvent","databaseId":12550661973,"createdAt":"2024-04-21T11:28:32Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"label":{"id":"MDU6TGFiZWwxMDUyMzg2NjYw","nameHTML":"bug","name":"bug","color":"d73a4a","description":"Something isn't working"},"__isNode":"UnlabeledEvent","id":"UNLE_lADOCNXcUc6GaFiazwAAAALsE-dV"},"cursor":"Y3Vyc29yOnYyOpPPAAABjwBqNwABqzEyNTUwNjYxOTcz"},{"node":{"__typename":"RemovedFromProjectV2Event","__isIssueTimelineItems":"RemovedFromProjectV2Event","__isTimelineEvent":"RemovedFromProjectV2Event","databaseId":14803494036,"createdAt":"2024-08-27T05:39:11Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"__isNode":"RemovedFromProjectV2Event","id":"RFPVTE_lADOCNXcUc6GaFiazwAAAANyW2SU"},"cursor":"Y3Vyc29yOnYyOpPPAAABkZJYYBgBqzE0ODAzNDk0MDM2"},{"node":{"__typename":"AddedToProjectV2Event","__isIssueTimelineItems":"AddedToProjectV2Event","__isTimelineEvent":"AddedToProjectV2Event","databaseId":14794432926,"createdAt":"2024-08-27T05:40:58Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"__isNode":"AddedToProjectV2Event","id":"ATPVTE_lADOCNXcUc6GaFiazwAAAANx0SGe"},"cursor":"Y3Vyc29yOnYyOpPPAAABkZJaAhABqzE0Nzk0NDMyOTI2"},{"node":{"__typename":"RemovedFromProjectV2Event","__isIssueTimelineItems":"RemovedFromProjectV2Event","__isTimelineEvent":"RemovedFromProjectV2Event","databaseId":14806289828,"createdAt":"2024-09-19T13:30:52Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"__isNode":"RemovedFromProjectV2Event","id":"RFPVTE_lADOCNXcUc6GaFiazwAAAANyhg2k"},"cursor":"Y3Vyc29yOnYyOpPPAAABkgp6euABqzE0ODA2Mjg5ODI4"},{"node":{"__typename":"AddedToProjectV2Event","__isIssueTimelineItems":"AddedToProjectV2Event","__isTimelineEvent":"AddedToProjectV2Event","databaseId":14794686630,"createdAt":"2024-09-19T14:02:40Z","actor":{"__typename":"User","login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","__isActor":"User","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","profileResourcePath":"/HiromiShikata"},"project":{"title":"V2 project on owner for testing","url":"https://github.com/users/HiromiShikata/projects/49","id":"PVT_kwHOAGJHa84AFhgF"},"__isNode":"AddedToProjectV2Event","id":"ATPVTE_lADOCNXcUc6GaFiazwAAAANx1QCm"},"cursor":"Y3Vyc29yOnYyOpPPAAABkgqXmAABqzE0Nzk0Njg2NjMw"}]},"backTimelineItems":{"pageInfo":{"hasPreviousPage":true,"startCursor":null},"totalCount":32,"edges":[]}},"id":"MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc="},"safeViewer":{"isEnterpriseManagedUser":false,"enterpriseManagedEnterpriseId":null,"login":"HiromiShikata","id":"MDQ6VXNlcjY0NDA4MTE=","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?s=64\u0026v=4","__isActor":"User","__typename":"User","name":"Hiromi.s","profileResourcePath":"/HiromiShikata"}}},"timestamp":1747310010}],"preloadedSubscriptions":{"969f1a1b54b7b31597d59da977e8234a":{"{\\"issueId\\":\\"I_kwDOCNXcUc6GaFia\\"}":{"response":{"data":{"issueUpdated":{"deletedCommentId":null,"issueBodyUpdated":null,"issueMetadataUpdated":null,"issueStateUpdated":null,"issueTimelineUpdated":null,"issueTitleUpdated":null,"issueReactionUpdated":null,"issueTransferStateUpdated":null,"issueTypeUpdated":null,"commentReactionUpdated":null,"commentUpdated":null,"subIssuesUpdated":null,"subIssuesSummaryUpdated":null,"parentIssueUpdated":null,"issueDependenciesSummaryUpdated":null}}},"subscriptionId":"eyJjIjoiZzp2Mzo6aXNzdWVVcGRhdGVkOmlkOklfa3dET0NOWGNVYzZHYUZpYTpnYUpwWkxKSlgydDNSRTlEVGxoalZXTTJSMkZHYVdFPSIsInQiOjE3NDczMTAwMTB9--3cca20c8da5c31aa7c7d1a68eba91946c989dbcf0ddf058573aa7607a3c314f6"}}}},"title":null,"appPayload":{"initial_view_content":{"team_id":null,"can_edit_view":true},"current_user":{"id":"MDQ6VXNlcjY0NDA4MTE=","login":"HiromiShikata","avatarUrl":"https://avatars.githubusercontent.com/u/6440811?v=4","is_staff":false,"is_emu":false},"current_user_settings":{"use_monospace_font":false,"use_single_key_shortcut":true,"preferred_emoji_skin_tone":0},"paste_url_link_as_plain_text":false,"base_avatar_url":"https://avatars.githubusercontent.com","help_url":"https://docs.github.com","sso_organizations":null,"multi_tenant":false,"tracing":false,"tracing_flamegraph":false,"catalog_service":"github/issues","scoped_repository":{"id":"MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc=","owner":"HiromiShikata","name":"test-repository","is_archived":false},"copilot_api_url":null,"enabled_features":{"use_pull_request_subscriptions_enabled":false,"pull_request_single_subscription":true,"disable_issues_react_ssr":false,"issues_react_dashboard_saved_views":false,"issue_dependencies":false,"copilot_natural_language_github_search":false,"private_avatars":false,"reserved_domain":true,"projects_classic_sunset_override":false,"issues_react_bypass_es_limits":true,"notifyd_issue_watch_activity_notify":false,"notifyd_enable_issue_thread_subscriptions":false,"timeline_best_effort_count_optimization":false,"copilot_auto_assign_metadata":false,"issues_react_create_milestone":true,"issues_react_preload_labels":true,"copilot_workspace_cross_repo_selection":false,"copilot_agent_mode":true,"issues_react_duplicate_issue":false,"issues_react_force_turbo_nav":false,"copilot_swe_agent":false,"issues_dashboard_no_redirects":true,"copilot_plan_brainstorm_with_blackbird":false,"copilot_find_relevant_files":false,"issues_react_dashboard_save_query_refresh":true,"copilot_find_relevant_files_debug":false,"use_dirty_query_in_issues_dashboard_filter_pickers":true,"issues_primer_portal":true,"copilot_workspace":true,"tasklist_block":false,"issues_react_perf_test":false,"elasticsearch_semantic_indexing_issues_show_dupes":false,"issues_semantic_search_preview_opt_in":false,"issues_semantic_search_preview_enabled":false}}}</script>
 
        `;

    const result = await repository.getIssueFromBetaFeatureView(
      testIssueUrl,
      htmlContent,
    );
    expect(result).toEqual({
      assignees: ['HiromiShikata'],
      createdAt: new Date('2024-04-21T09:26:54.000Z'),
      inProgressTimeline: [
        {
          author: 'HiromiShikata',
          durationMinutes: 3.5166666666666666,
          endedAt: new Date('2024-04-21T09:31:46.000Z'),
          issueUrl:
            'https://github.com/HiromiShikata/test-repository/issues/38',
          startedAt: new Date('2024-04-21T09:28:15.000Z'),
        },
        {
          author: 'HiromiShikata',
          durationMinutes: 60.516666666666666,
          endedAt: new Date('2024-04-21T11:13:38.000Z'),
          issueUrl:
            'https://github.com/HiromiShikata/test-repository/issues/38',
          startedAt: new Date('2024-04-21T10:13:07.000Z'),
        },
        {
          author: 'HiromiShikata',
          durationMinutes: 0.05,
          endedAt: new Date('2024-11-23T05:44:10.000Z'),
          issueUrl:
            'https://github.com/HiromiShikata/test-repository/issues/38',
          startedAt: new Date('2024-11-23T05:44:07.000Z'),
        },
        {
          author: 'HiromiShikata',
          durationMinutes: 0.03333333333333333,
          endedAt: new Date('2024-11-23T05:46:27.000Z'),
          issueUrl:
            'https://github.com/HiromiShikata/test-repository/issues/38',
          startedAt: new Date('2024-11-23T05:46:25.000Z'),
        },
      ],
      labels: ['enhancement'],
      project: 'V2 project on owner for testing',
      status: 'Todo',
      statusTimeline: [
        {
          author: 'HiromiShikata',
          from: '',
          time: '2024-04-21T09:28:15Z',
          to: 'In Progress',
        },
        {
          author: 'HiromiShikata',
          from: 'In Progress',
          time: '2024-04-21T09:31:46Z',
          to: 'Todo',
        },
        {
          author: 'HiromiShikata',
          from: 'Todo',
          time: '2024-04-21T10:13:07Z',
          to: 'In Progress',
        },
        {
          author: 'HiromiShikata',
          from: 'In Progress',
          time: '2024-04-21T11:13:38Z',
          to: 'Todo',
        },
        {
          author: 'HiromiShikata',
          from: '',
          time: '2024-09-19T14:03:05Z',
          to: 'Todo',
        },
        {
          author: 'HiromiShikata',
          from: 'Todo',
          time: '2024-11-23T05:44:07Z',
          to: 'In Progress',
        },
        {
          author: 'HiromiShikata',
          from: 'In Progress',
          time: '2024-11-23T05:44:10Z',
          to: 'Todo',
        },
        {
          author: 'github-project-automation',
          from: 'Todo',
          time: '2024-11-23T05:45:50Z',
          to: 'Done',
        },
        {
          author: 'HiromiShikata',
          from: 'Done',
          time: '2024-11-23T05:46:22Z',
          to: 'Todo',
        },
        {
          author: 'HiromiShikata',
          from: 'Todo',
          time: '2024-11-23T05:46:25Z',
          to: 'In Progress',
        },
        {
          author: 'HiromiShikata',
          from: 'In Progress',
          time: '2024-11-23T05:46:27Z',
          to: 'Todo',
        },
      ],
      title: 'In progress test title',
      url: 'https://github.com/HiromiShikata/test-repository/issues/38',
    });
  });
});
