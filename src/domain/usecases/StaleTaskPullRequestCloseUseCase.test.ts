import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { StaleTaskPullRequestCloseUseCase } from './StaleTaskPullRequestCloseUseCase';
import { Issue } from '../entities/Issue';

describe('StaleTaskPullRequestCloseUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const useCase = new StaleTaskPullRequestCloseUseCase(mockIssueRepository);

  const openTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/1',
    isPr: false,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [],
  };
  const closedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/2',
    isPr: false,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [],
  };
  const anotherClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/3',
    isPr: false,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [],
  };

  const openPrWithClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/100',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [closedTaskIssue.url],
  };
  const openPrWithOpenTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/101',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [openTaskIssue.url],
  };
  const openPrWithoutTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/102',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [],
  };
  const openPrWithUnknownTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/103',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/999'],
  };
  const openPrWithClosedAndOpenTaskIssues: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/104',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [closedTaskIssue.url, openTaskIssue.url],
  };
  const closedPrWithClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/105',
    isPr: true,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [closedTaskIssue.url],
  };
  const anotherOpenPrWithClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/106',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [anotherClosedTaskIssue.url],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should close an open pull request whose every closing issue reference is a closed task issue', async () => {
    await useCase.run({
      issues: [closedTaskIssue, openPrWithClosedTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      openPrWithClosedTaskIssue.url,
    );
  });

  it('should not close a pull request whose closing issue reference is still open', async () => {
    await useCase.run({
      issues: [openTaskIssue, openPrWithOpenTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request that has no closing issue reference', async () => {
    await useCase.run({
      issues: [closedTaskIssue, openPrWithoutTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request whose closing issue reference is not among the given issues', async () => {
    await useCase.run({
      issues: [closedTaskIssue, openPrWithUnknownTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request when only some of its closing issue references are closed', async () => {
    await useCase.run({
      issues: [
        closedTaskIssue,
        openTaskIssue,
        openPrWithClosedAndOpenTaskIssues,
      ],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request that is already closed', async () => {
    await useCase.run({
      issues: [closedTaskIssue, closedPrWithClosedTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should continue with the remaining pull requests when closing one of them fails', async () => {
    mockIssueRepository.closePullRequest.mockRejectedValueOnce(
      new Error('close failed'),
    );

    await useCase.run({
      issues: [
        closedTaskIssue,
        anotherClosedTaskIssue,
        openPrWithClosedTaskIssue,
        anotherOpenPrWithClosedTaskIssue,
      ],
    });

    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      anotherOpenPrWithClosedTaskIssue.url,
    );
  });
});
