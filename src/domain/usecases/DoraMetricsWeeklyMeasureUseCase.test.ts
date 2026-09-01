import { mock } from 'jest-mock-extended';
import { DoraMetricsWeeklyMeasureUseCase } from './DoraMetricsWeeklyMeasureUseCase';
import { GithubActionsRepository } from './adapter-interfaces/GithubActionsRepository';
import { ProjectDoraConfig } from '../entities/DoraMetrics';

const xcare: ProjectDoraConfig = {
  name: 'xcare',
  owner: 'xcare-medical',
  repo: 'xcare-platform',
  deployWorkflowFiles: ['deploy.yml'],
  deployBranch: 'production',
  prBaseBranch: 'production',
  mttrLabels: ['hotfix', 'incident'],
  ghTokenEnvVar: null,
};

const since = new Date('2026-01-01T00:00:00Z');
const until = new Date('2026-01-08T00:00:00Z');

describe('DoraMetricsWeeklyMeasureUseCase', () => {
  describe('run', () => {
    const mockRepo = mock<GithubActionsRepository>();
    const mockCreateNewIssue = jest.fn<
      Promise<number>,
      Parameters<
        (
          owner: string,
          repo: string,
          title: string,
          body: string,
          assignees: string[],
          labels: string[],
        ) => Promise<number>
      >
    >();
    const useCase = new DoraMetricsWeeklyMeasureUseCase(
      mockRepo,
      mockCreateNewIssue,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      mockRepo.getWorkflowRuns.mockResolvedValue([]);
      mockRepo.getMergedPullRequests.mockResolvedValue([]);
      mockRepo.getClosedItemsByLabels.mockResolvedValue([]);
      mockCreateNewIssue.mockResolvedValue(1);
    });

    const testCases = [
      {
        name: 'creates report issue with title containing report date',
        setup: () => {},
        params: {
          projects: [xcare],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          expect(mockCreateNewIssue.mock.calls[0]?.[2]).toContain(
            'DORAメトリクス週次レポート 2026-01-08',
          );
          expect(mockCreateNewIssue.mock.calls[0]?.[0]).toBe('HiromiShikata');
          expect(mockCreateNewIssue.mock.calls[0]?.[1]).toBe(
            'umino-corporait-operation',
          );
        },
      },
      {
        name: 'counts all workflow runs across multiple workflow files as deploy frequency',
        setup: () => {
          mockRepo.getWorkflowRuns
            .mockResolvedValueOnce([
              {
                conclusion: 'success',
                createdAt: new Date('2026-01-02T00:00:00Z'),
                updatedAt: new Date('2026-01-02T01:00:00Z'),
              },
              {
                conclusion: 'success',
                createdAt: new Date('2026-01-04T00:00:00Z'),
                updatedAt: new Date('2026-01-04T01:00:00Z'),
              },
            ])
            .mockResolvedValueOnce([
              {
                conclusion: 'failure',
                createdAt: new Date('2026-01-06T00:00:00Z'),
                updatedAt: new Date('2026-01-06T01:00:00Z'),
              },
            ]);
        },
        params: {
          projects: [
            { ...xcare, deployWorkflowFiles: ['wf-a.yml', 'wf-b.yml'] },
          ],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          const body = mockCreateNewIssue.mock.calls[0]?.[3] ?? '';
          expect(body).toContain('| xcare | 3 |');
        },
      },
      {
        name: 'calculates change failure rate as ratio of failed runs',
        setup: () => {
          mockRepo.getWorkflowRuns.mockResolvedValue([
            {
              conclusion: 'success',
              createdAt: new Date('2026-01-02T00:00:00Z'),
              updatedAt: new Date('2026-01-02T01:00:00Z'),
            },
            {
              conclusion: 'success',
              createdAt: new Date('2026-01-03T00:00:00Z'),
              updatedAt: new Date('2026-01-03T01:00:00Z'),
            },
            {
              conclusion: 'success',
              createdAt: new Date('2026-01-04T00:00:00Z'),
              updatedAt: new Date('2026-01-04T01:00:00Z'),
            },
            {
              conclusion: 'failure',
              createdAt: new Date('2026-01-06T00:00:00Z'),
              updatedAt: new Date('2026-01-06T01:00:00Z'),
            },
          ]);
        },
        params: {
          projects: [xcare],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          const body = mockCreateNewIssue.mock.calls[0]?.[3] ?? '';
          expect(body).toContain('25.0%');
        },
      },
      {
        name: 'reports N/A for change failure rate when no workflow runs',
        setup: () => {
          mockRepo.getWorkflowRuns.mockResolvedValue([]);
        },
        params: {
          projects: [xcare],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          const body = mockCreateNewIssue.mock.calls[0]?.[3] ?? '';
          expect(body).toMatch(/xcare \| 0 \| N\/A/);
        },
      },
      {
        name: 'calculates MTTR as average open-to-close time for hotfix items',
        setup: () => {
          mockRepo.getClosedItemsByLabels.mockResolvedValue([
            {
              createdAt: new Date('2026-01-02T00:00:00Z'),
              closedAt: new Date('2026-01-02T04:00:00Z'),
            },
            {
              createdAt: new Date('2026-01-04T00:00:00Z'),
              closedAt: new Date('2026-01-04T08:00:00Z'),
            },
          ]);
        },
        params: {
          projects: [xcare],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          const body = mockCreateNewIssue.mock.calls[0]?.[3] ?? '';
          expect(body).toContain('6.0');
        },
      },
      {
        name: 'calls getWorkflowRuns with correct project owner repo branch and since',
        setup: () => {},
        params: {
          projects: [xcare],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          expect(mockRepo.getWorkflowRuns).toHaveBeenCalledWith(
            'xcare-medical',
            'xcare-platform',
            'deploy.yml',
            'production',
            since,
            until,
          );
        },
      },
      {
        name: 'uses PR cycle time as lead time for projects without deploy workflow runs',
        setup: () => {
          mockRepo.getWorkflowRuns.mockResolvedValue([]);
          mockRepo.getMergedPullRequests.mockResolvedValue([
            {
              createdAt: new Date('2026-01-02T00:00:00Z'),
              mergedAt: new Date('2026-01-02T06:00:00Z'),
            },
            {
              createdAt: new Date('2026-01-04T00:00:00Z'),
              mergedAt: new Date('2026-01-04T12:00:00Z'),
            },
          ]);
        },
        params: {
          projects: [{ ...xcare, deployWorkflowFiles: [] }],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          const body = mockCreateNewIssue.mock.calls[0]?.[3] ?? '';
          expect(body).toContain('9.0');
        },
      },
      {
        name: 'uses merged PR count as deploy frequency for projects without deploy workflow files',
        setup: () => {
          mockRepo.getMergedPullRequests.mockResolvedValue([
            {
              createdAt: new Date('2026-01-02T00:00:00Z'),
              mergedAt: new Date('2026-01-02T06:00:00Z'),
            },
            {
              createdAt: new Date('2026-01-04T00:00:00Z'),
              mergedAt: new Date('2026-01-04T12:00:00Z'),
            },
          ]);
        },
        params: {
          projects: [{ ...xcare, deployWorkflowFiles: [] }],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          const body = mockCreateNewIssue.mock.calls[0]?.[3] ?? '';
          expect(body).toMatch(/xcare \| 2 \| N\/A/);
        },
      },
      {
        name: 'calculates change lead time using earliest post-merge run when runs returned in descending order',
        setup: () => {
          mockRepo.getWorkflowRuns.mockResolvedValue([
            {
              conclusion: 'success',
              createdAt: new Date('2026-01-05T00:00:00Z'),
              updatedAt: new Date('2026-01-05T01:00:00Z'),
            },
            {
              conclusion: 'success',
              createdAt: new Date('2026-01-02T02:00:00Z'),
              updatedAt: new Date('2026-01-02T03:00:00Z'),
            },
          ]);
          mockRepo.getMergedPullRequests.mockResolvedValue([
            {
              mergedAt: new Date('2026-01-02T00:00:00Z'),
              createdAt: new Date('2026-01-01T00:00:00Z'),
            },
          ]);
        },
        params: {
          projects: [xcare],
          reportOwner: 'HiromiShikata',
          reportRepo: 'umino-corporait-operation',
          since,
          until,
        },
        assert: () => {
          const body = mockCreateNewIssue.mock.calls[0]?.[3] ?? '';
          expect(body).toContain('3.0');
        },
      },
    ];

    testCases.forEach(({ name, setup, params, assert }) => {
      it(name, async () => {
        jest.clearAllMocks();
        mockRepo.getWorkflowRuns.mockResolvedValue([]);
        mockRepo.getMergedPullRequests.mockResolvedValue([]);
        mockRepo.getClosedItemsByLabels.mockResolvedValue([]);
        mockCreateNewIssue.mockResolvedValue(1);
        setup();
        await useCase.run(params);
        assert();
      });
    });
  });
});
