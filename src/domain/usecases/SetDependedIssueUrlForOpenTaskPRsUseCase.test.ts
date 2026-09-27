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
    plainCrossRepoIssueReferenceUrls: [],
  };
  const closedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/2',
    isPr: false,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [],
    plainCrossRepoIssueReferenceUrls: [],
  };

  const openPrClosingIssue1: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/100',
    isPr: true,
    dependedIssueUrls: [],
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
    plainCrossRepoIssueReferenceUrls: [],
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

  it('does not touch a pull request whose depended issue url is already set, so no project item is read for it', async () => {
    const openPrWithDependedIssueUrlAlreadySet: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/101',
      isPr: true,
      dependedIssueUrls: ['https://github.com/owner/repo/issues/1'],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
      plainCrossRepoIssueReferenceUrls: [],
    };

    await useCase.run({
      project: projectWithField,
      issues: [openTaskIssue, openPrWithDependedIssueUrlAlreadySet],
    });

    expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('still sets the depended issue url on a pull request that has none, when another pull request already has one', async () => {
    const openPrWithDependedIssueUrlAlreadySet: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/101',
      isPr: true,
      dependedIssueUrls: ['https://github.com/owner/repo/issues/1'],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
      plainCrossRepoIssueReferenceUrls: [],
    };

    await useCase.run({
      project: projectWithField,
      issues: [
        openTaskIssue,
        openPrWithDependedIssueUrlAlreadySet,
        openPrClosingIssue1,
      ],
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
      dependedIssueUrls: [],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/2'],
      plainCrossRepoIssueReferenceUrls: [],
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
      dependedIssueUrls: [],
      isClosed: true,
      state: 'CLOSED',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
      plainCrossRepoIssueReferenceUrls: [],
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
      dependedIssueUrls: [],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: [],
      plainCrossRepoIssueReferenceUrls: [],
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
      plainCrossRepoIssueReferenceUrls: [],
    };
    const openPrClosingCrossRepoIssue: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/104',
      isPr: true,
      dependedIssueUrls: [],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: [
        'https://github.com/owner/other-repo/issues/9',
      ],
      plainCrossRepoIssueReferenceUrls: [],
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
      plainCrossRepoIssueReferenceUrls: [],
    };
    const openPrClosingIssue3: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/owner/repo/pull/200',
      isPr: true,
      dependedIssueUrls: [],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/3'],
      plainCrossRepoIssueReferenceUrls: [],
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
      dependedIssueUrls: [],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
      plainCrossRepoIssueReferenceUrls: [],
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
      dependedIssueUrls: [],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
      plainCrossRepoIssueReferenceUrls: [],
    };
    const succeedingPr: Issue = {
      ...mock<Issue>(),
      url: succeedingPrUrl,
      isPr: true,
      dependedIssueUrls: [],
      isClosed: false,
      state: 'OPEN',
      closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/1'],
      plainCrossRepoIssueReferenceUrls: [],
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

  describe('cross-repo plain URL references (plainCrossRepoIssueReferenceUrls)', () => {
    const testCases: {
      name: string;
      issues: Issue[];
      expectedCalls: { prUrl: string; issueUrl: string }[];
    }[] = [
      {
        name: 'sets the dependency when a cross-repo plain URL targets an open issue',
        issues: [
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/issues/10',
            isPr: false,
            isClosed: false,
            state: 'OPEN',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/pull/300',
            isPr: true,
            isClosed: false,
            state: 'OPEN',
            dependedIssueUrls: [],
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [
              'https://github.com/other/repo/issues/10',
            ],
          },
        ],
        expectedCalls: [
          {
            prUrl: 'https://github.com/owner/repo/pull/300',
            issueUrl: 'https://github.com/other/repo/issues/10',
          },
        ],
      },
      {
        name: 'does not set the dependency when the cross-repo plain URL targets a closed issue',
        issues: [
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/issues/11',
            isPr: false,
            isClosed: true,
            state: 'CLOSED',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/pull/301',
            isPr: true,
            isClosed: false,
            state: 'OPEN',
            dependedIssueUrls: [],
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [
              'https://github.com/other/repo/issues/11',
            ],
          },
        ],
        expectedCalls: [],
      },
      {
        name: 'does not set the dependency when the cross-repo plain URL targets another pull request',
        issues: [
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/pull/12',
            isPr: true,
            isClosed: false,
            state: 'OPEN',
            dependedIssueUrls: [],
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/pull/302',
            isPr: true,
            isClosed: false,
            state: 'OPEN',
            dependedIssueUrls: [],
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [
              'https://github.com/other/repo/pull/12',
            ],
          },
        ],
        expectedCalls: [],
      },
      {
        name: 'does not set the dependency when the referencing pull request already has a depended issue url',
        issues: [
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/issues/13',
            isPr: false,
            isClosed: false,
            state: 'OPEN',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/pull/303',
            isPr: true,
            isClosed: false,
            state: 'OPEN',
            dependedIssueUrls: ['https://github.com/other/repo/issues/13'],
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [
              'https://github.com/other/repo/issues/13',
            ],
          },
        ],
        expectedCalls: [],
      },
      {
        name: 'sets the dependency for each of two cross-repo plain URLs on the same pull request',
        issues: [
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/issues/14',
            isPr: false,
            isClosed: false,
            state: 'OPEN',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/issues/15',
            isPr: false,
            isClosed: false,
            state: 'OPEN',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/pull/304',
            isPr: true,
            isClosed: false,
            state: 'OPEN',
            dependedIssueUrls: [],
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [
              'https://github.com/other/repo/issues/14',
              'https://github.com/other/repo/issues/15',
            ],
          },
        ],
        expectedCalls: [
          {
            prUrl: 'https://github.com/owner/repo/pull/304',
            issueUrl: 'https://github.com/other/repo/issues/14',
          },
          {
            prUrl: 'https://github.com/owner/repo/pull/304',
            issueUrl: 'https://github.com/other/repo/issues/15',
          },
        ],
      },
      {
        name: 'sets the dependency for both a same-repository closing keyword target and a cross-repo plain URL target on the same pull request',
        issues: [
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/issues/16',
            isPr: false,
            isClosed: false,
            state: 'OPEN',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/issues/17',
            isPr: false,
            isClosed: false,
            state: 'OPEN',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/pull/305',
            isPr: true,
            isClosed: false,
            state: 'OPEN',
            dependedIssueUrls: [],
            closingIssueReferenceUrls: [
              'https://github.com/owner/repo/issues/16',
            ],
            plainCrossRepoIssueReferenceUrls: [
              'https://github.com/other/repo/issues/17',
            ],
          },
        ],
        expectedCalls: [
          {
            prUrl: 'https://github.com/owner/repo/pull/305',
            issueUrl: 'https://github.com/owner/repo/issues/16',
          },
          {
            prUrl: 'https://github.com/owner/repo/pull/305',
            issueUrl: 'https://github.com/other/repo/issues/17',
          },
        ],
      },
      {
        name: 'does not set any dependency when the referencing pull request itself is closed',
        issues: [
          {
            ...mock<Issue>(),
            url: 'https://github.com/other/repo/issues/18',
            isPr: false,
            isClosed: false,
            state: 'OPEN',
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [],
          },
          {
            ...mock<Issue>(),
            url: 'https://github.com/owner/repo/pull/306',
            isPr: true,
            isClosed: true,
            state: 'CLOSED',
            dependedIssueUrls: [],
            closingIssueReferenceUrls: [],
            plainCrossRepoIssueReferenceUrls: [
              'https://github.com/other/repo/issues/18',
            ],
          },
        ],
        expectedCalls: [],
      },
    ];

    test.each(testCases)('$name', async ({ issues, expectedCalls }) => {
      await useCase.run({
        project: projectWithField,
        issues,
      });

      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(
        expectedCalls.length,
      );
      for (const { prUrl, issueUrl } of expectedCalls) {
        expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
          prUrl,
          projectWithField,
          issueUrl,
        );
      }
    });
  });
});
