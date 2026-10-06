import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';

export const projectItemsConnectionReadRetryAttemptsAfterRecentAddition = 25;
export const projectItemsConnectionReadRetryDelayMs = 1000;

export const findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition =
  async (
    projectItemRepository: GraphqlProjectItemRepository,
    targetProjectId: string,
    recentlyAddedItemId: string,
  ): Promise<
    | Awaited<
        ReturnType<GraphqlProjectItemRepository['fetchProjectItems']>
      >['issues'][number]
    | undefined
  > => {
    for (
      let attempt = 0;
      attempt < projectItemsConnectionReadRetryAttemptsAfterRecentAddition;
      attempt++
    ) {
      const { issues: items } =
        await projectItemRepository.fetchProjectItems(targetProjectId);
      const found = items.find((item) => item.id === recentlyAddedItemId);
      if (found !== undefined) {
        return found;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, projectItemsConnectionReadRetryDelayMs),
      );
    }
    return undefined;
  };
