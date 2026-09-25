import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import {
  IssueSnapshotCheckedFieldName,
  IssueSnapshotStaleness,
  issueSnapshotStalenessCheck,
} from './issueSnapshotStalenessCheck';

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'user',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const project: Project = {
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: { name: 'Status', fieldId: 'status-field', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

describe('issueSnapshotStalenessCheck', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it.each<{
    label: string;
    snapshotIssue: Issue;
    liveIssue: Issue | null;
    checkedFieldNames: IssueSnapshotCheckedFieldName[];
    expectedStaleness: IssueSnapshotStaleness;
    expectedWarnings: string[];
  }>([
    {
      label:
        'reports current when every checked field still equals the live value',
      snapshotIssue: createIssue({ story: null, status: 'Awaiting Owner' }),
      liveIssue: createIssue({ story: null, status: 'Awaiting Owner' }),
      checkedFieldNames: ['story', 'status'],
      expectedStaleness: {
        type: 'current',
        liveIssue: createIssue({ story: null, status: 'Awaiting Owner' }),
      },
      expectedWarnings: [],
    },
    {
      label:
        'reports current when only a field that is not checked changed after the snapshot',
      snapshotIssue: createIssue({ story: null, agent: null }),
      liveIssue: createIssue({ story: null, agent: 'developer' }),
      checkedFieldNames: ['story'],
      expectedStaleness: {
        type: 'current',
        liveIssue: createIssue({ story: null, agent: 'developer' }),
      },
      expectedWarnings: [],
    },
    {
      label: 'reports stale when a checked field changed after the snapshot',
      snapshotIssue: createIssue({ story: null }),
      liveIssue: createIssue({ story: 'regular / workflow management' }),
      checkedFieldNames: ['story'],
      expectedStaleness: {
        type: 'stale',
        liveIssue: createIssue({ story: 'regular / workflow management' }),
        changedFieldNames: ['story'],
      },
      expectedWarnings: [
        'Skipping the NO STORY Story write for https://github.com/user/repo/issues/1 because story changed from null to "regular / workflow management" after the item snapshot was taken.',
      ],
    },
    {
      label: 'lists every checked field that changed after the snapshot',
      snapshotIssue: createIssue({
        status: 'Done',
        stateReason: 'REOPENED',
        isClosed: false,
      }),
      liveIssue: createIssue({
        status: 'In Tmux by agent',
        stateReason: 'COMPLETED',
        isClosed: true,
      }),
      checkedFieldNames: ['status', 'stateReason', 'isClosed'],
      expectedStaleness: {
        type: 'stale',
        liveIssue: createIssue({
          status: 'In Tmux by agent',
          stateReason: 'COMPLETED',
          isClosed: true,
        }),
        changedFieldNames: ['status', 'stateReason', 'isClosed'],
      },
      expectedWarnings: [
        'Skipping the NO STORY Story write for https://github.com/user/repo/issues/1 because status changed from "Done" to "In Tmux by agent", stateReason changed from "REOPENED" to "COMPLETED", isClosed changed from false to true after the item snapshot was taken.',
      ],
    },
    {
      label:
        'reports removedFromProject when the item is no longer on the project',
      snapshotIssue: createIssue(),
      liveIssue: null,
      checkedFieldNames: ['story'],
      expectedStaleness: { type: 'removedFromProject' },
      expectedWarnings: [
        'Skipping the NO STORY Story write for https://github.com/user/repo/issues/1 because the item is no longer on project https://github.com/users/user/projects/1.',
      ],
    },
  ])(
    '$label',
    async ({
      snapshotIssue,
      liveIssue,
      checkedFieldNames,
      expectedStaleness,
      expectedWarnings,
    }) => {
      const issueRepository: Pick<IssueRepository, 'get'> = {
        get: jest.fn().mockResolvedValue(liveIssue),
      };

      const staleness = await issueSnapshotStalenessCheck({
        issueRepository,
        project,
        snapshotIssue,
        checkedFieldNames,
        skippedWriteDescription: 'the NO STORY Story write',
      });

      expect(staleness).toEqual(expectedStaleness);
      expect(issueRepository.get).toHaveBeenCalledTimes(1);
      expect(issueRepository.get).toHaveBeenCalledWith(
        snapshotIssue.url,
        project,
      );
      expect(warnSpy.mock.calls).toEqual(
        expectedWarnings.map((warning) => [warning]),
      );
    },
  );

  it('propagates a failure of the live item read to the caller', async () => {
    const issueRepository: Pick<IssueRepository, 'get'> = {
      get: jest
        .fn()
        .mockRejectedValue(new Error('GraphQL rate limit exceeded')),
    };

    await expect(
      issueSnapshotStalenessCheck({
        issueRepository,
        project,
        snapshotIssue: createIssue(),
        checkedFieldNames: ['story'],
        skippedWriteDescription: 'the NO STORY Story write',
      }),
    ).rejects.toThrow('GraphQL rate limit exceeded');
  });
});
