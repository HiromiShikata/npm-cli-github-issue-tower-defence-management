import type { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import type { ProjectItemRepository } from '../../../domain/usecases/adapter-interfaces/ProjectItemRepository';

export const buildProjectItemRepositoryFromGraphqlProjectItemRepository = (
  graphqlProjectItemRepository: Pick<
    GraphqlProjectItemRepository,
    'fetchProjectItems' | 'removeItemFromProjectByIssueUrl'
  >,
): Pick<
  ProjectItemRepository,
  'fetchProjectItems' | 'removeItemFromProjectByIssueUrl'
> => ({
  fetchProjectItems: async (projectId) => {
    const { issues } =
      await graphqlProjectItemRepository.fetchProjectItems(projectId);
    return issues;
  },
  removeItemFromProjectByIssueUrl:
    graphqlProjectItemRepository.removeItemFromProjectByIssueUrl,
});
