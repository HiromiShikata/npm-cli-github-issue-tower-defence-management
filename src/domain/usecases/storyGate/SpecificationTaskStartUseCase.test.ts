import { mock } from 'jest-mock-extended';
import {
  GithubIssueReference,
  IssueProjectItem,
  IssueProjectItemsSnapshot,
  ProjectItemSingleSelectValueUpdate,
  ProjectSingleSelectField,
  StoryGateIssueRepository,
  StoryGateIssueState,
} from '../adapter-interfaces/StoryGateIssueRepository';
import { SpecificationTaskStartUseCase } from './SpecificationTaskStartUseCase';

const ISSUE: GithubIssueReference = {
  owner: 'example-org',
  repo: 'repo',
  number: 1,
  url: 'https://github.com/example-org/repo/issues/1',
};

const AGENT_FIELD: ProjectSingleSelectField = {
  fieldId: 'FIELD_agent',
  options: [
    { id: 'OPT_agent_developer', name: 'developer-agent', color: 'BLUE' },
    { id: 'OPT_agent_spec', name: 'spec-agent', color: 'GREEN' },
  ],
};

const STATUS_FIELD: ProjectSingleSelectField = {
  fieldId: 'FIELD_status',
  options: [
    { id: 'OPT_status_in_progress', name: 'In Progress', color: 'YELLOW' },
    { id: 'OPT_status_awaiting', name: 'Awaiting Workspace', color: 'BLUE' },
  ],
};

const projectItem = (
  overrides: Partial<IssueProjectItem> = {},
): IssueProjectItem => ({
  projectId: 'PVT_board',
  itemId: 'ITEM_1',
  storyField: null,
  storyName: 'feature A',
  agentField: AGENT_FIELD,
  agentName: 'developer-agent',
  statusField: STATUS_FIELD,
  statusName: 'In Progress',
  ...overrides,
});

const optionNameOf = (
  field: ProjectSingleSelectField | null,
  optionId: string,
): string | null =>
  field?.options.find((option) => option.id === optionId)?.name ?? null;

const itemUpdate = (
  item: IssueProjectItem,
  update: ProjectItemSingleSelectValueUpdate,
): IssueProjectItem => {
  if (item.itemId !== update.itemId) {
    return item;
  }
  if (item.agentField?.fieldId === update.fieldId) {
    return {
      ...item,
      agentName: optionNameOf(item.agentField, update.optionId),
    };
  }
  if (item.statusField?.fieldId === update.fieldId) {
    return {
      ...item,
      statusName: optionNameOf(item.statusField, update.optionId),
    };
  }
  return item;
};

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
    async (update) => {
      if (appliesUpdates) {
        current = {
          ...current,
          items: current.items.map((item) => itemUpdate(item, update)),
        };
      }
    },
  );
  return repository;
};

describe('SpecificationTaskStartUseCase', () => {
  it('sets the Agent and Status fields and reads both back', async () => {
    const repository = repositoryCreate(
      { state: 'OPEN', items: [projectItem()] },
      true,
    );

    const result = await new SpecificationTaskStartUseCase(repository).run({
      issue: ISSUE,
      specificationAgentName: 'spec-agent',
      dryRun: false,
    });

    expect(result.outcome).toBe('STARTED');
    expect(result.readBackAgentName).toBe('spec-agent');
    expect(result.readBackStatusName).toBe('Awaiting Workspace');
    const updates =
      repository.updateProjectItemSingleSelectValue.mock.calls.map(
        ([update]) => update,
      );
    expect(updates).toHaveLength(2);
    expect(updates).toEqual(
      expect.arrayContaining([
        {
          projectId: 'PVT_board',
          itemId: 'ITEM_1',
          fieldId: 'FIELD_agent',
          optionId: 'OPT_agent_spec',
        },
        {
          projectId: 'PVT_board',
          itemId: 'ITEM_1',
          fieldId: 'FIELD_status',
          optionId: 'OPT_status_awaiting',
        },
      ]),
    );
  });

  const writeNothingCases: {
    name: string;
    state: StoryGateIssueState;
    items: IssueProjectItem[];
    dryRun: boolean;
    outcome: string;
  }[] = [
    {
      name: 'the issue is closed',
      state: 'CLOSED',
      items: [projectItem()],
      dryRun: false,
      outcome: 'ISSUE_CLOSED',
    },
    {
      name: 'the Agent field has no option for the specification agent',
      state: 'OPEN',
      items: [
        projectItem({
          agentField: {
            fieldId: 'FIELD_agent',
            options: [
              {
                id: 'OPT_agent_developer',
                name: 'developer-agent',
                color: 'BLUE',
              },
            ],
          },
        }),
      ],
      dryRun: false,
      outcome: 'AGENT_OPTION_NOT_FOUND',
    },
    {
      name: 'the Status field has no Awaiting Workspace option',
      state: 'OPEN',
      items: [
        projectItem({
          statusField: {
            fieldId: 'FIELD_status',
            options: [
              {
                id: 'OPT_status_in_progress',
                name: 'In Progress',
                color: 'YELLOW',
              },
            ],
          },
        }),
      ],
      dryRun: false,
      outcome: 'STATUS_OPTION_NOT_FOUND',
    },
    {
      name: 'the issue is in no project',
      state: 'OPEN',
      items: [],
      dryRun: false,
      outcome: 'ISSUE_NOT_IN_PROJECT',
    },
    {
      name: 'the run is a dry run',
      state: 'OPEN',
      items: [projectItem()],
      dryRun: true,
      outcome: 'SKIPPED_DRY_RUN',
    },
  ];

  it.each(writeNothingCases)(
    'writes nothing and reports $outcome when $name',
    async ({ state, items, dryRun, outcome }) => {
      const repository = repositoryCreate({ state, items }, true);

      const result = await new SpecificationTaskStartUseCase(repository).run({
        issue: ISSUE,
        specificationAgentName: 'spec-agent',
        dryRun,
      });

      expect(result.outcome).toBe(outcome);
      expect(repository.updateProjectItemSingleSelectValue.mock.calls).toEqual(
        [],
      );
    },
  );

  it('reports READ_BACK_MISMATCH after writing when the read-back differs', async () => {
    const repository = repositoryCreate(
      { state: 'OPEN', items: [projectItem()] },
      false,
    );

    const result = await new SpecificationTaskStartUseCase(repository).run({
      issue: ISSUE,
      specificationAgentName: 'spec-agent',
      dryRun: false,
    });

    expect(result.outcome).toBe('READ_BACK_MISMATCH');
    expect(
      repository.updateProjectItemSingleSelectValue.mock.calls.length,
    ).toBeGreaterThan(0);
  });
});
