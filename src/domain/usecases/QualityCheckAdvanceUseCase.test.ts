import { mock } from 'jest-mock-extended';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { QualityCheckAdvanceUseCase } from './QualityCheckAdvanceUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

describe('QualityCheckAdvanceUseCase', () => {
  test.each([
    { name: 'an open issue and merged pull request', issues: [mock<Issue>(), mock<Issue>()] },
    { name: 'an issue with no pull request', issues: [mock<Issue>()] },
  ])('does not advance $name', async ({ issues }) => {
    const issueRepository = {
      updateStatus: jest.fn(),
      get: jest.fn(),
      removeIssueFromProjectCache: jest.fn(),
    } satisfies Pick<
      IssueRepository,
      'updateStatus' | 'get' | 'removeIssueFromProjectCache'
    >;
    const useCase = new QualityCheckAdvanceUseCase(issueRepository);

    const result = await useCase.run({
      project: mock<Project>(),
      issues,
    });

    expect(result).toBe(0);
    expect(issueRepository.updateStatus).not.toHaveBeenCalled();
  });
});
