import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'jest-mock-extended';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import {
  ConsoleOperationContext,
  handleComment,
  handleIntmux,
  handleReview,
  handleReviewComment,
  handleTriage,
} from './consoleOperationApi';
import {
  CONSOLE_DONE_TAB_NAMES,
  readDoneProjectItemIds,
} from './consoleDoneStore';

describe('consoleOperationApi', () => {
  let baseDir: string;
  let issueRepository: ReturnType<typeof mock<IssueRepository>>;
  let project: Project;
  let context: ConsoleOperationContext;

  const issue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/o/r/issues/1',
    itemId: 'PVTI_loaded',
  };

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-op-'));
    issueRepository = mock<IssueRepository>();
    issueRepository.get.mockResolvedValue(issue);
    project = {
      ...mock<Project>(),
      id: 'PVT_1',
      status: {
        name: 'Status',
        fieldId: 'statusField',
        statuses: [
          {
            id: 'status_aw',
            name: 'Awaiting workspace',
            color: 'GRAY',
            description: '',
          },
          {
            id: 'status_intmux',
            name: 'In Tmux by human',
            color: 'YELLOW',
            description: '',
          },
          {
            id: 'status_todo',
            name: 'Todo',
            color: 'BLUE',
            description: '',
          },
        ],
      },
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    };
    context = {
      issueRepository,
      resolveProject: async (pjcode: string) =>
        pjcode === 'umino' ? { pjcode, project } : null,
      consoleDataOutputDir: baseDir,
    };
  });

  const contextForProject = (
    nextProject: Project,
  ): ConsoleOperationContext => ({
    issueRepository,
    resolveProject: async (pjcode: string) =>
      pjcode === 'umino' ? { pjcode, project: nextProject } : null,
    consoleDataOutputDir: baseDir,
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  const expectRecordedAcrossTabs = (projectItemId: string): void => {
    for (const tab of CONSOLE_DONE_TAB_NAMES) {
      expect(readDoneProjectItemIds(baseDir, 'umino', tab)).toContain(
        projectItemId,
      );
    }
  };

  describe('handleReview', () => {
    it('approves and sets Awaiting workspace then records done', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'approve',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_a',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        { ...issue, itemId: 'PVTI_a' },
        'status_aw',
      );
      expectRecordedAcrossTabs('PVTI_a');
    });

    it('requests changes with the inline comment', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'request_changes',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_b',
        commentBody: 'please fix',
        changedFilePath: 'src/a.ts',
      });
      expect(response.statusCode).toBe(200);
      expect(
        issueRepository.requestChangesWithInlineComment,
      ).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
        'src/a.ts',
        'please fix',
      );
      expectRecordedAcrossTabs('PVTI_b');
    });

    it('rejects request_changes without a comment body', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'request_changes',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_b',
      });
      expect(response.statusCode).toBe(400);
      expect(
        issueRepository.requestChangesWithInlineComment,
      ).not.toHaveBeenCalled();
    });

    it('closes a pull request and posts a comment', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'close',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
        commentBody: 'closing',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
        'closing',
      );
      expectRecordedAcrossTabs('PVTI_c');
    });

    it('rejects an unknown review action', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'frobnicate',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing prUrl', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'approve',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing action', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing projectItemId', async () => {
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'approve',
        prUrl: 'https://github.com/o/r/pull/1',
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when the issue cannot be loaded during approve', async () => {
      issueRepository.get.mockResolvedValue(null);
      const response = await handleReview(context, {
        pjcode: 'umino',
        action: 'approve',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('returns 400 when the Awaiting workspace status is absent', async () => {
      const contextWithoutStatus = contextForProject({
        ...project,
        status: { name: 'Status', fieldId: 'f', statuses: [] },
      });
      const response = await handleReview(contextWithoutStatus, {
        pjcode: 'umino',
        action: 'approve',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('handleTriage', () => {
    it('sets the status by name', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_d',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        { ...issue, itemId: 'PVTI_d' },
        'status_todo',
      );
      expectRecordedAcrossTabs('PVTI_d');
    });

    it('rejects an unknown status name', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_d',
        statusName: 'Nonexistent',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('sets the story option', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_e',
        storyOptionId: 'story_opt_1',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStory).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PVT_1' }),
        { ...issue, itemId: 'PVTI_e' },
        'story_opt_1',
      );
      expectRecordedAcrossTabs('PVTI_e');
    });

    it('snoozes for one day via updateNextActionDate', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'snooze_1day',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_f',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
      const call = issueRepository.updateNextActionDate.mock.calls[0];
      expect(call[0]).toBe('https://github.com/o/r/issues/1');
      expect(call[1]).toBe(project);
      expect(call[2]).toBeInstanceOf(Date);
      expectRecordedAcrossTabs('PVTI_f');
    });

    it('snoozes for one week via updateNextActionDate', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'snooze_1week',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_g',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
      expectRecordedAcrossTabs('PVTI_g');
    });

    it('closes an issue as completed via the triage close action', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'close',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
        commentBody: 'duplicate',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        'completed',
      );
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        'duplicate',
      );
      expectRecordedAcrossTabs('PVTI_h');
    });

    it('closes an issue as not planned via the triage close_not_planned action', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'close_not_planned',
        issueUrl: 'https://github.com/o/r/issues/2',
        projectItemId: 'PVTI_np',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/2',
        'not_planned',
      );
      expectRecordedAcrossTabs('PVTI_np');
    });

    it('rejects an unknown triage action', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'unknown',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects set_status without a status name', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects set_story without a story option id', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects set_story when the project has no story field', async () => {
      const contextWithoutStory = contextForProject({
        ...project,
        story: null,
      });
      const response = await handleTriage(contextWithoutStory, {
        pjcode: 'umino',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
        storyOptionId: 'story_opt_1',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('rejects a missing issueUrl', async () => {
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'set_status',
        projectItemId: 'PVTI_h',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when the issue cannot be loaded for set_story', async () => {
      issueRepository.get.mockResolvedValue(null);
      const response = await handleTriage(context, {
        pjcode: 'umino',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
        storyOptionId: 'story_opt_1',
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('handleIntmux', () => {
    it('sets the In Tmux by human status and records done', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'umino',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        { ...issue, itemId: 'PVTI_i' },
        'status_intmux',
      );
      expectRecordedAcrossTabs('PVTI_i');
    });

    it('rejects an unknown intmux action', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'umino',
        action: 'unset_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when the issue cannot be loaded', async () => {
      issueRepository.get.mockResolvedValue(null);
      const response = await handleIntmux(context, {
        pjcode: 'umino',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing issueUrl', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'umino',
        action: 'set_intmux',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing projectItemId', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'umino',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing action', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'umino',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('per-project resolution', () => {
    it('rejects an operation whose body has no pjcode', async () => {
      const response = await handleTriage(context, {
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_k',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('rejects an operation whose pjcode has no configured project', async () => {
      const response = await handleTriage(context, {
        pjcode: 'unknown-project',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_k',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('records the .done exclusion under the resolved pjcode', async () => {
      const otherProject: Project = { ...project, id: 'PVT_other' };
      const multiContext: ConsoleOperationContext = {
        issueRepository,
        resolveProject: async (pjcode: string) => {
          if (pjcode === 'umino') {
            return { pjcode, project };
          }
          if (pjcode === 'xmile') {
            return { pjcode, project: otherProject };
          }
          return null;
        },
        consoleDataOutputDir: baseDir,
      };
      const response = await handleTriage(multiContext, {
        pjcode: 'xmile',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_x',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        otherProject,
        { ...issue, itemId: 'PVTI_x' },
        'status_todo',
      );
      for (const tab of CONSOLE_DONE_TAB_NAMES) {
        expect(readDoneProjectItemIds(baseDir, 'xmile', tab)).toContain(
          'PVTI_x',
        );
        expect(readDoneProjectItemIds(baseDir, 'umino', tab)).not.toContain(
          'PVTI_x',
        );
      }
    });
  });

  describe('done recording skips when storage is not configured', () => {
    it('does not throw when consoleDataOutputDir is null', async () => {
      const noStorageContext: ConsoleOperationContext = {
        ...context,
        consoleDataOutputDir: null,
      };
      const response = await handleIntmux(noStorageContext, {
        pjcode: 'umino',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_j',
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('handleComment', () => {
    it('posts a comment and returns the created comment', async () => {
      issueRepository.getIssueOrPullRequestComments.mockResolvedValue([
        {
          author: 'github-actions',
          body: 'All required checks have passed.',
          createdAt: new Date('2026-06-17T07:48:11.000Z'),
        },
        {
          author: 'HiromiShikata',
          body: 'Please rebase onto the latest main branch.',
          createdAt: new Date('2026-06-17T09:03:27.000Z'),
        },
      ]);
      const response = await handleComment(context, {
        pjcode: 'umino',
        url: 'https://github.com/o/r/issues/1',
        body: 'Please rebase onto the latest main branch.',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        'Please rebase onto the latest main branch.',
      );
      expect(response.body).toEqual({
        ok: true,
        comment: {
          author: 'HiromiShikata',
          body: 'Please rebase onto the latest main branch.',
          createdAt: '2026-06-17T09:03:27.000Z',
        },
      });
    });

    it('falls back to the posted body when no comment is returned', async () => {
      issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
      const response = await handleComment(context, {
        pjcode: 'umino',
        url: 'https://github.com/o/r/issues/1',
        body: 'A first comment on this issue.',
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        comment: {
          author: '',
          body: 'A first comment on this issue.',
          createdAt: '',
        },
      });
    });

    it('rejects when url is missing', async () => {
      const response = await handleComment(context, {
        pjcode: 'umino',
        body: 'A comment without a target url.',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('rejects when body is missing', async () => {
      const response = await handleComment(context, {
        pjcode: 'umino',
        url: 'https://github.com/o/r/issues/1',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });
  });

  describe('handleReviewComment', () => {
    const validRequest = {
      pjcode: 'umino',
      url: 'https://github.com/o/r/pull/1',
      path: 'src/index.ts',
      line: 42,
      side: 'RIGHT',
      body: 'Consider extracting this into a helper.',
    };

    it('creates a line-anchored review comment on the pull request', async () => {
      const response = await handleReviewComment(context, validRequest);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(
        issueRepository.createPullRequestReviewComment,
      ).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
        'src/index.ts',
        42,
        'RIGHT',
        'Consider extracting this into a helper.',
      );
    });

    it('rejects when url is missing', async () => {
      const response = await handleReviewComment(context, {
        ...validRequest,
        url: '',
      });
      expect(response.statusCode).toBe(400);
      expect(
        issueRepository.createPullRequestReviewComment,
      ).not.toHaveBeenCalled();
    });

    it('rejects when path is missing', async () => {
      const response = await handleReviewComment(context, {
        ...validRequest,
        path: '',
      });
      expect(response.statusCode).toBe(400);
      expect(
        issueRepository.createPullRequestReviewComment,
      ).not.toHaveBeenCalled();
    });

    it('rejects when line is not a positive integer', async () => {
      const response = await handleReviewComment(context, {
        ...validRequest,
        line: 0,
      });
      expect(response.statusCode).toBe(400);
      expect(
        issueRepository.createPullRequestReviewComment,
      ).not.toHaveBeenCalled();
    });

    it('rejects when side is not LEFT or RIGHT', async () => {
      const response = await handleReviewComment(context, {
        ...validRequest,
        side: 'CENTER',
      });
      expect(response.statusCode).toBe(400);
      expect(
        issueRepository.createPullRequestReviewComment,
      ).not.toHaveBeenCalled();
    });

    it('rejects when body is missing', async () => {
      const response = await handleReviewComment(context, {
        ...validRequest,
        body: '',
      });
      expect(response.statusCode).toBe(400);
      expect(
        issueRepository.createPullRequestReviewComment,
      ).not.toHaveBeenCalled();
    });

    it('surfaces the GitHub error message when the comment cannot be created', async () => {
      issueRepository.createPullRequestReviewComment.mockRejectedValue(
        new Error(
          'Failed to create review comment on PR https://github.com/o/r/pull/1: Validation Failed: line must be part of the diff',
        ),
      );
      const response = await handleReviewComment(context, validRequest);
      expect(response.statusCode).toBe(502);
      expect(response.body).toEqual({
        error:
          'Failed to create review comment on PR https://github.com/o/r/pull/1: Validation Failed: line must be part of the diff',
      });
    });
  });
});
