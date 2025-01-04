import { mock } from 'jest-mock-extended';
import { ChangeStatusLongInReviewIssueUseCase } from './ChangeStatusLongInReviewIssueUseCase';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project } from '../entities/Project';
import { WorkingTime } from '../entities/WorkingTime';

describe('ChangeStatusLongInReviewIssueUseCase', () => {
  const mockDateRepository = mock<DateRepository>();
  const mockIssueRepository = mock<IssueRepository>();

  const mockStatus = mock<FieldOption>();
  mockStatus.id = 'status1';
  mockStatus.name = 'ToDo';

  const mockReviewStatus = mock<FieldOption>();
  mockReviewStatus.id = 'status2';
  mockReviewStatus.name = 'InReview';

  const basicProject = {
    ...mock<Project>(),
    status: {
      name: 'Status',
      fieldId: 'status_field',
      statuses: [mockStatus, mockReviewStatus],
    },
  };

  const basicIssue = {
    ...mock<Issue>(),
    isPr: false,
    isClosed: false,
    status: 'InReview',
    assignees: ['user1', 'user2'],
    workingTimeline: [],
  };

  const useCase = new ChangeStatusLongInReviewIssueUseCase(
    mockDateRepository,
    mockIssueRepository,
  );

  const testCases = [
    {
      name: 'should update status and create comment for issue in review over 48 hours',
      input: {
        project: basicProject,
        issues: [
          {
            ...basicIssue,
            workingTimeline: [
              {
                ...mock<WorkingTime>(),
                author: 'testUser',
                startedAt: new Date('2024-01-01T00:00:00Z'),
                endedAt: new Date('2024-01-01T00:00:00Z'),
                durationMinutes: 60,
              },
            ],
          },
        ],
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
      },
      expectedCalls: {
        createComment: [
          [
            expect.anything(),
            '@user1 @user2\nThis issue has been in review for more than 48 hours.\nPlease check the situation of PR again :pray:',
          ],
        ],
        updateStatus: [[expect.anything(), expect.anything(), 'status1']],
      },
    },
    {
      name: 'should skip PR issues',
      input: {
        project: basicProject,
        issues: [
          {
            ...basicIssue,
            isPr: true,
          },
        ],
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
      },
      expectedCalls: {
        createComment: [],
        updateStatus: [],
      },
    },
    {
      name: 'should skip closed issues',
      input: {
        project: basicProject,
        issues: [
          {
            ...basicIssue,
            isClosed: true,
          },
        ],
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
      },
      expectedCalls: {
        createComment: [],
        updateStatus: [],
      },
    },
    {
      name: 'should skip issues not in review',
      input: {
        project: basicProject,
        issues: [
          {
            ...basicIssue,
            status: 'ToDo',
          },
        ],
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
      },
      expectedCalls: {
        createComment: [],
        updateStatus: [],
      },
    },
    {
      name: 'should skip issues in review less than 48 hours',
      input: {
        project: basicProject,
        issues: [
          {
            ...basicIssue,
            workingTimeline: [
              {
                ...mock<WorkingTime>(),
                author: 'testUser',
                startedAt: new Date('2024-01-02T22:00:00Z'),
                endedAt: new Date('2024-01-02T23:00:00Z'),
                durationMinutes: 60,
              },
            ],
          },
        ],
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
      },
      expectedCalls: {
        createComment: [],
        updateStatus: [],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockDateRepository.now.mockResolvedValue(new Date('2024-01-04T00:00:00Z'));
  });

  describe('run', () => {
    testCases.forEach(({ name, input, expectedCalls }) => {
      it(name, async () => {
        await useCase.run(input);

        expect(mockIssueRepository.createComment.mock.calls).toEqual(
          expectedCalls.createComment,
        );
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedCalls.updateStatus,
        );
      });
    });

    it('should throw error when project has no statuses', async () => {
      const mockStatusWithNoStatuses = mock<Project['status']>();
      mockStatusWithNoStatuses.name = 'Status';
      mockStatusWithNoStatuses.fieldId = 'status_field';
      mockStatusWithNoStatuses.statuses = [];

      const projectWithNoStatus = {
        ...basicProject,
        status: mockStatusWithNoStatuses,
      };

      await expect(
        useCase.run({
          project: projectWithNoStatus,
          issues: [basicIssue],
          cacheUsed: false,
          org: 'testOrg',
          repo: 'testRepo',
        }),
      ).rejects.toThrow('First status is not found');
    });
  });
});
