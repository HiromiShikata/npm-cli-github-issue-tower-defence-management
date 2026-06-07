import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { SetDependedIssueUrlForOpenTaskPRsUseCase } from './SetDependedIssueUrlForOpenTaskPRsUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';

describe('SetDependedIssueUrlForOpenTaskPRsUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const useCase = new SetDependedIssueUrlForOpenTaskPRsUseCase(
    mockIssueRepository,
  );

  const projectWithField: Project = {
    ...mock<Project>(),
    dependedIssueUrlSeparatedByComma: {
      name: 'Depended Issue URL separated by comma',
      fieldId: 'depended-field-id',
    },
  };
  const projectWithoutField: Project = {
    ...mock<Project>(),
    dependedIssueUrlSeparatedByComma: null,
  };

  const openTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/1',
    isPr: false,
    isClosed: false,
    state: 'OPEN',
  };
  const closedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/2',
    isPr: false,
    isClosed: true,
    state: 'CLOSED',
  };
  const prItem: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/10',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call setDependedIssueUrl for each related open PR linked to an open task issue', async () => {
    mockIssueRepository.findRelatedOpenPRs.mockImplementation(
      async (issueUrl) => {
        if (issueUrl === openTaskIssue.url) {
          return [
            {
              url: 'https://github.com/owner/repo/pull/100',
              branchName: null,
              createdAt: new Date(0),
              isDraft: false,
              isConflicted: false,
              isPassedAllCiJob: true,
              isCiStateSuccess: true,
              isResolvedAllReviewComments: true,
              isBranchOutOfDate: false,
              missingRequiredCheckNames: [],
            },
          ];
        }
        return [];
      },
    );

    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue],
    });

    expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
      openTaskIssue.url,
    );
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/owner/repo/pull/100',
      projectWithField,
      openTaskIssue.url,
    );
  });

  it('should skip closed task issues so that PRs linked only to a closed task are not touched', async () => {
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      project: projectWithField,
      issues: [closedTaskIssue],
    });

    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('should skip PR project items themselves and only iterate task issues', async () => {
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      project: projectWithField,
      issues: [prItem],
    });

    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('should not call setDependedIssueUrl when no related open PRs are found for an open task issue', async () => {
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue],
    });

    expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
      openTaskIssue.url,
    );
    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('should do nothing when the project does not have the depended-issue-url field configured', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await useCase.run({
      project: projectWithoutField,
      issues: [openTaskIssue],
    });

    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should iterate over each open task issue and request its related open PRs independently', async () => {
    const secondOpenTaskIssue: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/issues/3',
      isPr: false,
      isClosed: false,
      state: 'OPEN',
    };

    mockIssueRepository.findRelatedOpenPRs.mockImplementation(
      async (issueUrl) => {
        if (issueUrl === openTaskIssue.url) {
          return [
            {
              url: 'https://github.com/owner/repo/pull/100',
              branchName: null,
              createdAt: new Date(0),
              isDraft: false,
              isConflicted: false,
              isPassedAllCiJob: true,
              isCiStateSuccess: true,
              isResolvedAllReviewComments: true,
              isBranchOutOfDate: false,
              missingRequiredCheckNames: [],
            },
          ];
        }
        if (issueUrl === secondOpenTaskIssue.url) {
          return [
            {
              url: 'https://github.com/owner/repo/pull/200',
              branchName: null,
              createdAt: new Date(0),
              isDraft: false,
              isConflicted: false,
              isPassedAllCiJob: true,
              isCiStateSuccess: true,
              isResolvedAllReviewComments: true,
              isBranchOutOfDate: false,
              missingRequiredCheckNames: [],
            },
          ];
        }
        return [];
      },
    );

    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue, closedTaskIssue, prItem, secondOpenTaskIssue],
    });

    expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
      openTaskIssue.url,
    );
    expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
      secondOpenTaskIssue.url,
    );
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/owner/repo/pull/100',
      projectWithField,
      openTaskIssue.url,
    );
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/owner/repo/pull/200',
      projectWithField,
      secondOpenTaskIssue.url,
    );
  });

  it('should isolate a single PR failure, log it, and still process the remaining PRs without aborting the cycle', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failingPrUrl = 'https://github.com/owner/repo/pull/100';
    const succeedingPrUrl = 'https://github.com/owner/repo/pull/200';

    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: failingPrUrl,
        branchName: null,
        createdAt: new Date(0),
        isDraft: false,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
      {
        url: succeedingPrUrl,
        branchName: null,
        createdAt: new Date(0),
        isDraft: false,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);
    mockIssueRepository.setDependedIssueUrl.mockImplementation(
      async (prUrl) => {
        if (prUrl === failingPrUrl) {
          throw new Error('boom');
        }
      },
    );

    await expect(
      useCase.run({
        project: projectWithField,
        issues: [openTaskIssue],
      }),
    ).resolves.toBeUndefined();

    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      succeedingPrUrl,
      projectWithField,
      openTaskIssue.url,
    );
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
