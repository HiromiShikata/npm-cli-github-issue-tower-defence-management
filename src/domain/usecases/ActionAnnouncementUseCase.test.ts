import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

describe('ActionAnnouncementUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const useCase = new ActionAnnouncementUseCase(mockIssueRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockProject = mock<Project>();

  const announcementIssue: Issue = {
    ...mock<Issue>(),
    org: 'test-org',
    repo: 'test-repo',
    number: 10,
    title: 'Q2 Policy Update',
    labels: ['action:announcement'],
    state: 'OPEN',
    nextActionDate: null,
    url: 'https://github.com/test-org/test-repo/issues/10',
  };

  describe('run', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not include From: :robot: prefix in the announcement issue body', async () => {
      mockIssueRepository.createNewIssue.mockResolvedValue(11);

      const runPromise = useCase.run({
        targetDates: [new Date('2024-01-02T10:00:00Z')],
        project: mockProject,
        issues: [announcementIssue],
        cacheUsed: false,
        members: ['dev-alice'],
        manager: 'manager-bob',
      });
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledTimes(1);
      const body = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(body).not.toContain('From: :robot:');
      expect(body).toContain('Hi @dev-alice');
      expect(body).toContain(
        'https://github.com/test-org/test-repo/issues/10',
      );
    });

    it('does not include From: :robot: prefix in the error recovery issue body', async () => {
      mockIssueRepository.createNewIssue
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(12);

      const runPromise = useCase.run({
        targetDates: [new Date('2024-01-02T10:00:00Z')],
        project: mockProject,
        issues: [announcementIssue],
        cacheUsed: false,
        members: ['dev-alice'],
        manager: 'manager-bob',
      });
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledTimes(2);
      const errorBody = mockIssueRepository.createNewIssue.mock.calls[1][3];
      expect(errorBody).not.toContain('From: :robot:');
      expect(errorBody).toBe('{}');
    });

    it('returns early when cacheUsed is true', async () => {
      await useCase.run({
        targetDates: [new Date('2024-01-02T10:00:00Z')],
        project: mockProject,
        issues: [announcementIssue],
        cacheUsed: true,
        members: ['dev-alice'],
        manager: 'manager-bob',
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
  });
});
