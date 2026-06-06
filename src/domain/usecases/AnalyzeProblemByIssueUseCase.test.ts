import { mock } from 'jest-mock-extended';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { Issue } from '../entities/Issue';
import { StoryObject } from '../entities/StoryObjectMap';
import { StoryOption } from '../entities/Project';

describe('AnalyzeProblemByIssueUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const mockDateRepository = mock<DateRepository>();
  const useCase = new AnalyzeProblemByIssueUseCase(
    mockIssueRepository,
    mockDateRepository,
  );

  describe('createSummaryCommentBody', () => {
    const createIssueWithTitle = (title: string): Issue => {
      const issue = mock<Issue>();
      issue.url = 'https://github.com/org/repo/issues/1';
      issue.number = 1;
      issue.title = title;
      issue.isClosed = false;
      issue.assignees = [];
      issue.dependedIssueUrls = [];
      issue.estimationMinutes = null;
      issue.completionDate50PercentConfidence = null;
      return issue;
    };

    const createStoryIssue = (): Issue => {
      const issue = mock<Issue>();
      issue.url = 'https://github.com/org/repo/issues/100';
      issue.number = 100;
      issue.title = 'Story';
      return issue;
    };

    it('should replace all double-quote characters in the issue title with single quotes', () => {
      const titleWithMultipleQuotes = 'a"b"c"d';
      const storyObject: StoryObject & { storyIssue: Issue } = {
        story: mock<StoryOption>(),
        storyIssue: createStoryIssue(),
        issues: [createIssueWithTitle(titleWithMultipleQuotes)],
      };

      const result = useCase.createSummaryCommentBody(storyObject);

      expect(result).toContain("a'b'c'd");
      expect(result).not.toContain('a"b');
    });

    it('should leave titles without double-quote characters unchanged', () => {
      const plainTitle = 'plain title';
      const storyObject: StoryObject & { storyIssue: Issue } = {
        story: mock<StoryOption>(),
        storyIssue: createStoryIssue(),
        issues: [createIssueWithTitle(plainTitle)],
      };

      const result = useCase.createSummaryCommentBody(storyObject);

      expect(result).toContain(plainTitle);
    });
  });
});
