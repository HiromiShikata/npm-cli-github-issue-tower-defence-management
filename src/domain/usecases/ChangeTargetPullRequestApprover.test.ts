import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';

describe('ChangeTargetPullRequestApprover', () => {
  let mockIssueRepository: {
    getPullRequestChangedFilePaths: jest.Mock;
    approvePullRequest: jest.Mock;
  };
  let approver: ChangeTargetPullRequestApprover;
  const prUrl = 'https://github.com/user/repo/pull/1';

  beforeEach(() => {
    jest.resetAllMocks();
    mockIssueRepository = {
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      approvePullRequest: jest.fn().mockResolvedValue(undefined),
    };
    approver = new ChangeTargetPullRequestApprover(mockIssueRepository);
  });

  it('should do nothing when approvedPrUrl is null', async () => {
    await approver.approveIfConfined(['change-target:src/domain'], null);

    expect(
      mockIssueRepository.getPullRequestChangedFilePaths,
    ).not.toHaveBeenCalled();
    expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
  });

  it('should do nothing when issue has no change-target label', async () => {
    await approver.approveIfConfined(['category:e2e'], prUrl);

    expect(
      mockIssueRepository.getPullRequestChangedFilePaths,
    ).not.toHaveBeenCalled();
    expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
  });

  it('should approve when all files are confined to the labeled path', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
      'src/domain/entities/Foo.ts',
      'src/domain/usecases/Bar.ts',
    ]);

    await approver.approveIfConfined(['change-target:src/domain'], prUrl);

    expect(
      mockIssueRepository.getPullRequestChangedFilePaths,
    ).toHaveBeenCalledWith(prUrl);
    expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(prUrl);
  });

  it('should not approve when any file is outside the labeled path', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
      'src/domain/entities/Foo.ts',
      'src/adapter/Outside.ts',
    ]);

    await approver.approveIfConfined(['change-target:src/domain'], prUrl);

    expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
  });

  it('should approve when files are confined under any of multiple labels', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
      'src/domain/Foo.ts',
      'docs/intro.md',
    ]);

    await approver.approveIfConfined(
      ['change-target:src/domain', 'change-target:docs'],
      prUrl,
    );

    expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(prUrl);
  });

  it('should match boundary-safely (foo matches foo/bar.ts but not foobar/baz.ts)', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
      'foo/bar.ts',
      'foobar/baz.ts',
    ]);

    await approver.approveIfConfined(['change-target:foo'], prUrl);

    expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
  });

  it('should approve when changed file equals the labeled path exactly', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
      'README.md',
    ]);

    await approver.approveIfConfined(['change-target:README.md'], prUrl);

    expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(prUrl);
  });

  it('should not approve when there are zero changed files', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([]);

    await approver.approveIfConfined(['change-target:src/domain'], prUrl);

    expect(
      mockIssueRepository.getPullRequestChangedFilePaths,
    ).toHaveBeenCalledWith(prUrl);
    expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
  });

  it('should normalize trailing slashes in change-target label paths', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
      'src/domain/entities/Foo.ts',
    ]);

    await approver.approveIfConfined(['change-target:src/domain/'], prUrl);

    expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(prUrl);
  });

  it('should ignore empty change-target label values', async () => {
    mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
      'src/domain/Foo.ts',
    ]);

    await approver.approveIfConfined(['change-target:'], prUrl);

    expect(
      mockIssueRepository.getPullRequestChangedFilePaths,
    ).not.toHaveBeenCalled();
    expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
  });
});
