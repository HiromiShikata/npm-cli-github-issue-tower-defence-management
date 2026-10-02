import { buildProjectItemRepositoryFromGraphqlProjectItemRepository } from './buildProjectItemRepositoryFromGraphqlProjectItemRepository';

describe('buildProjectItemRepositoryFromGraphqlProjectItemRepository', () => {
  it('resolves fetchProjectItems to the plain issues array, discarding inconsistencyMessage, and calls the underlying repository with the given projectId', async () => {
    const fetchProjectItems = jest.fn().mockResolvedValue({
      issues: [
        {
          id: 'item-1',
          url: 'https://github.com/o/r/issues/1',
          customFields: [],
        },
      ],
      inconsistencyMessage: 'whatever',
    });
    const removeItemFromProjectByIssueUrl = jest.fn();
    const projectItemRepository =
      buildProjectItemRepositoryFromGraphqlProjectItemRepository({
        fetchProjectItems,
        removeItemFromProjectByIssueUrl,
      });

    const result = await projectItemRepository.fetchProjectItems('project-1');

    expect(fetchProjectItems).toHaveBeenCalledWith('project-1');
    expect(result).toEqual([
      {
        id: 'item-1',
        url: 'https://github.com/o/r/issues/1',
        customFields: [],
      },
    ]);
  });

  it('delegates removeItemFromProjectByIssueUrl directly to the underlying repository with the same arguments and return value', async () => {
    const fetchProjectItems = jest.fn();
    const removeItemFromProjectByIssueUrl = jest
      .fn()
      .mockResolvedValue(undefined);
    const projectItemRepository =
      buildProjectItemRepositoryFromGraphqlProjectItemRepository({
        fetchProjectItems,
        removeItemFromProjectByIssueUrl,
      });

    const result = await projectItemRepository.removeItemFromProjectByIssueUrl(
      'https://github.com/o/r/issues/1',
      'project-1',
    );

    expect(removeItemFromProjectByIssueUrl).toHaveBeenCalledWith(
      'https://github.com/o/r/issues/1',
      'project-1',
    );
    expect(result).toBeUndefined();
  });
});
