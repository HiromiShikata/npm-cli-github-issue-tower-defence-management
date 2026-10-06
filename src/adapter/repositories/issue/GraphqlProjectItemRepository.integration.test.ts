import { mock } from 'jest-mock-extended';
import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { ApiV3CheerioRestIssueRepository } from './ApiV3CheerioRestIssueRepository';
import type { ApiV3IssueRepository } from './ApiV3IssueRepository';
import type { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import type { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
import type { DateRepository } from '../../../domain/usecases/adapter-interfaces/DateRepository';
import { findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition } from './findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition';

const liveToken = process.env.GH_TOKEN;
const describeWhenLiveCredentials = liveToken ? describe : describe.skip;

const requireGraphqlProjectItemRepositoryClassWithRealUnmockedKyHttpClient =
  (): typeof GraphqlProjectItemRepository => {
    jest.resetModules();
    jest.unmock('ky');
    return jest.requireActual<{
      GraphqlProjectItemRepository: typeof GraphqlProjectItemRepository;
    }>('./GraphqlProjectItemRepository').GraphqlProjectItemRepository;
  };

describeWhenLiveCredentials(
  'GraphqlProjectItemRepository (live GitHub GraphQL API)',
  () => {
    const localStorageRepository = new LocalStorageRepository();
    let repository: GraphqlProjectItemRepository;
    const projectId = 'PVT_kwHOAGJHa84AFhgF';
    const storyFieldId = 'PVTSSF_lAHOAGJHa84AFhgFzg1oBms';
    const knownStoryOption = { id: 'af410dae', name: 'story1' };
    const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    let disposableIssueUrl: string;
    let disposableItemId: string;

    beforeAll(async () => {
      const LiveGraphqlProjectItemRepository =
        requireGraphqlProjectItemRepositoryClassWithRealUnmockedKyHttpClient();
      repository = new LiveGraphqlProjectItemRepository(
        localStorageRepository,
        liveToken,
      );
      const restIssueRepository = new RestIssueRepository(
        localStorageRepository,
        liveToken,
      );
      const issueNumber = await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        `disposable fixture for GraphqlProjectItemRepository live test ${uniqueSuffix}`,
        'Created by the GraphqlProjectItemRepository live integration test. Safe to close.',
        [],
        [],
      );
      disposableIssueUrl = `https://github.com/HiromiShikata/test-repository/issues/${issueNumber}`;
      disposableItemId = await repository.addIssueToProject(
        projectId,
        disposableIssueUrl,
      );
      await repository.updateProjectField(
        projectId,
        storyFieldId,
        disposableItemId,
        { singleSelectOptionId: knownStoryOption.id },
      );
    });

    afterAll(async () => {
      await repository.removeItemFromProjectByIssueUrl(
        disposableIssueUrl,
        projectId,
      );
      const apiV3CheerioRestIssueRepository =
        new ApiV3CheerioRestIssueRepository(
          mock<ApiV3IssueRepository>(),
          mock<RestIssueRepository>(),
          mock<GraphqlProjectItemRepository>(),
          mock<LocalStorageCacheRepository>(),
          mock<ProjectRepository>(),
          mock<DateRepository>(),
          localStorageRepository,
          liveToken,
        );
      await apiV3CheerioRestIssueRepository.closeIssueByUrl(
        disposableIssueUrl,
        'not_planned',
      );
    });

    describe('fetchProjectItems', () => {
      it('returns the Story field with the real optionId the live GraphQL API assigned, proving the query actually selects optionId', async () => {
        const targetItem =
          await findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition(
            repository,
            projectId,
            disposableItemId,
          );
        expect(targetItem).toBeDefined();
        const storyField = targetItem?.customFields.find(
          (field) => field.name === 'Story',
        );
        expect(storyField).toEqual({
          name: 'Story',
          value: knownStoryOption.name,
          optionId: knownStoryOption.id,
        });
      }, 150000);
    });
  },
);
