import { mock } from 'jest-mock-extended';
import {
  IssueComment,
  IssueRepository,
} from './adapter-interfaces/IssueRepository';
import { DependedIssueURLRestoreUseCase } from './DependedIssueURLRestoreUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';
import {
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD,
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
    const DEP_10_URL = 'https://github.com/o/r/issues/10';
    const DEP_11_URL = 'https://github.com/o/r/issues/11';
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
    ): IssueComment => ({
      id,
      author: 'hs-bot-gh-app[bot]',
      body,
      createdAt,
    });

    const testCases: {
      name: string;
      dependedIssues: Issue[];
      dependingIssueCurrentDependedIssueUrls: string[];
      dependingIssueComments: IssueComment[];
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
        expectedUpdateProjectTextFieldText: DEP_10_URL,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
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
        expectedUpdateProjectTextFieldText: `${UNRELATED_URL},${DEP_10_URL}`,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      },
      {
        name: 'should never restore while the depended issue is still in Icebox (criterion 4)',
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
        name: 'should never restore if the depended issue is closed (criterion 5)',
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
        name: 'should never restore a circular-dependency-caused clear even after the cycle is broken (criterion 7)',
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
        name: 'should not restore when a later Icebox clear cycle governs and the depended issue is still in Icebox, even though an earlier cycle had already been restored (criteria 10-12: latest relevant comment governs, still in Icebox)',
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
        name: 'should restore again when a later Icebox clear cycle governs and the depended issue has left Icebox again, even though an earlier cycle had already been restored (criteria 10-12: latest relevant comment governs, left Icebox again)',
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
        expectedUpdateProjectTextFieldText: DEP_10_URL,
        expectedCreateCommentBody: `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n- ${DEP_10_URL}`,
      },
      {
        name: 'should never restore when a later clear cycle is caused by the depended issue being closed, even though an earlier Icebox cycle had already been restored (criteria 10-12: latest relevant comment governs and its own cause applies)',
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
    ];

    testCases.forEach(
      ({
        name,
        dependedIssues,
        dependingIssueCurrentDependedIssueUrls,
        dependingIssueComments,
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

          await useCase.run({
            project: basicProject,
            issues: [...dependedIssues, dependingIssue],
          });

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

      await useCase.run({
        project: basicProject,
        issues: [dependedIssue, firstSweepDependingIssue],
      });

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
  });
});
