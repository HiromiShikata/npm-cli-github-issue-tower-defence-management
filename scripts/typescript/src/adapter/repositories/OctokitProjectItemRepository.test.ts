import { OctokitProjectItemRepository } from './OctokitProjectItemRepository';

type GraphqlCallArgs = [string, Record<string, unknown>];

type JestMockUnspecifiedResolvedValueType<M> = M extends jest.Mock<
  infer ResolvedValueType
>
  ? ResolvedValueType
  : never;

type JestMockDefaultResolvedValueType =
  JestMockUnspecifiedResolvedValueType<jest.Mock>;

const createFakeGraphqlClient = (): {
  graphql: jest.Mock<JestMockDefaultResolvedValueType, GraphqlCallArgs>;
} => ({
  graphql: jest.fn<JestMockDefaultResolvedValueType, GraphqlCallArgs>(),
});

describe('OctokitProjectItemRepository', () => {
  describe('addItem', () => {
    test('resolves the added item id when the mutation succeeds', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        addProjectV2ItemById: { item: { id: 'PVTI_xxx' } },
      });
      const repository = new OctokitProjectItemRepository(client);

      const itemId = await repository.addItem({
        projectId: 'PVT_theProjectId',
        contentNodeId: 'I_theContentNodeId',
      });

      expect(itemId).toBe('PVTI_xxx');
    });

    test('sends a GraphQL mutation naming addProjectV2ItemById with the given project and content ids', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        addProjectV2ItemById: { item: { id: 'PVTI_xxx' } },
      });
      const repository = new OctokitProjectItemRepository(client);

      await repository.addItem({
        projectId: 'PVT_theProjectId',
        contentNodeId: 'I_theContentNodeId',
      });

      expect(client.graphql.mock.calls[0][0]).toContain('addProjectV2ItemById');
      expect(client.graphql.mock.calls[0][1]).toEqual({
        projectId: 'PVT_theProjectId',
        contentId: 'I_theContentNodeId',
      });
    });

    test('resolves null when the mutation response has a null item', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        addProjectV2ItemById: { item: null },
      });
      const repository = new OctokitProjectItemRepository(client);

      const itemId = await repository.addItem({
        projectId: 'PVT_theProjectId',
        contentNodeId: 'I_theContentNodeId',
      });

      expect(itemId).toBeNull();
    });

    test('resolves null instead of rejecting when the graphql client rejects', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockRejectedValue(new Error('transient failure'));
      const repository = new OctokitProjectItemRepository(client);

      const itemId = await repository.addItem({
        projectId: 'PVT_theProjectId',
        contentNodeId: 'I_theContentNodeId',
      });

      expect(itemId).toBeNull();
    });
  });

  describe('findExistingItemId', () => {
    test('resolves the id of the node whose project.id matches the given projectId, even when that node is not first in the list', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        node: {
          projectItems: {
            nodes: [
              { id: 'PVTI_other', project: { id: 'PVT_someOtherProject' } },
              { id: 'PVTI_yyy', project: { id: 'PVT_theProjectId' } },
            ],
          },
        },
      });
      const repository = new OctokitProjectItemRepository(client);

      const itemId = await repository.findExistingItemId({
        projectId: 'PVT_theProjectId',
        contentNodeId: 'I_theContentNodeId',
      });

      expect(itemId).toBe('PVTI_yyy');
    });

    test('resolves null when no node matches the given projectId', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        node: {
          projectItems: {
            nodes: [
              { id: 'PVTI_other', project: { id: 'PVT_someOtherProject' } },
            ],
          },
        },
      });
      const repository = new OctokitProjectItemRepository(client);

      const itemId = await repository.findExistingItemId({
        projectId: 'PVT_theProjectId',
        contentNodeId: 'I_theContentNodeId',
      });

      expect(itemId).toBeNull();
    });

    test('resolves null instead of rejecting when the graphql client rejects', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockRejectedValue(new Error('transient failure'));
      const repository = new OctokitProjectItemRepository(client);

      const itemId = await repository.findExistingItemId({
        projectId: 'PVT_theProjectId',
        contentNodeId: 'I_theContentNodeId',
      });

      expect(itemId).toBeNull();
    });
  });

  describe('getStatusFieldOptionName', () => {
    test('resolves the existing status option name', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        node: { fieldValueByName: { name: 'In Progress' } },
      });
      const repository = new OctokitProjectItemRepository(client);

      const statusName = await repository.getStatusFieldOptionName(
        'PVTI_xxx',
      );

      expect(statusName).toBe('In Progress');
    });

    test('resolves an empty string when no status field value is set', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        node: { fieldValueByName: null },
      });
      const repository = new OctokitProjectItemRepository(client);

      const statusName = await repository.getStatusFieldOptionName(
        'PVTI_xxx',
      );

      expect(statusName).toBe('');
    });

    test('rejects (does not swallow) when the graphql client rejects', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockRejectedValue(new Error('permanent failure'));
      const repository = new OctokitProjectItemRepository(client);

      await expect(
        repository.getStatusFieldOptionName('PVTI_xxx'),
      ).rejects.toThrow('permanent failure');
    });
  });

  describe('setStatusFieldOption', () => {
    test('resolves undefined when the mutation succeeds', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        updateProjectV2ItemFieldValue: { projectV2Item: { id: 'PVTI_xxx' } },
      });
      const repository = new OctokitProjectItemRepository(client);

      await expect(
        repository.setStatusFieldOption({
          projectId: 'PVT_theProjectId',
          itemId: 'PVTI_xxx',
          fieldId: 'PVTSSF_theFieldId',
          optionId: 'theOptionId',
        }),
      ).resolves.toBeUndefined();
    });

    test('sends a GraphQL mutation naming updateProjectV2ItemFieldValue with the given ids', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockResolvedValue({
        updateProjectV2ItemFieldValue: { projectV2Item: { id: 'PVTI_xxx' } },
      });
      const repository = new OctokitProjectItemRepository(client);

      await repository.setStatusFieldOption({
        projectId: 'PVT_theProjectId',
        itemId: 'PVTI_xxx',
        fieldId: 'PVTSSF_theFieldId',
        optionId: 'theOptionId',
      });

      expect(client.graphql.mock.calls[0][0]).toContain(
        'updateProjectV2ItemFieldValue',
      );
      expect(client.graphql.mock.calls[0][1]).toEqual({
        projectId: 'PVT_theProjectId',
        itemId: 'PVTI_xxx',
        fieldId: 'PVTSSF_theFieldId',
        optionId: 'theOptionId',
      });
    });

    test('rejects (does not swallow) when the graphql client rejects', async () => {
      const client = createFakeGraphqlClient();
      client.graphql.mockRejectedValue(new Error('permanent failure'));
      const repository = new OctokitProjectItemRepository(client);

      await expect(
        repository.setStatusFieldOption({
          projectId: 'PVT_theProjectId',
          itemId: 'PVTI_xxx',
          fieldId: 'PVTSSF_theFieldId',
          optionId: 'theOptionId',
        }),
      ).rejects.toThrow('permanent failure');
    });
  });
});
