import { mock } from 'jest-mock-extended';
import {
  GithubIssueReference,
  IssueProjectItem,
  IssueProjectItemsSnapshot,
  ProjectItemSingleSelectValueUpdate,
  ProjectSingleSelectOption,
  StoryGateIssueRepository,
} from '../adapter-interfaces/StoryGateIssueRepository';
import { IssueStorySetIfUnsetUseCase } from './IssueStorySetIfUnsetUseCase';

const ISSUE: GithubIssueReference = {
  owner: 'example-org',
  repo: 'repo',
  number: 1,
  url: 'https://github.com/example-org/repo/issues/1',
};

const STORY_OPTIONS: ProjectSingleSelectOption[] = [
  { id: 'OPT_feature_a', name: 'feature A', color: 'GREEN' },
  { id: 'OPT_feature_b', name: 'feature B', color: 'RED' },
  { id: 'OPT_retired', name: 'retired story', color: 'GRAY' },
];

const storyItem = (storyName: string | null): IssueProjectItem => ({
  projectId: 'PVT_board',
  itemId: 'ITEM_1',
  storyField: { fieldId: 'FIELD_story', options: STORY_OPTIONS },
  storyName,
  agentField: null,
  agentName: null,
  statusField: null,
  statusName: null,
});

const repositoryCreate = (
  initial: IssueProjectItemsSnapshot,
  appliesUpdates: boolean,
) => {
  let current = initial;
  const repository = mock<StoryGateIssueRepository>();
  repository.findIssueProjectItems.mockImplementation(async () => current);
  repository.findIssue.mockImplementation(async (issue) => ({
    url: issue.url,
    state: current.state,
    body: '',
    labels: [],
  }));
  repository.updateProjectItemSingleSelectValue.mockImplementation(
    async (update: ProjectItemSingleSelectValueUpdate) => {
      if (!appliesUpdates) {
        return;
      }
      current = {
        ...current,
        items: current.items.map((item) =>
          item.itemId === update.itemId &&
          item.storyField?.fieldId === update.fieldId
            ? {
                ...item,
                storyName:
                  item.storyField.options.find(
                    (option) => option.id === update.optionId,
                  )?.name ?? null,
              }
            : item,
        ),
      };
    },
  );
  return repository;
};

describe('IssueStorySetIfUnsetUseCase', () => {
  it.each([
    {
      name: 'writes the Story when the live Story is empty',
      items: [storyItem(null)],
      storyName: 'feature A',
      dryRun: false,
      appliesUpdates: true,
      outcome: 'WRITTEN',
      updates: [
        {
          projectId: 'PVT_board',
          itemId: 'ITEM_1',
          fieldId: 'FIELD_story',
          optionId: 'OPT_feature_a',
        },
      ],
    },
    {
      name: 'writes the Story when the live Story is NO STORY',
      items: [storyItem('NO STORY')],
      storyName: 'feature A',
      dryRun: false,
      appliesUpdates: true,
      outcome: 'WRITTEN',
      updates: [
        {
          projectId: 'PVT_board',
          itemId: 'ITEM_1',
          fieldId: 'FIELD_story',
          optionId: 'OPT_feature_a',
        },
      ],
    },
    {
      name: 'writes the Story when the live Story contains no story in lower case',
      items: [storyItem('no story yet')],
      storyName: 'feature B',
      dryRun: false,
      appliesUpdates: true,
      outcome: 'WRITTEN',
      updates: [
        {
          projectId: 'PVT_board',
          itemId: 'ITEM_1',
          fieldId: 'FIELD_story',
          optionId: 'OPT_feature_b',
        },
      ],
    },
    {
      name: 'skips the write on a dry run',
      items: [storyItem(null)],
      storyName: 'feature A',
      dryRun: true,
      appliesUpdates: true,
      outcome: 'SKIPPED_DRY_RUN',
      updates: [],
    },
    {
      name: 'keeps a live Story that is already set',
      items: [storyItem('feature B')],
      storyName: 'feature A',
      dryRun: false,
      appliesUpdates: true,
      outcome: 'LIVE_STORY_ALREADY_SET',
      updates: [],
    },
    {
      name: 'rejects a Story option that does not exist',
      items: [storyItem(null)],
      storyName: 'feature Z',
      dryRun: false,
      appliesUpdates: true,
      outcome: 'OPTION_NOT_ACTIVE',
      updates: [],
    },
    {
      name: 'rejects a GRAY Story option',
      items: [storyItem(null)],
      storyName: 'retired story',
      dryRun: false,
      appliesUpdates: true,
      outcome: 'OPTION_NOT_ACTIVE',
      updates: [],
    },
    {
      name: 'reports an issue that is in no project',
      items: [],
      storyName: 'feature A',
      dryRun: false,
      appliesUpdates: true,
      outcome: 'ISSUE_NOT_IN_PROJECT',
      updates: [],
    },
  ])(
    '$name',
    async ({ items, storyName, dryRun, appliesUpdates, outcome, updates }) => {
      const repository = repositoryCreate(
        { state: 'OPEN', items },
        appliesUpdates,
      );

      const result = await new IssueStorySetIfUnsetUseCase(repository).run({
        issue: ISSUE,
        storyName,
        dryRun,
      });

      expect(result.outcome).toBe(outcome);
      expect(result.issueUrl).toBe(ISSUE.url);
      expect(result.requestedStory).toBe(storyName);
      expect(result.dryRun).toBe(dryRun);
      expect(
        repository.updateProjectItemSingleSelectValue.mock.calls.map(
          ([update]) => update,
        ),
      ).toEqual(updates);
    },
  );

  it('reports READ_BACK_MISMATCH when the read-back differs from the written Story', async () => {
    const repository = repositoryCreate(
      { state: 'OPEN', items: [storyItem(null)] },
      false,
    );

    const result = await new IssueStorySetIfUnsetUseCase(repository).run({
      issue: ISSUE,
      storyName: 'feature A',
      dryRun: false,
    });

    expect(result.outcome).toBe('READ_BACK_MISMATCH');
    expect(
      repository.updateProjectItemSingleSelectValue.mock.calls,
    ).toHaveLength(1);
  });
});
