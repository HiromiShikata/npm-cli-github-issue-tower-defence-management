import { ApiV3IssueRepository } from './ApiV3IssueRepository';

describe('ApiV3IssueRepository', () => {
  const repository = new ApiV3IssueRepository(
    '',
    process.env.TEST_BOT_GH_TOKEN || 'dummy',
  );
  test('searchIssue', async () => {
    const result = await repository.searchIssue({
      owner: 'HiromiShikata',
      repositoryName: 'test-repository',
      type: 'issue',
      state: 'open',
      title: 'In progress',
      createdFrom: '2024-04-21',
      assignee: 'HiromiShikata',
    });
    expect(result).toEqual([
      {
        number: 38,
        title: 'In progress test title',
        url: 'https://github.com/HiromiShikata/test-repository/issues/38',
      },
    ]);
  });
});
