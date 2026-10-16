import { mock } from 'jest-mock-extended';
import {
  IssueComment,
  IssueRepository,
} from './adapter-interfaces/IssueRepository';
import { DependedIssueURLRestoreUseCase } from './DependedIssueURLRestoreUseCase';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';
import {
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD,
  SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD,
  SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD,
} from './dependencyNotificationCommentHeads';

describe('DependedIssueURLRestoreUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();

  describe('run', () => {
    const basicProject = {
      ...mock<Project>(),
      dependedIssueUrlSeparatedByComma: {
        name: 'Depended Issue URL Separated By Comma',
        fieldId: 'fieldId',
      },
    };
    const DEPENDING_ISSUE_URL = 'https://github.com/o/r/issues/20';
    const SECOND_DEPENDING_ISSUE_URL = 'https://github.com/o/r/issues/21';
    const DEP_10_URL = 'https://github.com/o/r/issues/10';
    const DEP_11_URL = 'https://github.com/o/r/issues/11';
    const DEP_12_URL = 'https://github.com/o/r/issues/12';
    const UNRELATED_URL = 'https://github.com/o/r/issues/99';
    const T1 = new Date('2026-01-01T00:00:00Z');
    const T2 = new Date('2026-01-02T00:00:00Z');
    const T3 = new Date('2026-01-03T00:00:00Z');

    const buildDependedIssue = (
      overrides: Partial<Issue> & { url: string },
    ): Issue => ({
      ...mock<Issue>(),
      dependedIssueUrls: [],
      isClosed: false,
      status: 'In Progress',
      ...overrides,
    });

    const buildDependingIssue = (dependedIssueUrls: string[]): Issue => ({
      ...mock<Issue>(),
      url: DEPENDING_ISSUE_URL,
      dependedIssueUrls,
      isClosed: false,
    });

    const buildComment = (
      body: string,
      createdAt: Date,
      id: number,
      author: string = 'hs-bot-gh-app[bot]',
    ): IssueComment => ({
      id,
      author,
      body,
      createdAt,
    });

    const testCases: {
      name: string;
      dependedIssues: Issue[];
      dependingIssueCurrentDependedIssueUrls: string[];
      dependingIssueComments: IssueComment[];
      allowedIssueAuthors?: string[] | null;
      expectedUpdateProjectTextFieldText: string | null;
      expectedCreateCommentBody: string | null;
    }[] = [
      {
        name: 'should restore the field with the originally-cleared URL after the depended issue has left Icebox and is not closed (criterion 1: basic restore after leaving Icebox)',
        dependedIssues: [buildDependedIssue({ url: DEP_10_URL })],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
        ],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
        expectedUpdateProjectTextFieldText: DEP_10_URL,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      },
      {
        name: 'should never restore a cleared depended issue URL based on an icebox-clear comment from an untrusted author, even though the depended issue has left Icebox and is not closed (follow-up issue acceptance criterion 3: author check)',
        dependedIssues: [buildDependedIssue({ url: DEP_10_URL })],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
            'some-random-impostor-user',
          ),
        ],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should restore all originally-cleared URLs from a bundled multi-URL Icebox clear, not just one (criterion 2: restore of a bundled multi-URL clear)',
        dependedIssues: [
          buildDependedIssue({ url: DEP_10_URL }),
          buildDependedIssue({ url: DEP_11_URL }),
        ],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}\n- ${DEP_11_URL}`,
            T1,
            1,
          ),
        ],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
        expectedUpdateProjectTextFieldText: `${DEP_10_URL},${DEP_11_URL}`,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}\n- ${DEP_11_URL}`,
      },
      {
        name: 'should merge the restored URL with an existing unrelated entry already present in the field instead of overwriting it (criterion 3: preserving existing/unrelated entries)',
        dependedIssues: [buildDependedIssue({ url: DEP_10_URL })],
        dependingIssueCurrentDependedIssueUrls: [UNRELATED_URL],
        dependingIssueComments: [
          buildComment(
            `${SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
        ],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
        expectedUpdateProjectTextFieldText: `${UNRELATED_URL},${DEP_10_URL}`,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      },
      {
        name: 'should never restore while the depended issue is still in Icebox (criterion 3)',
        dependedIssues: [
          buildDependedIssue({ url: DEP_10_URL, status: ICEBOX_STATUS_NAME }),
        ],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
        ],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should never restore if the depended issue is closed (criterion 4)',
        dependedIssues: [
          buildDependedIssue({
            url: DEP_10_URL,
            isClosed: true,
            status: 'Done',
          }),
        ],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
        ],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should never restore a closed-caused clear even after the depended issue is reopened (criterion 6)',
        dependedIssues: [buildDependedIssue({ url: DEP_10_URL })],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
        ],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should never restore a some-depended-closed-caused clear even after the depended issue is reopened',
        dependedIssues: [buildDependedIssue({ url: DEP_12_URL })],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD}\n- ${DEP_12_URL}`,
            T1,
            1,
          ),
        ],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should never restore a circular-dependency-caused clear even after the cycle is broken (criterion 8)',
        dependedIssues: [
          buildDependedIssue({ url: DEP_10_URL, dependedIssueUrls: [] }),
        ],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
        ],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should not restore when a later Icebox clear cycle governs and the depended issue is still in Icebox, even though an earlier cycle had already been restored (criterion 9: latest relevant comment governs, still in Icebox)',
        dependedIssues: [
          buildDependedIssue({ url: DEP_10_URL, status: ICEBOX_STATUS_NAME }),
        ],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
          buildComment(
            `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T2,
            2,
          ),
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T3,
            3,
          ),
        ],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should restore again when a later Icebox clear cycle governs and the depended issue has left Icebox again, even though an earlier cycle had already been restored (criterion 9: latest relevant comment governs, left Icebox again)',
        dependedIssues: [buildDependedIssue({ url: DEP_10_URL })],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
          buildComment(
            `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T2,
            2,
          ),
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T3,
            3,
          ),
        ],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
        expectedUpdateProjectTextFieldText: DEP_10_URL,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      },
      {
        name: 'should never restore when a later clear cycle is caused by the depended issue being closed, even though an earlier Icebox cycle had already been restored (criterion 9: latest relevant comment governs and its own cause applies)',
        dependedIssues: [buildDependedIssue({ url: DEP_10_URL })],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T1,
            1,
          ),
          buildComment(
            `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T2,
            2,
          ),
          buildComment(
            `${ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
            T3,
            3,
          ),
        ],
        expectedUpdateProjectTextFieldText: null,
        expectedCreateCommentBody: null,
      },
      {
        name: 'should restore only the URL that already left Icebox from a bundled two-URL Icebox clear comment while the other URL stays in Icebox (criterion 10: bundled two-URL clear, partial restore)',
        dependedIssues: [
          buildDependedIssue({ url: DEP_10_URL }),
          buildDependedIssue({ url: DEP_11_URL, status: ICEBOX_STATUS_NAME }),
        ],
        dependingIssueCurrentDependedIssueUrls: [],
        dependingIssueComments: [
          buildComment(
            `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}\n- ${DEP_11_URL}`,
            T1,
            1,
          ),
        ],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
        expectedUpdateProjectTextFieldText: DEP_10_URL,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      },
    ];

    testCases.forEach(
      ({
        name,
        dependedIssues,
        dependingIssueCurrentDependedIssueUrls,
        dependingIssueComments,
        allowedIssueAuthors,
        expectedUpdateProjectTextFieldText,
        expectedCreateCommentBody,
      }) => {
        it(name, async () => {
          jest.clearAllMocks();
          const dependingIssue = buildDependingIssue(
            dependingIssueCurrentDependedIssueUrls,
          );
          mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
            async (url: string) =>
              url === dependingIssue.url ? dependingIssueComments : [],
          );
          const useCase = new DependedIssueURLRestoreUseCase(
            mockIssueRepository,
          );

          const runInput = {
            project: basicProject,
            issues: [...dependedIssues, dependingIssue],
            allowedIssueAuthors,
          };
          await useCase.run(runInput);

          if (expectedUpdateProjectTextFieldText === null) {
            expect(
              mockIssueRepository.updateProjectTextField,
            ).not.toHaveBeenCalled();
          } else {
            expect(
              mockIssueRepository.updateProjectTextField,
            ).toHaveBeenCalledWith(
              basicProject,
              'fieldId',
              dependingIssue,
              expectedUpdateProjectTextFieldText,
            );
          }
          if (expectedCreateCommentBody === null) {
            expect(mockIssueRepository.createComment).not.toHaveBeenCalled();
          } else {
            expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
              dependingIssue,
              expectedCreateCommentBody,
            );
          }
        });
      },
    );

    it('should keep a circular-dependency-caused clear permanent across repeated sweeps, never restoring even on a second run (criterion 8: circular-dependency clear is permanent, confirmed across multiple sweeps)', async () => {
      jest.clearAllMocks();
      const dependedIssue = buildDependedIssue({
        url: DEP_10_URL,
        dependedIssueUrls: [],
      });
      const dependingIssue = buildDependingIssue([]);
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) =>
          url === dependingIssue.url
            ? [
                buildComment(
                  `${CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
                  T1,
                  1,
                ),
              ]
            : [],
      );
      const useCase = new DependedIssueURLRestoreUseCase(mockIssueRepository);

      await useCase.run({
        project: basicProject,
        issues: [dependedIssue, dependingIssue],
      });
      await useCase.run({
        project: basicProject,
        issues: [dependedIssue, dependingIssue],
      });

      expect(mockIssueRepository.updateProjectTextField).not.toHaveBeenCalled();
      expect(mockIssueRepository.createComment).not.toHaveBeenCalled();
    });

    it('should not post a duplicate restore comment or field update on a second sweep run after the issue has already been restored by the first sweep (criterion 9: no duplicate restore)', async () => {
      jest.clearAllMocks();
      const dependedIssue = buildDependedIssue({ url: DEP_10_URL });
      const firstSweepDependingIssue = buildDependingIssue([]);
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) =>
          url === firstSweepDependingIssue.url
            ? [
                buildComment(
                  `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
                  T1,
                  1,
                ),
              ]
            : [],
      );
      const useCase = new DependedIssueURLRestoreUseCase(mockIssueRepository);

      const firstSweepRunInput = {
        project: basicProject,
        issues: [dependedIssue, firstSweepDependingIssue],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
      };
      await useCase.run(firstSweepRunInput);

      expect(mockIssueRepository.updateProjectTextField).toHaveBeenCalledWith(
        basicProject,
        'fieldId',
        firstSweepDependingIssue,
        DEP_10_URL,
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        firstSweepDependingIssue,
        `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      );

      jest.clearAllMocks();
      const secondSweepDependingIssue = buildDependingIssue([DEP_10_URL]);
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) =>
          url === secondSweepDependingIssue.url
            ? [
                buildComment(
                  `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
                  T1,
                  1,
                ),
                buildComment(
                  `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
                  T2,
                  2,
                ),
              ]
            : [],
      );

      await useCase.run({
        project: basicProject,
        issues: [dependedIssue, secondSweepDependingIssue],
      });

      expect(mockIssueRepository.updateProjectTextField).not.toHaveBeenCalled();
      expect(mockIssueRepository.createComment).not.toHaveBeenCalled();
    });

    it('should add the second bundled URL to the field without duplicating the first once it also leaves Icebox in a later sweep (criterion 12: bundled two-URL clear, completed restoration across sweeps)', async () => {
      jest.clearAllMocks();
      const dep10Issue = buildDependedIssue({ url: DEP_10_URL });
      const dep11IssueStillInIcebox = buildDependedIssue({
        url: DEP_11_URL,
        status: ICEBOX_STATUS_NAME,
      });
      const bundledClearComment = buildComment(
        `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}\n- ${DEP_11_URL}`,
        T1,
        1,
      );
      const firstSweepDependingIssue = buildDependingIssue([]);
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) =>
          url === firstSweepDependingIssue.url ? [bundledClearComment] : [],
      );
      const useCase = new DependedIssueURLRestoreUseCase(mockIssueRepository);

      const firstSweepRunInput = {
        project: basicProject,
        issues: [dep10Issue, dep11IssueStillInIcebox, firstSweepDependingIssue],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
      };
      await useCase.run(firstSweepRunInput);

      expect(mockIssueRepository.updateProjectTextField).toHaveBeenCalledWith(
        basicProject,
        'fieldId',
        firstSweepDependingIssue,
        DEP_10_URL,
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        firstSweepDependingIssue,
        `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      );

      jest.clearAllMocks();
      const dep11IssueLeftIcebox = buildDependedIssue({ url: DEP_11_URL });
      const firstSweepRestoreComment = buildComment(
        `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
        T2,
        2,
      );
      const secondSweepDependingIssue = buildDependingIssue([DEP_10_URL]);
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) =>
          url === secondSweepDependingIssue.url
            ? [bundledClearComment, firstSweepRestoreComment]
            : [],
      );

      const secondSweepRunInput = {
        project: basicProject,
        issues: [dep10Issue, dep11IssueLeftIcebox, secondSweepDependingIssue],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
      };
      await useCase.run(secondSweepRunInput);

      expect(mockIssueRepository.updateProjectTextField).toHaveBeenCalledWith(
        basicProject,
        'fieldId',
        secondSweepDependingIssue,
        `${DEP_10_URL},${DEP_11_URL}`,
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        secondSweepDependingIssue,
        `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_11_URL}`,
      );
    });

    it('should still restore a later issue when an earlier issue in the same run throws, and surface a rejection naming the failing issue and its underlying error instead of aborting the rest of the sweep (regression test for per-issue error isolation, mirroring ClearDependedIssueURLUseCase.run failedIssueDescriptions)', async () => {
      jest.clearAllMocks();
      const dependedIssue = buildDependedIssue({ url: DEP_10_URL });
      const firstDependingIssue = buildDependingIssue([]);
      const secondDependingIssue: Issue = {
        ...mock<Issue>(),
        url: SECOND_DEPENDING_ISSUE_URL,
        dependedIssueUrls: [],
        isClosed: false,
      };
      const underlyingError = new Error('GitHub API rate limit exceeded');
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) => {
          if (url === firstDependingIssue.url) {
            throw underlyingError;
          }
          if (url === secondDependingIssue.url) {
            return [
              buildComment(
                `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
                T1,
                1,
              ),
            ];
          }
          return [];
        },
      );
      const useCase = new DependedIssueURLRestoreUseCase(mockIssueRepository);

      const runInput = {
        project: basicProject,
        issues: [dependedIssue, firstDependingIssue, secondDependingIssue],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
      };
      const runPromise = useCase.run(runInput);
      runPromise.catch(() => {});

      let caughtError: unknown;
      try {
        await runPromise;
      } catch (error) {
        caughtError = error;
      }

      if (!(caughtError instanceof Error)) {
        throw new Error('Expected run() to reject with an Error instance');
      }
      expect(caughtError.message).toContain(firstDependingIssue.url);
      expect(caughtError.message).toContain(underlyingError.message);
      expect(mockIssueRepository.updateProjectTextField).toHaveBeenCalledWith(
        basicProject,
        'fieldId',
        secondDependingIssue,
        DEP_10_URL,
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        secondDependingIssue,
        `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      );
    });

    it('should retry and succeed when createComment first fails with a transient 502 error, instead of aborting the sweep on the first transient failure (regression test mirroring ClearDependedIssueURLUseCase.createCommentWithDedup backoff retry)', async () => {
      jest.clearAllMocks();
      const dependedIssue = buildDependedIssue({ url: DEP_10_URL });
      const dependingIssue = buildDependingIssue([]);
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) =>
          url === dependingIssue.url
            ? [
                buildComment(
                  `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
                  T1,
                  1,
                ),
              ]
            : [],
      );
      const transientError = Object.assign(
        new Error(
          'Failed to create comment via GitHub REST API: 502 Bad Gateway',
        ),
        { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
      );
      mockIssueRepository.createComment
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce(undefined);
      const useCase = new DependedIssueURLRestoreUseCase(mockIssueRepository);

      const runInput = {
        project: basicProject,
        issues: [dependedIssue, dependingIssue],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
      };
      await expect(useCase.run(runInput)).resolves.toBeUndefined();

      expect(mockIssueRepository.createComment).toHaveBeenCalledTimes(2);
      expect(mockIssueRepository.updateProjectTextField).toHaveBeenCalledWith(
        basicProject,
        'fieldId',
        dependingIssue,
        DEP_10_URL,
      );
    });

    it('should skip an issue whose updateProjectTextField call fails with StaleProjectItemError, logging it via console.warn with the issue url and stale item id, without that issue causing run to reject, while the other issue in the same run is still restored normally (regression test mirroring ClearDependedIssueURLUseCase.run StaleProjectItemError isolation)', async () => {
      jest.clearAllMocks();
      const dependedIssue = buildDependedIssue({ url: DEP_10_URL });
      const staleDependingIssue = buildDependingIssue([]);
      const okDependingIssue: Issue = {
        ...mock<Issue>(),
        url: SECOND_DEPENDING_ISSUE_URL,
        dependedIssueUrls: [],
        isClosed: false,
      };
      const staleItemId = 'item-stale-1';
      const icebergClearComment = buildComment(
        `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
        T1,
        1,
      );
      mockIssueRepository.getIssueOrPullRequestComments.mockImplementation(
        async (url: string) =>
          url === staleDependingIssue.url || url === okDependingIssue.url
            ? [icebergClearComment]
            : [],
      );
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockIssueRepository.updateProjectTextField.mockImplementation(
        async (_project, _fieldId, issue) => {
          if (issue.url === staleDependingIssue.url) {
            throw new StaleProjectItemError(staleItemId);
          }
        },
      );
      const useCase = new DependedIssueURLRestoreUseCase(mockIssueRepository);

      const runInput = {
        project: basicProject,
        issues: [dependedIssue, staleDependingIssue, okDependingIssue],
        allowedIssueAuthors: ['hs-bot-gh-app[bot]'],
      };
      await expect(useCase.run(runInput)).resolves.toBeUndefined();

      const warnedMessages = consoleWarnSpy.mock.calls.map((call) =>
        call.join(' '),
      );
      expect(
        warnedMessages.some((message) =>
          message.includes(staleDependingIssue.url),
        ),
      ).toBe(true);
      expect(
        warnedMessages.some((message) => message.includes(staleItemId)),
      ).toBe(true);
      expect(mockIssueRepository.updateProjectTextField).toHaveBeenCalledWith(
        basicProject,
        'fieldId',
        okDependingIssue,
        DEP_10_URL,
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        okDependingIssue,
        `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
