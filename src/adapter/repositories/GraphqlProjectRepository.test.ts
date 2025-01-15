import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { RestIssueRepository } from './issue/RestIssueRepository';
import axios from 'axios';

interface ProjectItemNode {
  id: string;
  content: {
    number: number;
    repository: {
      name: string;
      owner: {
        login: string;
      };
    };
  };
}

interface ProjectItemsData {
  data: {
    node: {
      items: {
        nodes: ProjectItemNode[];
      };
    };
  };
}

interface SimpleProjectItemsData {
  data: {
    node: {
      items: {
        nodes: SimpleProjectItemNode[];
      };
    };
  };
}

type GraphQLProjectItemsResponse = {
  data: ProjectItemsData;
};

type GraphQLSimpleProjectItemsResponse = {
  data: SimpleProjectItemsData;
};

type ProjectItemNodeType = ProjectItemNode;
type SimpleProjectItemNodeType = SimpleProjectItemNode;

interface SimpleProjectItemNode {
  id: string;
}

describe('GraphqlProjectRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectRepository;
  const token = process.env.GH_TOKEN;
  const login = 'HiromiShikata';
  const projectUrl = `https://github.com/users/HiromiShikata/projects/49`;
  const projectNumber = 49;
  const projectId = 'PVT_kwHOAGJHa84AFhgF';

  beforeEach(() => {
    repository = new GraphqlProjectRepository(localStorageRepository, token);
  });

  describe('fetchProjectId', () => {
    it('should fetch project ID using GraphQL API', async () => {
      const response = await repository.fetchProjectId(login, projectNumber);

      expect(response).toEqual(projectId);
    });
  });

  describe('findProjectIdByUrl', () => {
    it('should extract project ID from URL and fetch it', async () => {
      const response = await repository.findProjectIdByUrl(projectUrl);
      expect(response).toEqual(projectId);
    });
  });

  describe('getProject', () => {
    it('should retrieve project details', async () => {
      const project = await repository.getProject(projectId);
      expect(project).toEqual({
        id: 'PVT_kwHOAGJHa84AFhgF',
        name: 'V2 project on owner for testing',
        nextActionDate: {
          fieldId: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
          name: 'NextActionDate',
        },
        nextActionHour: null,
        remainingEstimationMinutes: null,
        story: null,
        completionDate50PercentConfidence: null,
        dependedIssueUrlSeparatedByComma: null,

        status: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
          name: 'Status',
          statuses: [
            {
              color: 'GRAY',
              description: '',
              id: 'f75ad846',
              name: 'Todo',
            },
            {
              color: 'GRAY',
              description: '',
              id: '47fc9ee4',
              name: 'In Progress',
            },
            {
              color: 'GRAY',
              description: '',
              id: '98236657',
              name: 'Done',
            },
          ],
        },
      });
    });
  });

  describe('removeItemFromProject', () => {
    let testIssueNumber: number;
    let testItemId: string;

    beforeAll(async () => {
      // Create a test issue
      const restIssueRepository = new RestIssueRepository(
        localStorageRepository,
        '',
        token,
      );
      testIssueNumber = await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'Test Issue for Project Item Removal',
        'This is a test issue created for testing project item removal.',
        ['HiromiShikata'],
        ['test'],
      );

      // Wait for the issue to be added to the project
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Find the item ID in the project
      const query = `query FindProjectItem($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: $first) {
              nodes {
                id
                content {
                  ... on Issue {
                    number
                    repository {
                      name
                      owner {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;

      const findItemResponse = await axios.post<GraphQLProjectItemsResponse>(
        'https://api.github.com/graphql',
        {
          query,
          variables: {
            projectId,
            first: 100,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const foundItem = findItemResponse.data.data.data.node.items.nodes.find(
        (item: ProjectItemNodeType) =>
          item.content.number === testIssueNumber &&
          item.content.repository.name === 'test-repository' &&
          item.content.repository.owner.login === 'HiromiShikata',
      );

      if (!foundItem) {
        throw new Error('Test item not found in project');
      }

      testItemId = foundItem.id;
    });

    it('should remove item from project successfully', async () => {
      await expect(
        repository.removeItemFromProject(projectId, testItemId),
      ).resolves.not.toThrow();

      // Verify the item was actually removed
      const query = `query VerifyItemRemoval($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: $first) {
              nodes {
                id
              }
            }
          }
        }
      }`;

      const verifyResponse =
        await axios.post<GraphQLSimpleProjectItemsResponse>(
          'https://api.github.com/graphql',
          {
            query,
            variables: {
              projectId,
              first: 100,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

      const items = verifyResponse.data.data.data.node.items.nodes;
      expect(
        items.find((item: SimpleProjectItemNodeType) => item.id === testItemId),
      ).toBeUndefined();
    });

    it('should throw error when project or item not found', async () => {
      const invalidItemId = 'invalid_item_id';
      await expect(
        repository.removeItemFromProject(projectId, invalidItemId),
      ).rejects.toThrow('Project or item not found');
    });
  });

  describe('removeItemFromProjectByIssueUrl', () => {
    let testIssueNumber: number;
    let testIssueUrl: string;

    beforeAll(async () => {
      // Create a test issue
      const restIssueRepository = new RestIssueRepository(
        localStorageRepository,
        '',
        token,
      );
      testIssueNumber = await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'Test Issue for Project Item Removal by URL',
        'This is a test issue created for testing project item removal by URL.',
        ['HiromiShikata'],
        ['test'],
      );

      testIssueUrl = `https://github.com/HiromiShikata/test-repository/issues/${testIssueNumber}`;

      // Wait for the issue to be added to the project
      await new Promise((resolve) => setTimeout(resolve, 5000));
    });

    it('should remove item by issue URL successfully', async () => {
      await expect(
        repository.removeItemFromProjectByIssueUrl(projectUrl, testIssueUrl),
      ).resolves.not.toThrow();

      // Verify the item was actually removed by checking it's not in the project
      const query = `query VerifyItemRemoval($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: $first) {
              nodes {
                content {
                  ... on Issue {
                    number
                    repository {
                      name
                      owner {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;

      const verifyRemovalResponse =
        await axios.post<GraphQLProjectItemsResponse>(
          'https://api.github.com/graphql',
          {
            query,
            variables: {
              projectId,
              first: 100,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

      const items = verifyRemovalResponse.data.data.data.node.items.nodes;
      const matchingItem = items.find(
        (item: ProjectItemNodeType) =>
          item.content.number === testIssueNumber &&
          item.content.repository.name === 'test-repository' &&
          item.content.repository.owner.login === 'HiromiShikata',
      );
      expect(matchingItem).toBeUndefined();
    });

    it('should throw error when project not found', async () => {
      const invalidProjectUrl =
        'https://github.com/users/HiromiShikata/projects/999';
      await expect(
        repository.removeItemFromProjectByIssueUrl(
          invalidProjectUrl,
          testIssueUrl,
        ),
      ).rejects.toThrow('Project not found');
    });

    it('should throw error when issue not found in project', async () => {
      const nonExistentIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/999999';
      await expect(
        repository.removeItemFromProjectByIssueUrl(
          projectUrl,
          nonExistentIssueUrl,
        ),
      ).rejects.toThrow('Item not found in project');
    });
  });
});
