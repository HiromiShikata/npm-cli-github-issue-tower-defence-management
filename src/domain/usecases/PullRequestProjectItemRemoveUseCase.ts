import { ProjectItemRepository } from './adapter-interfaces/ProjectItemRepository';

export type PullRequestProjectItemBackupRecord = {
  itemId: string;
  url: string;
  statusValue: string | null;
  storyValue: string | null;
};

const isPullRequestItemUrl = (url: string): boolean => /\/pull\/\d+$/.test(url);

const findCustomFieldValue = (
  customFields: { name: string; value: string | null }[],
  fieldName: string,
): string | null => {
  const field = customFields.find(
    (f) => f.name.toLowerCase() === fieldName.toLowerCase(),
  );
  return field?.value ?? null;
};

export class PullRequestProjectItemRemoveUseCase {
  constructor(
    private readonly projectItemRepository: Pick<
      ProjectItemRepository,
      'fetchProjectItems' | 'removeItemFromProjectByIssueUrl'
    >,
  ) {}

  findPullRequestItems = async (
    projectId: string,
  ): Promise<PullRequestProjectItemBackupRecord[]> => {
    const items = await this.projectItemRepository.fetchProjectItems(projectId);
    return items
      .filter((item) => isPullRequestItemUrl(item.url))
      .map((item) => ({
        itemId: item.id,
        url: item.url,
        statusValue: findCustomFieldValue(item.customFields, 'status'),
        storyValue: findCustomFieldValue(item.customFields, 'story'),
      }));
  };

  removeItems = async (
    projectId: string,
    items: Pick<PullRequestProjectItemBackupRecord, 'url'>[],
  ): Promise<{
    succeededUrls: string[];
    failures: { url: string; error: string }[];
  }> => {
    const succeededUrls: string[] = [];
    const failures: { url: string; error: string }[] = [];
    for (const item of items) {
      try {
        await this.projectItemRepository.removeItemFromProjectByIssueUrl(
          item.url,
          projectId,
        );
        succeededUrls.push(item.url);
      } catch (error) {
        failures.push({
          url: item.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { succeededUrls, failures };
  };
}
