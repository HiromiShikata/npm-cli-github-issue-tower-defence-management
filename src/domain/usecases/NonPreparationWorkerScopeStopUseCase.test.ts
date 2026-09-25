import { NonPreparationWorkerScopeStopUseCase } from './NonPreparationWorkerScopeStopUseCase';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { Issue } from '../entities/Issue';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockTmuxSessionRepository = (): Mocked<
  Pick<
    TmuxSessionRepository,
    'listRunningWorkerScopeUnitNames' | 'stopWorkerScopeUnit'
  >
> => ({
  listRunningWorkerScopeUnitNames: jest.fn(),
  stopWorkerScopeUnit: jest.fn(),
});

const buildIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'owner/repo',
  number: 1,
  title: 'title',
  state: 'OPEN',
  status: PREPARATION_STATUS_NAME,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/owner/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'owner',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'author',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

describe('NonPreparationWorkerScopeStopUseCase', () => {
  it('keeps a running worker scope whose issue Status is Preparation', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-owner-repo-1-100.scope',
    ]);
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: PREPARATION_STATUS_NAME,
        }),
      ],
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it.each([DONE_STATUS_NAME, AWAITING_WORKSPACE_STATUS_NAME, 'Icebox'])(
    'stops a running worker scope whose issue Status is %s',
    async (status) => {
      const tmuxSessionRepository = createMockTmuxSessionRepository();
      tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
        'aw-owner-repo-1-100.scope',
      ]);
      const useCase = new NonPreparationWorkerScopeStopUseCase(
        tmuxSessionRepository,
      );

      const result = await useCase.run({
        issues: [buildIssue({ org: 'owner', repo: 'repo', number: 1, status })],
      });

      expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledWith(
        'aw-owner-repo-1-100.scope',
      );
      expect(result.stoppedScopeUnitNames).toEqual([
        'aw-owner-repo-1-100.scope',
      ]);
    },
  );

  it('skips a running worker scope whose unit name matches no known issue', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-someorg-somerepo-999-1234.scope',
    ]);
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: DONE_STATUS_NAME,
        }),
      ],
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it('returns an empty result when no worker scopes are running', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([]);
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
    );

    const result = await useCase.run({ issues: [] });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it('stops every non-Preparation scope and keeps every Preparation scope in one run', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-owner-repo-1-100.scope',
      'aw-owner-repo-2-200.scope',
    ]);
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: PREPARATION_STATUS_NAME,
          url: 'https://github.com/owner/repo/issues/1',
        }),
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 2,
          status: DONE_STATUS_NAME,
          url: 'https://github.com/owner/repo/issues/2',
        }),
      ],
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledTimes(1);
    expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledWith(
      'aw-owner-repo-2-200.scope',
    );
    expect(result.stoppedScopeUnitNames).toEqual(['aw-owner-repo-2-200.scope']);
  });

  it('collects failures into an AggregateError and still stops the scopes that succeed', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-owner-repo-1-100.scope',
      'aw-owner-repo-2-200.scope',
    ]);
    tmuxSessionRepository.stopWorkerScopeUnit.mockImplementation(
      async (scopeUnitName: string) => {
        if (scopeUnitName === 'aw-owner-repo-1-100.scope') {
          throw new Error('stop failed');
        }
      },
    );
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
    );

    await expect(
      useCase.run({
        issues: [
          buildIssue({
            org: 'owner',
            repo: 'repo',
            number: 1,
            status: DONE_STATUS_NAME,
            url: 'https://github.com/owner/repo/issues/1',
          }),
          buildIssue({
            org: 'owner',
            repo: 'repo',
            number: 2,
            status: DONE_STATUS_NAME,
            url: 'https://github.com/owner/repo/issues/2',
          }),
        ],
      }),
    ).rejects.toThrow(AggregateError);
    expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledWith(
      'aw-owner-repo-2-200.scope',
    );
  });
});
