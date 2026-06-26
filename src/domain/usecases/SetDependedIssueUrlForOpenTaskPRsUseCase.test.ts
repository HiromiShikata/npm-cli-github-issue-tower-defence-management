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

  const openPrClosingIssue1: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/100',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call setDependedIssueUrl for each open PR whose closing keyword targets an open task issue', async () => {
    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue, openPrClosingIssue1],
    });

    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/owner/repo/pull/100',
      projectWithField,
      openTaskIssue.url,
    );
  });

  it('should never call the per-issue timeline lookup', async () => {
    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue, openPrClosingIssue1],
    });

    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
  });

  it('should skip closed task issues so that PRs linked only to a closed task are not touched', async () => {
    const openPrClosingClosedIssue: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/101',
      isPr: true,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/2'],
    };

    await useCase.run({
      project: projectWithField,
      issues: [closedTaskIssue, openPrClosingClosedIssue],
    });

    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('should ignore closed PRs even when they declare a closing keyword for an open task issue', async () => {
    const closedPrClosingIssue1: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/102',
      isPr: true,
      isClosed: true,
      state: 'CLOSED',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
    };

    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue, closedPrClosingIssue1],
    });

    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('should ignore bare mentions because they are absent from the closing-keyword set', async () => {
    const openPrMentioningButNotClosing: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/103',
      isPr: true,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: [],
    };

    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue, openPrMentioningButNotClosing],
    });

    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('should map a cross-repo closing target by full issue URL', async () => {
    const crossRepoOpenTaskIssue: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/other-repo/issues/9',
      isPr: false,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: [],
    };
    const openPrClosingCrossRepoIssue: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/104',
      isPr: true,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: [
        'https://github.com/owner/other-repo/issues/9',
      ],
    };

    await useCase.run({
      project: projectWithField,
      issues: [crossRepoOpenTaskIssue, openPrClosingCrossRepoIssue],
    });

    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/owner/repo/pull/104',
      projectWithField,
      crossRepoOpenTaskIssue.url,
    );
  });

  it('should not call setDependedIssueUrl when no open PR closes an open task issue', async () => {
    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue],
    });

    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('should do nothing when the project does not have the depended-issue-url field configured', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await useCase.run({
      project: projectWithoutField,
      issues: [openTaskIssue, openPrClosingIssue1],
    });

    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should set dependencies for multiple open task issues from their respective open PRs', async () => {
    const secondOpenTaskIssue: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/issues/3',
      isPr: false,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: [],
    };
    const openPrClosingIssue3: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/200',
      isPr: true,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/3'],
    };

    await useCase.run({
      project: projectWithField,
      issues: [
        openTaskIssue,
        closedTaskIssue,
        openPrClosingIssue1,
        secondOpenTaskIssue,
        openPrClosingIssue3,
      ],
    });

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

  it('should set dependencies for every open PR that closes the same open task issue', async () => {
    const secondOpenPrClosingIssue1: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/105',
      isPr: true,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
    };

    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue, openPrClosingIssue1, secondOpenPrClosingIssue1],
    });

    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/owner/repo/pull/100',
      projectWithField,
      openTaskIssue.url,
    );
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/owner/repo/pull/105',
      projectWithField,
      openTaskIssue.url,
    );
  });

  it('should isolate a single PR failure, log it, and still process the remaining PRs without aborting the cycle', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failingPrUrl = 'https://github.com/owner/repo/pull/100';
    const succeedingPrUrl = 'https://github.com/owner/repo/pull/200';
    const failingPr: Issue = {
      ...mock<Issue>(),
      url: failingPrUrl,
      isPr: true,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
    };
    const succeedingPr: Issue = {
      ...mock<Issue>(),
      url: succeedingPrUrl,
      isPr: true,
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
    };

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
        issues: [openTaskIssue, failingPr, succeedingPr],
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
