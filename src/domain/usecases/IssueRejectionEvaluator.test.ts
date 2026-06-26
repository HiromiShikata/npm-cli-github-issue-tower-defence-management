import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { RelatedPullRequest } from './adapter-interfaces/IssueRepository';

const createReadyPr = (
  url = 'https://github.com/user/repo/pull/1',
  overrides: Partial<RelatedPullRequest> = {},
): RelatedPullRequest => ({
  url,
  branchName: 'feature-branch',
  createdAt: new Date('2000-01-01T00:00:00Z'),
  isDraft: false,
  isConflicted: false,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  ...overrides,
});

describe('IssueRejectionEvaluator', () => {
  let mockIssueRepository: {
    findRelatedOpenPRs: jest.Mock;
    getOpenPullRequest: jest.Mock;
    getPullRequestChangedFilePaths: jest.Mock;
    requestChangesWithInlineComment: jest.Mock;
  };
  let evaluator: IssueRejectionEvaluator;

  beforeEach(() => {
    jest.resetAllMocks();

    mockIssueRepository = {
      findRelatedOpenPRs: jest.fn(),
      getOpenPullRequest: jest.fn(),
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
    };

    evaluator = new IssueRejectionEvaluator(mockIssueRepository);
  });

  describe('evaluate', () => {
    it('should return no rejections when PR is ready and not draft', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(result.rejections).toHaveLength(0);
      expect(result.approvedPrUrl).toBe('https://github.com/user/repo/pull/1');
    });

    it('should reject with PULL_REQUEST_IS_DRAFT when PR is in draft state', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr('https://github.com/user/repo/pull/1', { isDraft: true }),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_IS_DRAFT');
      expect(result.rejections[0].detail).toContain('PULL_REQUEST_IS_DRAFT');
      expect(result.rejections[0].detail).toContain(
        'https://github.com/user/repo/pull/1',
      );
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not approve a draft PR even when all other checks pass', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr('https://github.com/user/repo/pull/1', { isDraft: true }),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(result.approvedPrUrl).toBeNull();
    });

    it('should accumulate PULL_REQUEST_IS_DRAFT alongside PULL_REQUEST_CONFLICTED when draft PR is also conflicted', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr('https://github.com/user/repo/pull/1', {
          isDraft: true,
          isConflicted: true,
        }),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      const rejectionTypes = result.rejections.map((r) => r.type);
      expect(rejectionTypes).toContain('PULL_REQUEST_IS_DRAFT');
      expect(rejectionTypes).toContain('PULL_REQUEST_CONFLICTED');
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should reject with PULL_REQUEST_IS_DRAFT when PR item (isPr=true) is in draft state', async () => {
      mockIssueRepository.getOpenPullRequest.mockResolvedValue(
        createReadyPr('https://github.com/user/repo/pull/10', {
          isDraft: true,
        }),
      );

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/pull/10',
        labels: [],
        isPr: true,
      });

      expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/10',
      );
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_IS_DRAFT');
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not reject for draft state when issue has llm-agent label', async () => {
      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: ['llm-agent'],
        isPr: false,
      });

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(result.rejections).toHaveLength(0);
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not reject for draft state when issue has non-e2e category label', async () => {
      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: ['category:frontend'],
        isPr: false,
      });

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(result.rejections).toHaveLength(0);
    });

    it('should reject with PULL_REQUEST_NOT_FOUND when a normal issue has no related PR', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
      );
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_NOT_FOUND');
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not reject with PULL_REQUEST_NOT_FOUND when issue has a label listed in labelsAsLlmAgentName', async () => {
      const result = await evaluator.evaluate(
        {
          url: 'https://github.com/user/repo/issues/1',
          labels: ['story'],
          isPr: false,
        },
        ['story'],
      );

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(result.rejections).toHaveLength(0);
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should still reject with PULL_REQUEST_NOT_FOUND when issue label is not in labelsAsLlmAgentName', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      const result = await evaluator.evaluate(
        {
          url: 'https://github.com/user/repo/issues/1',
          labels: ['story'],
          isPr: false,
        },
        ['bug'],
      );

      expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
      );
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_NOT_FOUND');
    });

    describe('prebuilt relatedOpenPrUrls (in-memory derivation path)', () => {
      it('should resolve PR status via getOpenPullRequest and not call findRelatedOpenPRs when relatedOpenPrUrls is provided', async () => {
        mockIssueRepository.getOpenPullRequest.mockResolvedValue(
          createReadyPr('https://github.com/user/repo/pull/7'),
        );

        const result = await evaluator.evaluate(
          {
            url: 'https://github.com/user/repo/issues/1',
            labels: [],
            isPr: false,
          },
          [],
          { relatedOpenPrUrls: ['https://github.com/user/repo/pull/7'] },
        );

        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/7',
        );
        expect(result.rejections).toHaveLength(0);
        expect(result.approvedPrUrl).toBe(
          'https://github.com/user/repo/pull/7',
        );
      });

      it('should reject with PULL_REQUEST_NOT_FOUND when relatedOpenPrUrls is empty', async () => {
        const result = await evaluator.evaluate(
          {
            url: 'https://github.com/user/repo/issues/1',
            labels: [],
            isPr: false,
          },
          [],
          { relatedOpenPrUrls: [] },
        );

        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
        expect(result.rejections).toHaveLength(1);
        expect(result.rejections[0].type).toBe('PULL_REQUEST_NOT_FOUND');
        expect(result.approvedPrUrl).toBeNull();
      });

      it('should drop a related URL whose PR is no longer open (getOpenPullRequest returns null), yielding PULL_REQUEST_NOT_FOUND', async () => {
        mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);

        const result = await evaluator.evaluate(
          {
            url: 'https://github.com/user/repo/issues/1',
            labels: [],
            isPr: false,
          },
          [],
          { relatedOpenPrUrls: ['https://github.com/user/repo/pull/9'] },
        );

        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/9',
        );
        expect(result.rejections).toHaveLength(1);
        expect(result.rejections[0].type).toBe('PULL_REQUEST_NOT_FOUND');
      });

      it('should reject with MULTIPLE_PULL_REQUESTS_FOUND when more than one related open PR resolves', async () => {
        mockIssueRepository.getOpenPullRequest.mockImplementation(
          (prUrl: string) => Promise.resolve(createReadyPr(prUrl)),
        );

        const result = await evaluator.evaluate(
          {
            url: 'https://github.com/user/repo/issues/1',
            labels: [],
            isPr: false,
          },
          [],
          {
            relatedOpenPrUrls: [
              'https://github.com/user/repo/pull/1',
              'https://github.com/user/repo/pull/2',
            ],
          },
        );

        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        expect(result.rejections).toHaveLength(1);
        expect(result.rejections[0].type).toBe('MULTIPLE_PULL_REQUESTS_FOUND');
      });

      it('should de-duplicate repeated related URLs before resolving, mirroring findRelatedOpenPRs', async () => {
        mockIssueRepository.getOpenPullRequest.mockResolvedValue(
          createReadyPr('https://github.com/user/repo/pull/5'),
        );

        const result = await evaluator.evaluate(
          {
            url: 'https://github.com/user/repo/issues/1',
            labels: [],
            isPr: false,
          },
          [],
          {
            relatedOpenPrUrls: [
              'https://github.com/user/repo/pull/5',
              'https://github.com/user/repo/pull/5',
            ],
          },
        );

        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledTimes(1);
        expect(result.rejections).toHaveLength(0);
        expect(result.approvedPrUrl).toBe(
          'https://github.com/user/repo/pull/5',
        );
      });

      it('should produce the same draft rejection through the prebuilt path as through findRelatedOpenPRs', async () => {
        mockIssueRepository.getOpenPullRequest.mockResolvedValue(
          createReadyPr('https://github.com/user/repo/pull/3', {
            isDraft: true,
          }),
        );

        const result = await evaluator.evaluate(
          {
            url: 'https://github.com/user/repo/issues/1',
            labels: [],
            isPr: false,
          },
          [],
          { relatedOpenPrUrls: ['https://github.com/user/repo/pull/3'] },
        );

        expect(result.rejections).toHaveLength(1);
        expect(result.rejections[0].type).toBe('PULL_REQUEST_IS_DRAFT');
        expect(result.approvedPrUrl).toBeNull();
      });

      it('should still use findRelatedOpenPRs when relatedOpenPrUrls is undefined (single-issue path unchanged)', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(),
        ]);

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: [],
          isPr: false,
        });

        expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
          'https://github.com/user/repo/issues/1',
        );
        expect(result.rejections).toHaveLength(0);
      });

      it('should ignore relatedOpenPrUrls for a PR item (isPr=true) and use getOpenPullRequest on the PR URL itself', async () => {
        mockIssueRepository.getOpenPullRequest.mockResolvedValue(
          createReadyPr('https://github.com/user/repo/pull/10'),
        );

        const result = await evaluator.evaluate(
          {
            url: 'https://github.com/user/repo/pull/10',
            labels: [],
            isPr: true,
          },
          [],
          { relatedOpenPrUrls: ['https://github.com/user/repo/pull/999'] },
        );

        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/10',
        );
        expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/999',
        );
        expect(result.rejections).toHaveLength(0);
      });
    });

    describe('change-target-must: label behavior', () => {
      const prUrl = 'https://github.com/user/repo/pull/1';

      it('should not reject when required path contains at least one changed file', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrl),
        ]);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'src/domain/entities/Foo.ts',
          'src/adapter/Bar.ts',
        ]);

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: ['change-target-must:src/domain'],
          isPr: false,
        });

        expect(result.rejections).toHaveLength(0);
        expect(result.approvedPrUrl).toBe(prUrl);
        expect(
          mockIssueRepository.requestChangesWithInlineComment,
        ).not.toHaveBeenCalled();
      });

      it('should reject with CHANGE_TARGET_MUST_PATH_NOT_CHANGED and post inline comment when required path has no changed file', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrl),
        ]);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'src/adapter/Bar.ts',
        ]);

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: ['change-target-must:src/domain'],
          isPr: false,
        });

        expect(result.rejections).toHaveLength(1);
        expect(result.rejections[0].type).toBe(
          'CHANGE_TARGET_MUST_PATH_NOT_CHANGED',
        );
        expect(result.rejections[0].detail).toContain('src/domain');
        expect(result.approvedPrUrl).toBeNull();
        expect(
          mockIssueRepository.requestChangesWithInlineComment,
        ).toHaveBeenCalledWith(
          prUrl,
          'src/adapter/Bar.ts',
          expect.stringContaining('src/domain'),
        );
      });

      it('should post PR-level comment as fallback when PR has no changed files', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrl),
        ]);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue(
          [],
        );

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: ['change-target-must:src/domain'],
          isPr: false,
        });

        expect(result.rejections).toHaveLength(1);
        expect(result.rejections[0].type).toBe(
          'CHANGE_TARGET_MUST_PATH_NOT_CHANGED',
        );
        expect(
          mockIssueRepository.requestChangesWithInlineComment,
        ).toHaveBeenCalledWith(prUrl, null, expect.any(String));
      });

      it('should match boundary-safely so that change-target-must:foo matches foo/bar.ts but not foobar/baz.ts', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrl),
        ]);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'foobar/baz.ts',
        ]);

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: ['change-target-must:foo'],
          isPr: false,
        });

        expect(result.rejections).toHaveLength(1);
        expect(result.rejections[0].type).toBe(
          'CHANGE_TARGET_MUST_PATH_NOT_CHANGED',
        );
        expect(
          mockIssueRepository.requestChangesWithInlineComment,
        ).toHaveBeenCalledWith(prUrl, 'foobar/baz.ts', expect.any(String));
      });

      it('should not reject when changed file is exactly the required path (boundary-safe exact match)', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrl),
        ]);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'foo',
        ]);

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: ['change-target-must:foo'],
          isPr: false,
        });

        expect(result.rejections).toHaveLength(0);
        expect(result.approvedPrUrl).toBe(prUrl);
      });

      it('should not reject when changed file is under the change-target-must path', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrl),
        ]);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'src/domain/entities/Foo.ts',
        ]);

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: ['change-target-must:src/domain'],
          isPr: false,
        });

        expect(result.rejections).toHaveLength(0);
        expect(result.approvedPrUrl).toBe(prUrl);
      });

      it('should normalize leading slash in change-target-must label path', async () => {
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrl),
        ]);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'src/domain/entities/Foo.ts',
        ]);

        const result = await evaluator.evaluate({
          url: 'https://github.com/user/repo/issues/1',
          labels: ['change-target-must:/src/domain'],
          isPr: false,
        });

        expect(result.rejections).toHaveLength(0);
        expect(result.approvedPrUrl).toBe(prUrl);
      });
    });
  });
});
