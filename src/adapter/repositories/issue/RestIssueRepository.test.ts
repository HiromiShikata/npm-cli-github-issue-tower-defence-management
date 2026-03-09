import { RestIssueRepository } from './RestIssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { Issue } from '../../../domain/entities/Issue';

describe('RestIssueRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  const restIssueRepository: RestIssueRepository = new RestIssueRepository(
    localStorageRepository,
    '',
    process.env.GH_TOKEN || 'dummy',
  );

  describe('createComment', () => {
    it('should create a comment', async () => {
      await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/40',
        'test comment',
      );
    });
  });
  describe('createNewIssue', () => {
    it('should create a new issue', async () => {
      await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'test issue',
        'test body',
        ['HiromiShikata'],
        ['test'],
      );
    });
  });
  describe('updateLabels', () => {
    it('should update issue labels', async () => {
      const issue: Issue = {
        nameWithOwner: 'HiromiShikata/test-repository',
        number: 40,
        title: 'Test Issue',
        state: 'OPEN',
        status: null,
        story: null,
        nextActionDate: null,
        nextActionHour: null,
        estimationMinutes: null,
        dependedIssueUrls: [],
        completionDate50PercentConfidence: null,
        url: 'https://github.com/HiromiShikata/test-repository/issues/40',
        assignees: [],
        labels: ['test'],
        org: 'HiromiShikata',
        repo: 'test-repository',
        body: 'Test body',
        itemId: '',
        isPr: false,
        isInProgress: false,
        isClosed: false,
        createdAt: new Date(),
      };

      await restIssueRepository.updateLabels(issue, ['default']);
      const issueDefault = await restIssueRepository.getIssue(issue.url);
      expect(issueDefault.labels).toContain('default');
      await restIssueRepository.updateLabels(issue, ['test', 'updated']);
      const updatedIssue = await restIssueRepository.getIssue(issue.url);
      expect(updatedIssue.labels).toContain('updated');
      expect(updatedIssue.labels).toContain('test');
      expect(updatedIssue.labels).not.toContain('default');
    });
  });
  describe('removeLabel', () => {
    it('should remove a specific label from issue', async () => {
      const issue: Issue = {
        nameWithOwner: 'HiromiShikata/test-repository',
        number: 40,
        title: 'Test Issue',
        state: 'OPEN',
        status: null,
        story: null,
        nextActionDate: null,
        nextActionHour: null,
        estimationMinutes: null,
        dependedIssueUrls: [],
        completionDate50PercentConfidence: null,
        url: 'https://github.com/HiromiShikata/test-repository/issues/40',
        assignees: [],
        labels: ['test'],
        org: 'HiromiShikata',
        repo: 'test-repository',
        body: 'Test body',
        itemId: '',
        isPr: false,
        isInProgress: false,
        isClosed: false,
        createdAt: new Date(),
      };

      await restIssueRepository.updateLabels(issue, ['test', 'to-remove']);
      const issueBefore = await restIssueRepository.getIssue(issue.url);
      expect(issueBefore.labels).toContain('to-remove');
      expect(issueBefore.labels).toContain('test');

      await restIssueRepository.removeLabel(issue, 'to-remove');
      const issueAfter = await restIssueRepository.getIssue(issue.url);
      expect(issueAfter.labels).not.toContain('to-remove');
      expect(issueAfter.labels).toContain('test');
    });
  });
  describe('updateAssigneeList', () => {
    it('should update issue assignees', async () => {
      const issue: Issue = {
        nameWithOwner: 'HiromiShikata/test-repository',
        number: 40,
        title: 'Test Issue',
        state: 'OPEN',
        status: null,
        story: null,
        nextActionDate: null,
        nextActionHour: null,
        estimationMinutes: null,
        dependedIssueUrls: [],
        completionDate50PercentConfidence: null,
        url: 'https://github.com/HiromiShikata/test-repository/issues/40',
        assignees: [],
        labels: ['test'],
        org: 'HiromiShikata',
        repo: 'test-repository',
        body: 'Test body',
        itemId: '',
        isPr: false,
        isInProgress: false,
        isClosed: false,
        createdAt: new Date(),
      };
      await restIssueRepository.updateAssigneeList(issue, ['HiromiShikata']);
      const issueWithAssignee = await restIssueRepository.getIssue(issue.url);
      expect(issueWithAssignee.assignees).toContain('HiromiShikata');
      await restIssueRepository.updateAssigneeList(issue, []);
      const issueWithoutAssignee = await restIssueRepository.getIssue(
        issue.url,
      );
      expect(issueWithoutAssignee.assignees).not.toContain('HiromiShikata');
    });
  });
});
