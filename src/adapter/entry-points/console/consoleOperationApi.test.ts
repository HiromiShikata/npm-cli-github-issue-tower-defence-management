import * as fs from 'fs';
import { mock } from 'jest-mock-extended';
import * as os from 'os';
import * as path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import type { StoryObjectMap } from '../../../domain/entities/StoryObjectMap';
import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import {
  CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES,
  CONSOLE_DONE_STORY_SELECTED_TAB_NAMES,
  CONSOLE_DONE_TAB_NAMES,
  readDoneProjectItemIds,
} from './consoleDoneStore';
import {
  CONFLICT_RETURNED_MESSAGE,
  type ConsoleOperationContext,
  type ConsoleProjectBinding,
  handleAttachmentUpload,
  handleComment,
  handleCreateIssue,
  handleDeleteAllComments,
  handleDeleteStory,
  handleIntmux,
  handleProjectMaxPreparingUpdate,
  handleReorderStory,
  handleReview,
  handleReviewComment,
  handleSetDependedIssueUrl,
  handleStoryAdd,
  handleStoryColor,
  handleStoryRename,
  handleTimer,
  handleTriage,
} from './consoleOperationApi';
import * as projectConfig from '../cli/projectConfig';
import { readProjectTimer } from './consoleProjectTimerStore';

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
    issueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/o/r/pull/1',
      branchName: null,
      createdAt: new Date(0),
      isDraft: false,
      isConflicted: false,
      mergeable: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isResolvedAllReviewComments: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    issueRepository.getPullRequestDetail.mockResolvedValue({
      title: 'Test PR',
      state: 'open',
      merged: false,
      isDraft: false,
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      headRefName: 'feature',
      baseRefName: 'main',
      author: 'other-user',
      files: [],
    });
    issueRepository.getAuthenticatedUserLogin.mockResolvedValue(
      'authenticated-user',
    );
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
      resolveIssueRepository: () => issueRepository,
      resolveProject: async (pjcode: string) =>
        pjcode === 'acme' ? { pjcode, project } : null,
      isPjcodeConfigured: (pjcode: string) => pjcode === 'acme',
      consoleDataOutputDir: baseDir,
      issueAttachmentRepository: null,
      resolveProjectRepository: null,
      invalidateProject: null,
      updateProjectCacheEntry: null,
      patchItemIntoQueuedTab: null,
    };
  });

  const contextForProject = (
    nextProject: Project,
  ): ConsoleOperationContext => ({
    resolveIssueRepository: () => issueRepository,
    resolveProject: async (pjcode: string) =>
      pjcode === 'acme' ? { pjcode, project: nextProject } : null,
    isPjcodeConfigured: (pjcode: string) => pjcode === 'acme',
    consoleDataOutputDir: baseDir,
    issueAttachmentRepository: null,
    resolveProjectRepository: null,
    invalidateProject: null,
    updateProjectCacheEntry: null,
    patchItemIntoQueuedTab: null,
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  const expectRecordedAcrossTabs = (projectItemId: string): void => {
    for (const tab of CONSOLE_DONE_TAB_NAMES) {
      expect(readDoneProjectItemIds(baseDir, 'acme', tab)).toContain(
        projectItemId,
      );
    }
  };

  const expectRecordedOnlyIn = (
    projectItemId: string,
    recordedTabs: string[],
  ): void => {
    for (const tab of CONSOLE_DONE_TAB_NAMES) {
      if (recordedTabs.includes(tab)) {
        expect(readDoneProjectItemIds(baseDir, 'acme', tab)).toContain(
          projectItemId,
        );
        continue;
      }
      expect(readDoneProjectItemIds(baseDir, 'acme', tab)).not.toContain(
        projectItemId,
      );
    }
  };

  describe('handleReview', () => {
    it('approves and merges, sets Awaiting workspace then records done', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_a',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.mergePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({
          itemId: 'PVTI_a',
          url: 'https://github.com/o/r/pull/1',
        }),
        'status_aw',
      );
      expect(issueRepository.get).not.toHaveBeenCalled();
      expectRecordedOnlyIn('PVTI_a', CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES);
    });

    it('resolves the issue repository from the url of the operated pull request', async () => {
      const resolvedUrls: string[] = [];
      const contextRecordingResolvedUrls: ConsoleOperationContext = {
        ...context,
        resolveIssueRepository: (issueOrPullRequestUrl: string) => {
          resolvedUrls.push(issueOrPullRequestUrl);
          return issueRepository;
        },
      };

      await handleReview(contextRecordingResolvedUrls, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/acme-labs/acme-portal-mock/pull/178',
        projectItemId: 'PVTI_resolver',
      });

      expect(resolvedUrls).toContain(
        'https://github.com/acme-labs/acme-portal-mock/pull/178',
      );
    });

    it('requests changes with the inline comment anchored to a line and side', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'request_changes',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_b',
        commentBody: 'please fix',
        changedFilePath: 'src/a.ts',
        line: 17,
        side: 'RIGHT',
      });
      expect(response.statusCode).toBe(200);
      expect(
        issueRepository.requestChangesWithInlineComment,
      ).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
        'src/a.ts',
        'please fix',
        {
          line: 17,
          side: 'RIGHT',
        },
      );
      expectRecordedOnlyIn('PVTI_b', CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES);
    });

    it('requests changes without a line anchor when line and side are missing', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
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
        null,
      );
      expectRecordedOnlyIn('PVTI_b', CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES);
    });

    it('rejects request_changes without a comment body', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
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
        pjcode: 'acme',
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

    it('closes a pull request and moves linked issue to Awaiting workspace when issueUrl is provided', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'close',
        prUrl: 'https://github.com/o/r/pull/1',
        issueUrl: 'https://github.com/o/r/issues/7',
        projectItemId: 'PVTI_c_totally_wrong',
        commentBody: 'totally wrong',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
        'totally wrong',
      );
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({
          itemId: 'PVTI_c_totally_wrong',
          url: 'https://github.com/o/r/issues/7',
        }),
        'status_aw',
      );
      expectRecordedAcrossTabs('PVTI_c_totally_wrong');
    });

    it('marks a pull request unnecessary by closing it, labelling the item chore and moving it to Awaiting workspace', async () => {
      issueRepository.getIssueByUrl.mockResolvedValue({
        ...issue,
        url: 'https://github.com/o/r/issues/7',
        org: 'o',
        repo: 'r',
        number: 7,
        labels: ['bug'],
      });
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'unnecessary',
        prUrl: 'https://github.com/o/r/pull/1',
        issueUrl: 'https://github.com/o/r/issues/7',
        projectItemId: 'PVTI_unnecessary',
        commentBody: 'This pull request is unnecessary.',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
        'This pull request is unnecessary.',
      );
      expect(issueRepository.updateLabels).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://github.com/o/r/issues/7' }),
        ['bug', 'chore'],
      );
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({ itemId: 'PVTI_unnecessary' }),
        'status_aw',
      );
      expectRecordedAcrossTabs('PVTI_unnecessary');
    });

    it('tells the linked issue that the unnecessary pull request must not be created again', async () => {
      issueRepository.getIssueByUrl.mockResolvedValue({
        ...issue,
        url: 'https://github.com/o/r/issues/9',
        org: 'o',
        repo: 'r',
        number: 9,
        labels: ['bug'],
      });
      const issueCommentBody =
        'The pull request for this issue was unnecessary and has been closed: https://github.com/o/r/pull/3\n\nDo not create it again.';
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'unnecessary',
        prUrl: 'https://github.com/o/r/pull/3',
        issueUrl: 'https://github.com/o/r/issues/9',
        projectItemId: 'PVTI_unnecessary_issue_comment',
        commentBody: 'This pull request is unnecessary.',
        issueCommentBody,
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/9',
        issueCommentBody,
      );
    });

    it('keeps the chore label once when the unnecessary item already carries it', async () => {
      issueRepository.getIssueByUrl.mockResolvedValue({
        ...issue,
        url: 'https://github.com/o/r/issues/8',
        org: 'o',
        repo: 'r',
        number: 8,
        labels: ['chore'],
      });
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'unnecessary',
        prUrl: 'https://github.com/o/r/pull/2',
        issueUrl: 'https://github.com/o/r/issues/8',
        projectItemId: 'PVTI_unnecessary_dup',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateLabels).not.toHaveBeenCalled();
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({ itemId: 'PVTI_unnecessary_dup' }),
        'status_aw',
      );
    });

    it('rejects an unnecessary action without an issueUrl', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'unnecessary',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_unnecessary_missing',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.closePullRequest).not.toHaveBeenCalled();
    });

    it('leaves labels and status untouched for the plain close action', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'close',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_plain_close',
        commentBody: 'closing',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateLabels).not.toHaveBeenCalled();
      expect(issueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('rejects an unknown review action', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'frobnicate',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing prUrl', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing action', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing projectItemId', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
      });
      expect(response.statusCode).toBe(400);
    });

    it('merges without approving using the request project item id without a GraphQL item fetch', async () => {
      issueRepository.get.mockResolvedValue(null);
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.get).not.toHaveBeenCalled();
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({ itemId: 'PVTI_c' }),
        'status_aw',
      );
    });

    it('returns 400 when the Awaiting workspace status is absent', async () => {
      const contextWithoutStatus = contextForProject({
        ...project,
        status: { name: 'Status', fieldId: 'f', statuses: [] },
      });
      const response = await handleReview(contextWithoutStatus, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_c',
      });
      expect(response.statusCode).toBe(400);
    });

    it('skips approval and merges directly when the pull request author matches the authenticated account', async () => {
      issueRepository.getPullRequestDetail.mockResolvedValue({
        title: 'Self PR',
        state: 'open',
        merged: false,
        isDraft: false,
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        headRefName: 'feature',
        baseRefName: 'main',
        author: 'authenticated-user',
        files: [],
      });
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_self',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.approvePullRequest).not.toHaveBeenCalled();
      expect(issueRepository.mergePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
    });

    it('merges the pull request when approvePullRequest returns HTTP 422', async () => {
      issueRepository.getPullRequestDetail.mockResolvedValue(null);
      issueRepository.approvePullRequest.mockRejectedValue(
        new Error(
          'Failed to approve PR https://github.com/o/r/pull/1: HTTP 422 Review Can not approve your own pull request',
        ),
      );
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_422',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.mergePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.updateStatus).toHaveBeenCalled();
    });

    it('re-throws errors other than HTTP 422 from approvePullRequest', async () => {
      issueRepository.getPullRequestDetail.mockResolvedValue(null);
      issueRepository.approvePullRequest.mockRejectedValue(
        new Error(
          'Failed to approve PR https://github.com/o/r/pull/1: HTTP 500 Internal Server Error',
        ),
      );
      await expect(
        handleReview(context, {
          pjcode: 'acme',
          action: 'approve_and_merge',
          prUrl: 'https://github.com/o/r/pull/1',
          projectItemId: 'PVTI_500',
        }),
      ).rejects.toThrow('HTTP 500');
      expect(issueRepository.mergePullRequest).not.toHaveBeenCalled();
    });

    it('returns 400 when mergePullRequest fails with a 403 workflow scope error', async () => {
      issueRepository.mergePullRequest.mockRejectedValue(
        new Error(
          'Failed to merge PR https://github.com/o/r/pull/1: HTTP 403 permission denied, the token cannot perform this operation refusing to allow an OAuth App to create or update workflow `.github/workflows/test.yml` without `workflow` scope',
        ),
      );
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_403wf',
      });
      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        error: `Cannot merge: this pull request modifies workflow files and the configured token lacks 'workflow' scope. Please merge this pull request manually.`,
      });
      expect(issueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('posts a conflict comment, moves to Awaiting workspace, and returns 200 when the pull request has a merge conflict', async () => {
      issueRepository.getOpenPullRequest.mockResolvedValue({
        url: 'https://github.com/o/r/pull/1',
        branchName: null,
        createdAt: new Date(0),
        isDraft: false,
        isConflicted: true,
        mergeable: 'CONFLICTING',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      });
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_conflict',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
        CONFLICT_RETURNED_MESSAGE,
      );
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({
          itemId: 'PVTI_conflict',
          url: 'https://github.com/o/r/pull/1',
        }),
        'status_aw',
      );
      expect(issueRepository.mergePullRequest).not.toHaveBeenCalled();
      expectRecordedOnlyIn(
        'PVTI_conflict',
        CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES,
      );
    });

    it('returns 400 with check names when required checks are not green', async () => {
      issueRepository.getOpenPullRequest.mockResolvedValue({
        url: 'https://github.com/o/r/pull/1',
        branchName: null,
        createdAt: new Date(0),
        isDraft: false,
        isConflicted: false,
        mergeable: 'MERGEABLE',
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: ['test', 'lint'],
      });
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_ci',
      });
      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Cannot merge: required checks are not green: test, lint',
      });
      expect(issueRepository.mergePullRequest).not.toHaveBeenCalled();
    });

    it('returns 400 when the pull request is not found or already closed', async () => {
      issueRepository.getOpenPullRequest.mockResolvedValue(null);
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve_and_merge',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_gone',
      });
      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Cannot merge: pull request not found or already closed',
      });
      expect(issueRepository.mergePullRequest).not.toHaveBeenCalled();
    });
  });

  describe('handleTriage', () => {
    it('sets the status by name', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_d',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({
          itemId: 'PVTI_d',
          url: 'https://github.com/o/r/issues/1',
        }),
        'status_todo',
      );
      expect(issueRepository.get).not.toHaveBeenCalled();
      expectRecordedOnlyIn('PVTI_d', CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES);
    });

    it('keeps a status change out of the story-selected tabs', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_status_only',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(200);
      expectRecordedOnlyIn(
        'PVTI_status_only',
        CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES,
      );
    });

    it('keeps a story change out of the status-selected tabs', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_story_only',
        storyOptionId: 'story_opt_1',
      });
      expect(response.statusCode).toBe(200);
      expectRecordedOnlyIn(
        'PVTI_story_only',
        CONSOLE_DONE_STORY_SELECTED_TAB_NAMES,
      );
    });

    it('rejects an unknown status name', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
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
        pjcode: 'acme',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_e',
        storyOptionId: 'story_opt_1',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStory).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PVT_1' }),
        expect.objectContaining({ itemId: 'PVTI_e' }),
        'story_opt_1',
      );
      expect(issueRepository.get).not.toHaveBeenCalled();
      expectRecordedOnlyIn('PVTI_e', CONSOLE_DONE_STORY_SELECTED_TAB_NAMES);
    });

    it('snoozes for one day via updateNextActionDate', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
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
        pjcode: 'acme',
        action: 'snooze_1week',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_g',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
      expectRecordedAcrossTabs('PVTI_g');
    });

    it('snoozes for one hour via updateNextActionHour', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00Z'));
      try {
        const projectWithHour: Project = {
          ...project,
          nextActionHour: {
            name: 'Next Action Hour',
            fieldId: 'nahField',
            options: [],
          },
        };
        const response = await handleTriage(
          contextForProject(projectWithHour),
          {
            pjcode: 'acme',
            action: 'snooze_1hour',
            issueUrl: 'https://github.com/o/r/issues/1',
            projectItemId: 'PVTI_1h',
          },
        );
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionHour).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionHour.mock.calls[0];
        expect(call[0]).toMatchObject({
          nextActionHour: { fieldId: 'nahField' },
        });
        expect(call[2]).toBe(13);
        expect(issueRepository.updateNextActionDate).not.toHaveBeenCalled();
        expectRecordedAcrossTabs('PVTI_1h');
      } finally {
        jest.useRealTimers();
      }
    });

    it('snoozes for three hours via updateNextActionHour', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00Z'));
      try {
        const projectWithHour: Project = {
          ...project,
          nextActionHour: {
            name: 'Next Action Hour',
            fieldId: 'nahField',
            options: [],
          },
        };
        const response = await handleTriage(
          contextForProject(projectWithHour),
          {
            pjcode: 'acme',
            action: 'snooze_3hours',
            issueUrl: 'https://github.com/o/r/issues/1',
            projectItemId: 'PVTI_3h',
          },
        );
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionHour).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionHour.mock.calls[0];
        expect(call[0]).toMatchObject({
          nextActionHour: { fieldId: 'nahField' },
        });
        expect(call[2]).toBe(15);
        expect(issueRepository.updateNextActionDate).not.toHaveBeenCalled();
        expectRecordedAcrossTabs('PVTI_3h');
      } finally {
        jest.useRealTimers();
      }
    });

    it('snoozes for six hours via updateNextActionHour', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00Z'));
      try {
        const projectWithHour: Project = {
          ...project,
          nextActionHour: {
            name: 'Next Action Hour',
            fieldId: 'nahField',
            options: [],
          },
        };
        const response = await handleTriage(
          contextForProject(projectWithHour),
          {
            pjcode: 'acme',
            action: 'snooze_6hours',
            issueUrl: 'https://github.com/o/r/issues/1',
            projectItemId: 'PVTI_6h',
          },
        );
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionHour).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionHour.mock.calls[0];
        expect(call[0]).toMatchObject({
          nextActionHour: { fieldId: 'nahField' },
        });
        expect(call[2]).toBe(18);
        expect(issueRepository.updateNextActionDate).not.toHaveBeenCalled();
        expectRecordedAcrossTabs('PVTI_6h');
      } finally {
        jest.useRealTimers();
      }
    });

    it('wraps snooze_3hours hour and sets nextActionDate when crossing midnight', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T22:00:00Z'));
      try {
        const projectWithHour: Project = {
          ...project,
          nextActionHour: {
            name: 'Next Action Hour',
            fieldId: 'nahField',
            options: [],
          },
        };
        const response = await handleTriage(
          contextForProject(projectWithHour),
          {
            pjcode: 'acme',
            action: 'snooze_3hours',
            issueUrl: 'https://github.com/o/r/issues/1',
            projectItemId: 'PVTI_3h_wrap',
          },
        );
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionHour).toHaveBeenCalledTimes(1);
        expect(
          issueRepository.updateNextActionHour.mock.calls[0][0],
        ).toMatchObject({ nextActionHour: { fieldId: 'nahField' } });
        expect(issueRepository.updateNextActionHour.mock.calls[0][2]).toBe(1);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        expect(issueRepository.updateNextActionDate.mock.calls[0][0]).toBe(
          'https://github.com/o/r/issues/1',
        );
        expect(
          issueRepository.updateNextActionDate.mock.calls[0][1],
        ).toMatchObject(projectWithHour);
        expect(issueRepository.updateNextActionDate.mock.calls[0][2]).toEqual(
          new Date('2026-01-02T00:00:00Z'),
        );
        expect(issueRepository.updateNextActionDate.mock.calls[0][3]).toBe(
          'PVTI_3h_wrap',
        );
        expectRecordedAcrossTabs('PVTI_3h_wrap');
      } finally {
        jest.useRealTimers();
      }
    });

    it('wraps snooze_1hour hour and sets nextActionDate when crossing midnight', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T23:00:00Z'));
      try {
        const projectWithHour: Project = {
          ...project,
          nextActionHour: {
            name: 'Next Action Hour',
            fieldId: 'nahField',
            options: [],
          },
        };
        const response = await handleTriage(
          contextForProject(projectWithHour),
          {
            pjcode: 'acme',
            action: 'snooze_1hour',
            issueUrl: 'https://github.com/o/r/issues/1',
            projectItemId: 'PVTI_1h_wrap',
          },
        );
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionHour).toHaveBeenCalledTimes(1);
        expect(
          issueRepository.updateNextActionHour.mock.calls[0][0],
        ).toMatchObject({ nextActionHour: { fieldId: 'nahField' } });
        expect(issueRepository.updateNextActionHour.mock.calls[0][2]).toBe(0);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        expect(issueRepository.updateNextActionDate.mock.calls[0][0]).toBe(
          'https://github.com/o/r/issues/1',
        );
        expect(
          issueRepository.updateNextActionDate.mock.calls[0][1],
        ).toMatchObject(projectWithHour);
        expect(issueRepository.updateNextActionDate.mock.calls[0][2]).toEqual(
          new Date('2026-01-02T00:00:00Z'),
        );
        expect(issueRepository.updateNextActionDate.mock.calls[0][3]).toBe(
          'PVTI_1h_wrap',
        );
        expectRecordedAcrossTabs('PVTI_1h_wrap');
      } finally {
        jest.useRealTimers();
      }
    });

    it('wraps snooze_6hours hour and sets nextActionDate when crossing midnight', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T20:00:00Z'));
      try {
        const projectWithHour: Project = {
          ...project,
          nextActionHour: {
            name: 'Next Action Hour',
            fieldId: 'nahField',
            options: [],
          },
        };
        const response = await handleTriage(
          contextForProject(projectWithHour),
          {
            pjcode: 'acme',
            action: 'snooze_6hours',
            issueUrl: 'https://github.com/o/r/issues/1',
            projectItemId: 'PVTI_6h_wrap',
          },
        );
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionHour).toHaveBeenCalledTimes(1);
        expect(issueRepository.updateNextActionHour.mock.calls[0][2]).toBe(2);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        expect(issueRepository.updateNextActionDate.mock.calls[0][2]).toEqual(
          new Date('2026-01-02T00:00:00Z'),
        );
        expectRecordedAcrossTabs('PVTI_6h_wrap');
      } finally {
        jest.useRealTimers();
      }
    });

    it('snoozes for two days via updateNextActionDate', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'snooze_2days',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_2d',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
      const call = issueRepository.updateNextActionDate.mock.calls[0];
      expect(call[0]).toBe('https://github.com/o/r/issues/1');
      expect(call[1]).toBe(project);
      expect(call[2]).toBeInstanceOf(Date);
      expectRecordedAcrossTabs('PVTI_2d');
    });

    it('snoozes for three days via updateNextActionDate', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-10T00:00:00Z'));
      try {
        const response = await handleTriage(context, {
          pjcode: 'acme',
          action: 'snooze_3days',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_3d',
        });
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionDate.mock.calls[0];
        expect(call[2]).toEqual(new Date('2026-01-13T00:00:00Z'));
        expectRecordedAcrossTabs('PVTI_3d');
      } finally {
        jest.useRealTimers();
      }
    });

    it('snoozes for five days via updateNextActionDate', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-10T00:00:00Z'));
      try {
        const response = await handleTriage(context, {
          pjcode: 'acme',
          action: 'snooze_5days',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_5d',
        });
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionDate.mock.calls[0];
        expect(call[2]).toEqual(new Date('2026-01-15T00:00:00Z'));
        expectRecordedAcrossTabs('PVTI_5d');
      } finally {
        jest.useRealTimers();
      }
    });

    it('snoozes for one month via updateNextActionDate', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T10:00:00Z'));
      try {
        const response = await handleTriage(context, {
          pjcode: 'acme',
          action: 'snooze_1month',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_1mo',
        });
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionDate.mock.calls[0];
        expect(call[2]).toEqual(new Date('2026-02-15T00:00:00Z'));
        expectRecordedAcrossTabs('PVTI_1mo');
      } finally {
        jest.useRealTimers();
      }
    });

    it('snoozes one month correctly at month end (Jan 31 → Feb 28)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-31T10:00:00Z'));
      try {
        const response = await handleTriage(context, {
          pjcode: 'acme',
          action: 'snooze_1month',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_1mo_end',
        });
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionDate.mock.calls[0];
        expect(call[2]).toEqual(new Date('2026-02-28T00:00:00Z'));
      } finally {
        jest.useRealTimers();
      }
    });

    it('snoozes one month crossing year boundary (Dec 15 → Jan 15)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-12-15T10:00:00Z'));
      try {
        const response = await handleTriage(context, {
          pjcode: 'acme',
          action: 'snooze_1month',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_1mo_dec',
        });
        expect(response.statusCode).toBe(200);
        expect(issueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
        const call = issueRepository.updateNextActionDate.mock.calls[0];
        expect(call[2]).toEqual(new Date('2027-01-15T00:00:00Z'));
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns 400 when snooze_1hour is used on a project without nextActionHour', async () => {
      const projectWithoutHour: Project = { ...project, nextActionHour: null };
      const response = await handleTriage(
        contextForProject(projectWithoutHour),
        {
          pjcode: 'acme',
          action: 'snooze_1hour',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_nah',
        },
      );
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateNextActionHour).not.toHaveBeenCalled();
    });

    it('returns 400 when snooze_3hours is used on a project without nextActionHour', async () => {
      const projectWithoutHour: Project = { ...project, nextActionHour: null };
      const response = await handleTriage(
        contextForProject(projectWithoutHour),
        {
          pjcode: 'acme',
          action: 'snooze_3hours',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_nah3',
        },
      );
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateNextActionHour).not.toHaveBeenCalled();
    });

    it('returns 400 when snooze_6hours is used on a project without nextActionHour', async () => {
      const projectWithoutHour: Project = { ...project, nextActionHour: null };
      const response = await handleTriage(
        contextForProject(projectWithoutHour),
        {
          pjcode: 'acme',
          action: 'snooze_6hours',
          issueUrl: 'https://github.com/o/r/issues/1',
          projectItemId: 'PVTI_nah6',
        },
      );
      expect(response.statusCode).toBe(400);
      expect(issueRepository.updateNextActionHour).not.toHaveBeenCalled();
    });

    it('closes an issue as completed via the triage close action', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
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
        pjcode: 'acme',
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

    it('closes a pull request via the triage close action without an invalid state_reason', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'close',
        issueUrl: 'https://github.com/o/r/pull/7',
        projectItemId: 'PVTI_prclose',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/7',
      );
      expect(issueRepository.closeIssueByUrl).not.toHaveBeenCalled();
      expectRecordedAcrossTabs('PVTI_prclose');
    });

    it('closes a pull request via the triage close_not_planned action through the pull-request close path', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'close_not_planned',
        issueUrl: 'https://github.com/o/r/pull/8',
        projectItemId: 'PVTI_prnp',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/8',
      );
      expect(issueRepository.closeIssueByUrl).not.toHaveBeenCalled();
      expectRecordedAcrossTabs('PVTI_prnp');
    });

    it('rejects an unknown triage action', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'unknown',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects set_status without a status name', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects set_story without a story option id', async () => {
      const response = await handleTriage(context, {
        pjcode: 'acme',
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
        pjcode: 'acme',
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
        pjcode: 'acme',
        action: 'set_status',
        projectItemId: 'PVTI_h',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(400);
    });

    it('sets the story using the request project item id without a GraphQL item fetch', async () => {
      issueRepository.get.mockResolvedValue(null);
      const response = await handleTriage(context, {
        pjcode: 'acme',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_h',
        storyOptionId: 'story_opt_1',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.get).not.toHaveBeenCalled();
      expect(issueRepository.updateStory).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PVT_1' }),
        expect.objectContaining({ itemId: 'PVTI_h' }),
        'story_opt_1',
      );
    });

    it('calls patchItemIntoQueuedTab after set_status to Awaiting Workspace', async () => {
      const patchItemIntoQueuedTab = jest.fn();
      const awContext: ConsoleOperationContext = {
        ...context,
        patchItemIntoQueuedTab,
      };
      const response = await handleTriage(awContext, {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_aw',
        statusName: 'Awaiting Workspace',
      });
      expect(response.statusCode).toBe(200);
      expect(patchItemIntoQueuedTab).toHaveBeenCalledWith(
        'acme',
        'PVTI_aw',
        'Awaiting workspace',
      );
    });

    it('calls patchItemIntoQueuedTab after set_status to Preparation', async () => {
      const projectWithPreparation: Project = {
        ...project,
        status: {
          ...project.status,
          statuses: [
            ...project.status.statuses,
            {
              id: 'status_prep',
              name: 'Preparation',
              color: 'BLUE',
              description: '',
            },
          ],
        },
      };
      const patchItemIntoQueuedTab = jest.fn();
      const prepContext: ConsoleOperationContext = {
        ...contextForProject(projectWithPreparation),
        patchItemIntoQueuedTab,
      };
      const response = await handleTriage(prepContext, {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_prep',
        statusName: 'Preparation',
      });
      expect(response.statusCode).toBe(200);
      expect(patchItemIntoQueuedTab).toHaveBeenCalledWith(
        'acme',
        'PVTI_prep',
        'Preparation',
      );
    });

    it('does not call patchItemIntoQueuedTab when set_status changes to a non-queued status', async () => {
      const patchItemIntoQueuedTab = jest.fn();
      const todoContext: ConsoleOperationContext = {
        ...context,
        patchItemIntoQueuedTab,
      };
      const response = await handleTriage(todoContext, {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_todo',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(200);
      expect(patchItemIntoQueuedTab).not.toHaveBeenCalled();
    });
  });

  describe('close operations avoid loading the project via GraphQL', () => {
    let resolveProjectSpy: jest.Mock<
      Promise<ConsoleProjectBinding | null>,
      [string]
    >;
    let spiedContext: ConsoleOperationContext;

    beforeEach(() => {
      resolveProjectSpy = jest.fn(async (pjcode: string) =>
        pjcode === 'acme' ? { pjcode, project } : null,
      );
      spiedContext = {
        resolveIssueRepository: () => issueRepository,
        resolveProject: resolveProjectSpy,
        isPjcodeConfigured: (pjcode: string) => pjcode === 'acme',
        consoleDataOutputDir: baseDir,
        issueAttachmentRepository: null,
        resolveProjectRepository: null,
        invalidateProject: null,
        updateProjectCacheEntry: null,
        patchItemIntoQueuedTab: null,
      };
    });

    it('closes an issue via triage without resolving the project', async () => {
      const response = await handleTriage(spiedContext, {
        pjcode: 'acme',
        action: 'close',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_noproj_close',
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
      expect(resolveProjectSpy).not.toHaveBeenCalled();
      expect(issueRepository.get).not.toHaveBeenCalled();
    });

    it('closes not planned via triage without resolving the project', async () => {
      const response = await handleTriage(spiedContext, {
        pjcode: 'acme',
        action: 'close_not_planned',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_noproj_np',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        'not_planned',
      );
      expect(resolveProjectSpy).not.toHaveBeenCalled();
    });

    it('closes a pull request via review without resolving the project', async () => {
      const response = await handleReview(spiedContext, {
        pjcode: 'acme',
        action: 'close',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_noproj_reviewclose',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.closePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(resolveProjectSpy).not.toHaveBeenCalled();
    });

    it('rejects a close whose pjcode is not configured without resolving the project', async () => {
      const response = await handleTriage(spiedContext, {
        pjcode: 'unconfigured',
        action: 'close',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_noproj_badpj',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.closeIssueByUrl).not.toHaveBeenCalled();
      expect(resolveProjectSpy).not.toHaveBeenCalled();
    });

    it('sets intmux without a GraphQL item fetch while resolving the project', async () => {
      const response = await handleIntmux(spiedContext, {
        pjcode: 'acme',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_needproj_intmux',
      });
      expect(response.statusCode).toBe(200);
      expect(resolveProjectSpy).toHaveBeenCalledTimes(1);
      expect(issueRepository.get).not.toHaveBeenCalled();
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({ itemId: 'PVTI_needproj_intmux' }),
        'status_intmux',
      );
    });

    it('resolves the project for set_status but performs no GraphQL item fetch', async () => {
      const response = await handleTriage(spiedContext, {
        pjcode: 'acme',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_needproj_status',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(200);
      expect(resolveProjectSpy).toHaveBeenCalledTimes(1);
      expect(issueRepository.get).not.toHaveBeenCalled();
      expect(issueRepository.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('resolves the project for set_story but performs no GraphQL item fetch', async () => {
      const response = await handleTriage(spiedContext, {
        pjcode: 'acme',
        action: 'set_story',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_needproj_story',
        storyOptionId: 'story_opt_1',
      });
      expect(response.statusCode).toBe(200);
      expect(resolveProjectSpy).toHaveBeenCalledTimes(1);
      expect(issueRepository.get).not.toHaveBeenCalled();
      expect(issueRepository.updateStory).toHaveBeenCalledTimes(1);
    });

    it('resolves the project for snooze and passes the item id without a GraphQL item fetch', async () => {
      const response = await handleTriage(spiedContext, {
        pjcode: 'acme',
        action: 'snooze_1day',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_needproj_snooze',
      });
      expect(response.statusCode).toBe(200);
      expect(resolveProjectSpy).toHaveBeenCalledTimes(1);
      expect(issueRepository.get).not.toHaveBeenCalled();
      const call = issueRepository.updateNextActionDate.mock.calls[0];
      expect(call[0]).toBe('https://github.com/o/r/issues/1');
      expect(call[1]).toBe(project);
      expect(call[2]).toBeInstanceOf(Date);
      expect(call[3]).toBe('PVTI_needproj_snooze');
    });
  });

  describe('handleIntmux', () => {
    it('sets the In Tmux by human status and records done', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'acme',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({
          itemId: 'PVTI_i',
          url: 'https://github.com/o/r/issues/1',
        }),
        'status_intmux',
      );
      expect(issueRepository.get).not.toHaveBeenCalled();
      expectRecordedOnlyIn('PVTI_i', CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES);
    });

    it('rejects an unknown intmux action', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'acme',
        action: 'unset_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(400);
    });

    it('sets intmux using the request project item id without a GraphQL item fetch', async () => {
      issueRepository.get.mockResolvedValue(null);
      const response = await handleIntmux(context, {
        pjcode: 'acme',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.get).not.toHaveBeenCalled();
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        expect.objectContaining({ itemId: 'PVTI_i' }),
        'status_intmux',
      );
    });

    it('rejects a missing issueUrl', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'acme',
        action: 'set_intmux',
        projectItemId: 'PVTI_i',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing projectItemId', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'acme',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a missing action', async () => {
      const response = await handleIntmux(context, {
        pjcode: 'acme',
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
        resolveIssueRepository: () => issueRepository,
        resolveProject: async (pjcode: string) => {
          if (pjcode === 'acme') {
            return { pjcode, project };
          }
          if (pjcode === 'globex') {
            return { pjcode, project: otherProject };
          }
          return null;
        },
        isPjcodeConfigured: (pjcode: string) =>
          pjcode === 'acme' || pjcode === 'globex',
        consoleDataOutputDir: baseDir,
        issueAttachmentRepository: null,
        resolveProjectRepository: null,
        invalidateProject: null,
        updateProjectCacheEntry: null,
        patchItemIntoQueuedTab: null,
      };
      const response = await handleTriage(multiContext, {
        pjcode: 'globex',
        action: 'set_status',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_x',
        statusName: 'Todo',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStatus).toHaveBeenCalledWith(
        otherProject,
        expect.objectContaining({ itemId: 'PVTI_x' }),
        'status_todo',
      );
      for (const tab of CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES) {
        expect(readDoneProjectItemIds(baseDir, 'globex', tab)).toContain(
          'PVTI_x',
        );
      }
      for (const tab of CONSOLE_DONE_TAB_NAMES) {
        expect(readDoneProjectItemIds(baseDir, 'acme', tab)).not.toContain(
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
        pjcode: 'acme',
        action: 'set_intmux',
        issueUrl: 'https://github.com/o/r/issues/1',
        projectItemId: 'PVTI_j',
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('handleComment', () => {
    it('posts a comment and returns the created comment from the API response', async () => {
      issueRepository.createCommentByUrl.mockResolvedValue({
        author: 'HiromiShikata',
        body: 'Please rebase onto the latest main branch.',
        createdAt: new Date('2026-06-17T09:03:27.000Z'),
      });
      const response = await handleComment(context, {
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        body: 'Please rebase onto the latest main branch.',
      });
      expect(response.statusCode).toBe(200);
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        'Please rebase onto the latest main branch.',
      );
      expect(
        issueRepository.getIssueOrPullRequestComments,
      ).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        ok: true,
        comment: {
          author: 'HiromiShikata',
          body: 'Please rebase onto the latest main branch.',
          createdAt: '2026-06-17T09:03:27.000Z',
        },
      });
    });

    it('returns comment data directly without a second fetch', async () => {
      issueRepository.createCommentByUrl.mockResolvedValue({
        author: 'github-actions',
        body: 'A first comment on this issue.',
        createdAt: new Date('2026-06-17T08:00:00.000Z'),
      });
      const response = await handleComment(context, {
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        body: 'A first comment on this issue.',
      });
      expect(response.statusCode).toBe(200);
      expect(
        issueRepository.getIssueOrPullRequestComments,
      ).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        ok: true,
        comment: {
          author: 'github-actions',
          body: 'A first comment on this issue.',
          createdAt: '2026-06-17T08:00:00.000Z',
        },
      });
    });

    it('rejects when url is missing', async () => {
      const response = await handleComment(context, {
        pjcode: 'acme',
        body: 'A comment without a target url.',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('rejects when body is missing', async () => {
      const response = await handleComment(context, {
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
      });
      expect(response.statusCode).toBe(400);
      expect(issueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });
  });

  describe('handleReviewComment', () => {
    const validRequest = {
      pjcode: 'acme',
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

  describe('handleAttachmentUpload', () => {
    const listItemUrl = 'https://github.com/o/r/issues/1';

    const writeListWithItem = (url: string): void => {
      const dir = path.join(baseDir, 'acme', 'prs');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'list.json'),
        JSON.stringify({ items: [{ url }] }),
      );
    };

    beforeEach(() => {
      writeListWithItem(listItemUrl);
    });

    const uploadContext = (
      uploadAttachment: (request: {
        issueOrPullRequestUrl: string;
        fileName: string;
        content: Uint8Array;
      }) => Promise<string>,
    ): ConsoleOperationContext => ({
      ...context,
      issueAttachmentRepository: { uploadAttachment },
    });

    it('uploads the decoded file and returns the markdown', async () => {
      const received: {
        issueOrPullRequestUrl: string;
        fileName: string;
        content: Uint8Array;
      }[] = [];
      const response = await handleAttachmentUpload(
        uploadContext(async (request) => {
          received.push(request);
          return '![shot](https://github.com/user-attachments/assets/abc)';
        }),
        {
          pjcode: 'acme',
          url: 'https://github.com/o/r/issues/1',
          fileName: 'shot.png',
          contentBase64: Buffer.from([1, 2, 3]).toString('base64'),
        },
      );
      expect(response).toEqual({
        statusCode: 200,
        body: {
          ok: true,
          markdown: '![shot](https://github.com/user-attachments/assets/abc)',
        },
      });
      expect(received).toHaveLength(1);
      expect(received[0].issueOrPullRequestUrl).toBe(
        'https://github.com/o/r/issues/1',
      );
      expect(received[0].fileName).toBe('shot.png');
      expect(Array.from(received[0].content)).toEqual([1, 2, 3]);
    });

    it('rejects a request without a url', async () => {
      const response = await handleAttachmentUpload(
        uploadContext(async () => 'unused'),
        { pjcode: 'acme', fileName: 'shot.png', contentBase64: 'AAEC' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'url is required' },
      });
    });

    it('rejects a url that is not a github issue or pull request url', async () => {
      const response = await handleAttachmentUpload(
        uploadContext(async () => 'unused'),
        {
          pjcode: 'acme',
          url: 'https://example.com/o/r/issues/1; rm -rf /',
          fileName: 'shot.png',
          contentBase64: 'AAEC',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'url must be a github issue or pull request url' },
      });
    });

    it('rejects a request without a fileName', async () => {
      const response = await handleAttachmentUpload(
        uploadContext(async () => 'unused'),
        {
          pjcode: 'acme',
          url: 'https://github.com/o/r/issues/1',
          contentBase64: 'AAEC',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'fileName is required' },
      });
    });

    it('rejects a request without contentBase64', async () => {
      const response = await handleAttachmentUpload(
        uploadContext(async () => 'unused'),
        {
          pjcode: 'acme',
          url: 'https://github.com/o/r/issues/1',
          fileName: 'shot.png',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'contentBase64 is required' },
      });
    });

    it('reports that upload is not configured when no repository is wired', async () => {
      const response = await handleAttachmentUpload(
        { ...context, issueAttachmentRepository: null },
        {
          pjcode: 'acme',
          url: 'https://github.com/o/r/issues/1',
          fileName: 'shot.png',
          contentBase64: 'AAEC',
        },
      );
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'attachment upload is not configured' },
      });
    });

    it('rejects a url that is not listed as a console item of the project', async () => {
      const response = await handleAttachmentUpload(
        uploadContext(async () => 'unused'),
        {
          pjcode: 'acme',
          url: 'https://github.com/o/r/issues/9999',
          fileName: 'shot.png',
          contentBase64: 'AAEC',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'url is not a console item of this project' },
      });
    });
  });

  describe('handleCreateIssue', () => {
    const projectWithStory = (): Project => ({
      ...project,
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          {
            id: 'opt_blue',
            name: 'Portal redesign',
            color: 'BLUE',
            description: '',
          },
          {
            id: 'opt_green',
            name: 'Move to Okinawa',
            color: 'GREEN',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    });

    beforeEach(() => {
      issueRepository.createNewIssue.mockResolvedValue(42);
      issueRepository.addIssueToProject.mockResolvedValue(undefined);
    });

    it('creates the issue, adds it to the project, and sets the story', async () => {
      const storyProject = projectWithStory();
      const createdIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/portal/issues/42',
        itemId: 'PVTI_new',
      };
      issueRepository.get.mockResolvedValue(createdIssue);

      const response = await handleCreateIssue(
        contextForProject(storyProject),
        {
          pjcode: 'acme',
          title: 'New task title',
          storyOptionId: 'opt_blue',
          nameWithOwner: 'acme-labs/portal',
        },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        issueUrl: 'https://github.com/acme-labs/portal/issues/42',
      });
      expect(issueRepository.createNewIssue).toHaveBeenCalledWith(
        'acme-labs',
        'portal',
        'New task title',
        '',
        [],
        [],
      );
      expect(issueRepository.addIssueToProject).toHaveBeenCalledWith(
        storyProject,
        'https://github.com/acme-labs/portal/issues/42',
      );
      expect(issueRepository.updateStory).toHaveBeenCalledWith(
        expect.objectContaining({ story: storyProject.story }),
        createdIssue,
        'opt_blue',
      );
    });

    it('resolves the issue repository from a proxy url of the target repo', async () => {
      const resolvedUrls: string[] = [];
      const recordingContext: ConsoleOperationContext = {
        ...contextForProject(projectWithStory()),
        resolveIssueRepository: (url: string) => {
          resolvedUrls.push(url);
          return issueRepository;
        },
      };
      issueRepository.get.mockResolvedValue(null);

      await handleCreateIssue(recordingContext, {
        pjcode: 'acme',
        title: 'Task',
        storyOptionId: 'opt_blue',
        nameWithOwner: 'acme-labs/portal',
      });

      expect(resolvedUrls).toContain(
        'https://github.com/acme-labs/portal/issues/0',
      );
    });

    it('skips updateStory when get returns null after addIssueToProject', async () => {
      issueRepository.get.mockResolvedValue(null);

      const response = await handleCreateIssue(
        contextForProject(projectWithStory()),
        {
          pjcode: 'acme',
          title: 'Task without project item',
          storyOptionId: 'opt_green',
          nameWithOwner: 'acme-labs/portal',
        },
      );

      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('rejects when title is missing', async () => {
      const response = await handleCreateIssue(context, {
        pjcode: 'acme',
        storyOptionId: 'opt_blue',
        nameWithOwner: 'acme-labs/portal',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'title is required' },
      });
    });

    it('rejects when storyOptionId is missing', async () => {
      const response = await handleCreateIssue(context, {
        pjcode: 'acme',
        title: 'Task',
        nameWithOwner: 'acme-labs/portal',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'storyOptionId is required' },
      });
    });

    it('rejects when nameWithOwner is missing', async () => {
      const response = await handleCreateIssue(context, {
        pjcode: 'acme',
        title: 'Task',
        storyOptionId: 'opt_blue',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'nameWithOwner is required' },
      });
    });

    it('rejects when nameWithOwner has no slash', async () => {
      const response = await handleCreateIssue(context, {
        pjcode: 'acme',
        title: 'Task',
        storyOptionId: 'opt_blue',
        nameWithOwner: 'noslash',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'nameWithOwner must be in owner/repo format' },
      });
    });

    it('rejects when pjcode is not configured', async () => {
      const response = await handleCreateIssue(context, {
        pjcode: 'unknown',
        title: 'Task',
        storyOptionId: 'opt_blue',
        nameWithOwner: 'acme-labs/portal',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'no project configured for pjcode "unknown"' },
      });
    });

    it('rejects when the project has no story field', async () => {
      const projectWithoutStory: Project = { ...project, story: null };

      const response = await handleCreateIssue(
        contextForProject(projectWithoutStory),
        {
          pjcode: 'acme',
          title: 'Task',
          storyOptionId: 'opt_blue',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'project does not have a story field' },
      });
    });

    it('rejects when the storyOptionId is not found in the project', async () => {
      const response = await handleCreateIssue(
        contextForProject(projectWithStory()),
        {
          pjcode: 'acme',
          title: 'Task',
          storyOptionId: 'nonexistent',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'story option "nonexistent" not found in project' },
      });
    });
  });

  describe('handleReorderStory', () => {
    const projectWithOrderedStories = (): Project => ({
      ...project,
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          { id: 'opt_a', name: 'Alpha', color: 'BLUE', description: '' },
          { id: 'opt_b', name: 'Beta', color: 'GREEN', description: '' },
          { id: 'opt_c', name: 'Gamma', color: 'RED', description: '' },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    });

    const contextWithProjectRepository = (
      resolveProjectRepository: ConsoleOperationContext['resolveProjectRepository'],
      baseProject: Project = projectWithOrderedStories(),
    ): ConsoleOperationContext => ({
      ...contextForProject(baseProject),
      resolveProjectRepository,
    });

    it('returns 400 when pjcode is missing', async () => {
      const response = await handleReorderStory(context, {
        storyOptionId: 'opt_b',
        direction: 'up',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'pjcode is required' },
      });
    });

    it('returns 400 when storyOptionId is missing', async () => {
      const response = await handleReorderStory(context, {
        pjcode: 'acme',
        direction: 'up',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'storyOptionId is required' },
      });
    });

    it('returns 400 when direction is not "up" or "down"', async () => {
      const response = await handleReorderStory(context, {
        pjcode: 'acme',
        storyOptionId: 'opt_b',
        direction: 'left',
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'direction must be "up" or "down"' },
      });
    });

    it('returns 502 when resolveProjectRepository is null', async () => {
      const response = await handleReorderStory(
        contextWithProjectRepository(null),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_b',
          direction: 'up',
        },
      );
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'project repository is not configured' },
      });
    });

    it('returns 400 when project is not found', async () => {
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const response = await handleReorderStory(
        contextWithProjectRepository(() => ({
          updateStoryList,
          getProject: jest.fn(),
        })),
        {
          pjcode: 'unknown',
          storyOptionId: 'opt_b',
          direction: 'up',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'no project configured for pjcode "unknown"' },
      });
    });

    it('returns 400 when story option is not found', async () => {
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const response = await handleReorderStory(
        contextWithProjectRepository(() => ({
          updateStoryList,
          getProject: jest.fn(),
        })),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_nonexistent',
          direction: 'up',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'story option not found' },
      });
    });

    it('returns 400 when direction is "up" and the option is already first', async () => {
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const response = await handleReorderStory(
        contextWithProjectRepository(() => ({
          updateStoryList,
          getProject: jest.fn(),
        })),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_a',
          direction: 'up',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'cannot move in that direction' },
      });
    });

    it('returns 400 when direction is "down" and the option is already last', async () => {
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const response = await handleReorderStory(
        contextWithProjectRepository(() => ({
          updateStoryList,
          getProject: jest.fn(),
        })),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_c',
          direction: 'down',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'cannot move in that direction' },
      });
    });

    it('swaps the target option with its neighbor, calls resolveProjectRepository updateStoryList with reordered list, and returns 200', async () => {
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const getProject = jest
        .fn()
        .mockResolvedValue(projectWithOrderedStories());
      const resolveProjectRepository = jest.fn(() => ({
        updateStoryList,
        getProject,
      }));
      const response = await handleReorderStory(
        contextWithProjectRepository(resolveProjectRepository),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_b',
          direction: 'up',
        },
      );
      expect(response).toEqual({ statusCode: 200, body: { ok: true } });
      expect(resolveProjectRepository).toHaveBeenCalledWith(
        projectWithOrderedStories().url,
      );
      expect(updateStoryList).toHaveBeenCalledTimes(1);
      expect(updateStoryList).toHaveBeenCalledWith(
        expect.objectContaining({ id: projectWithOrderedStories().id }),
        [
          expect.objectContaining({ id: 'opt_b' }),
          expect.objectContaining({ id: 'opt_a' }),
          expect.objectContaining({ id: 'opt_c' }),
        ],
      );
    });

    it('calls invalidateProject with pjcode after successful reorder', async () => {
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const getProject = jest
        .fn()
        .mockResolvedValue(projectWithOrderedStories());
      const invalidateProject = jest.fn();
      const response = await handleReorderStory(
        {
          ...contextWithProjectRepository(() => ({
            updateStoryList,
            getProject,
          })),
          invalidateProject,
        },
        {
          pjcode: 'acme',
          storyOptionId: 'opt_b',
          direction: 'up',
        },
      );
      expect(response).toEqual({ statusCode: 200, body: { ok: true } });
      expect(invalidateProject).toHaveBeenCalledWith('acme');
    });

    it('returns 400 when project does not have a story field', async () => {
      const projectWithoutStory = {
        ...projectWithOrderedStories(),
        story: null,
      };
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const response = await handleReorderStory(
        contextWithProjectRepository(
          () => ({ updateStoryList, getProject: jest.fn() }),
          projectWithoutStory,
        ),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_b',
          direction: 'up',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'project does not have a story field' },
      });
    });

    it('passes the full story list including GRAY options to resolveProjectRepository updateStoryList', async () => {
      const projectWithGray = {
        ...projectWithOrderedStories(),
        story: {
          name: 'Story',
          fieldId: 'storyField',
          databaseId: 1,
          stories: [
            {
              id: 'opt_a',
              name: 'Alpha',
              color: 'BLUE' as const,
              description: '',
            },
            {
              id: 'opt_gray',
              name: 'Archived',
              color: 'GRAY' as const,
              description: '',
            },
            {
              id: 'opt_b',
              name: 'Beta',
              color: 'GREEN' as const,
              description: '',
            },
          ],
          workflowManagementStory: { id: 'wms', name: 'workflow' },
        },
      };
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const getProject = jest.fn().mockResolvedValue(projectWithGray);
      const response = await handleReorderStory(
        contextWithProjectRepository(
          () => ({ updateStoryList, getProject }),
          projectWithGray,
        ),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_b',
          direction: 'up',
        },
      );
      expect(response).toEqual({ statusCode: 200, body: { ok: true } });
      expect(updateStoryList).toHaveBeenCalledWith(
        expect.objectContaining({ id: projectWithGray.id }),
        [
          expect.objectContaining({ id: 'opt_a' }),
          expect.objectContaining({ id: 'opt_b' }),
          expect.objectContaining({ id: 'opt_gray' }),
        ],
      );
    });

    it('includes story options added server-side after cache was populated in the reordered list', async () => {
      const cachedProject = projectWithOrderedStories();
      const cachedStory = cachedProject.story;
      if (cachedStory === null) throw new Error('cachedStory must not be null');
      const serverFreshProject: Project = {
        ...cachedProject,
        story: {
          ...cachedStory,
          stories: [
            ...cachedStory.stories,
            {
              id: 'opt_server_only',
              name: 'Server only',
              color: 'PURPLE' as const,
              description: '',
            },
          ],
        },
      };
      const localUpdateStoryList = jest.fn().mockResolvedValue([]);
      const localGetProject = jest.fn().mockResolvedValue(serverFreshProject);
      const response = await handleReorderStory(
        contextWithProjectRepository(() => ({
          updateStoryList: localUpdateStoryList,
          getProject: localGetProject,
        })),
        { pjcode: 'acme', storyOptionId: 'opt_b', direction: 'up' },
      );
      expect(response.statusCode).toBe(200);
      expect(localUpdateStoryList).toHaveBeenCalledWith(expect.anything(), [
        { id: 'opt_b', name: 'Beta', color: 'GREEN', description: '' },
        { id: 'opt_a', name: 'Alpha', color: 'BLUE', description: '' },
        { id: 'opt_c', name: 'Gamma', color: 'RED', description: '' },
        {
          id: 'opt_server_only',
          name: 'Server only',
          color: 'PURPLE',
          description: '',
        },
      ]);
    });

    it('returns 400 when the target option is at a boundary in fresh data even though cached data allowed the move', async () => {
      const cachedProject = projectWithOrderedStories();
      const cachedStory = cachedProject.story;
      if (cachedStory === null) throw new Error('cachedStory must not be null');
      const freshProject: Project = {
        ...cachedProject,
        story: {
          ...cachedStory,
          stories: cachedStory.stories.filter((s) => s.id !== 'opt_a'),
        },
      };
      const localUpdateStoryList = jest.fn().mockResolvedValue([]);
      const response = await handleReorderStory(
        contextWithProjectRepository(() => ({
          updateStoryList: localUpdateStoryList,
          getProject: jest.fn().mockResolvedValue(freshProject),
        })),
        { pjcode: 'acme', storyOptionId: 'opt_b', direction: 'up' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'cannot move in that direction' },
      });
      expect(localUpdateStoryList).not.toHaveBeenCalled();
    });

    it('returns 400 when fresh data places the target at a boundary where it cannot move in the requested direction', async () => {
      const cachedProject = projectWithOrderedStories();
      const cachedStory = cachedProject.story;
      if (cachedStory === null) throw new Error('cachedStory must not be null');
      const freshProject: Project = {
        ...cachedProject,
        story: {
          ...cachedStory,
          stories: [
            {
              id: 'opt_b',
              name: 'Beta',
              color: 'GREEN' as const,
              description: '',
            },
            {
              id: 'opt_c',
              name: 'Gamma',
              color: 'RED' as const,
              description: '',
            },
          ],
        },
      };
      const updateStoryList = jest.fn().mockResolvedValue([]);
      const getProject = jest.fn().mockResolvedValue(freshProject);
      const response = await handleReorderStory(
        contextWithProjectRepository(() => ({ updateStoryList, getProject })),
        { pjcode: 'acme', storyOptionId: 'opt_b', direction: 'up' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'cannot move in that direction' },
      });
      expect(updateStoryList).not.toHaveBeenCalled();
    });
  });

  describe('handleStoryAdd', () => {
    const buildProjectWithStories = (): Project => ({
      ...project,
      url: 'https://github.com/orgs/acme-labs/projects/1',
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          {
            id: 'opt_first',
            name: 'First story',
            color: 'BLUE',
            description: '',
          },
          {
            id: 'opt_second',
            name: 'Second story',
            color: 'GREEN',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    });

    const updateStoryList = jest.fn();
    const getProject = jest.fn();
    const projectRepositoryResolver = jest.fn(() => ({
      updateStoryList,
      getProject,
    }));

    const addStoryContext = (p: Project): ConsoleOperationContext => ({
      ...contextForProject(p),
      resolveProjectRepository: projectRepositoryResolver,
    });

    beforeEach(() => {
      updateStoryList.mockResolvedValue([]);
      getProject.mockResolvedValue(buildProjectWithStories());
      projectRepositoryResolver.mockReturnValue({
        updateStoryList,
        getProject,
      });
    });

    it('inserts the new story at index 1 and calls updateStoryList', async () => {
      const p = buildProjectWithStories();
      const response = await handleStoryAdd(addStoryContext(p), {
        pjcode: 'acme',
        storyName: 'Brand new story',
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(updateStoryList).toHaveBeenCalledWith(p, [
        {
          id: 'opt_first',
          name: 'First story',
          color: 'BLUE',
          description: '',
        },
        { id: null, name: 'Brand new story', color: 'RED', description: '' },
        {
          id: 'opt_second',
          name: 'Second story',
          color: 'GREEN',
          description: '',
        },
      ]);
    });

    it('inserts the new story as the only entry when the story list is empty', async () => {
      const emptyStoryProject: Project = {
        ...buildProjectWithStories(),
        story: {
          name: 'Story',
          fieldId: 'storyField',
          databaseId: 1,
          stories: [],
          workflowManagementStory: { id: 'wms', name: 'workflow' },
        },
      };
      getProject.mockResolvedValue(emptyStoryProject);
      const response = await handleStoryAdd(
        addStoryContext(emptyStoryProject),
        {
          pjcode: 'acme',
          storyName: 'First ever story',
        },
      );
      expect(response.statusCode).toBe(200);
      expect(updateStoryList).toHaveBeenCalledWith(emptyStoryProject, [
        { id: null, name: 'First ever story', color: 'RED', description: '' },
      ]);
    });

    it('resolves the project repository using the project url', async () => {
      const p = buildProjectWithStories();
      await handleStoryAdd(addStoryContext(p), {
        pjcode: 'acme',
        storyName: 'Any story',
      });
      expect(projectRepositoryResolver).toHaveBeenCalledWith(p.url);
    });

    it('returns 502 when resolveProjectRepository is null', async () => {
      const response = await handleStoryAdd(
        {
          ...contextForProject(buildProjectWithStories()),
          resolveProjectRepository: null,
        },
        { pjcode: 'acme', storyName: 'Any story' },
      );
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'project repository is not configured' },
      });
    });

    it('rejects when storyName is missing', async () => {
      const response = await handleStoryAdd(
        addStoryContext(buildProjectWithStories()),
        {
          pjcode: 'acme',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'storyName is required' },
      });
    });

    it('rejects when pjcode is not configured', async () => {
      const response = await handleStoryAdd(
        addStoryContext(buildProjectWithStories()),
        {
          pjcode: 'unknown',
          storyName: 'Any story',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'no project configured for pjcode "unknown"' },
      });
    });

    it('rejects when the project has no story field', async () => {
      const projectWithoutStory: Project = {
        ...buildProjectWithStories(),
        story: null,
      };
      const response = await handleStoryAdd(
        addStoryContext(projectWithoutStory),
        {
          pjcode: 'acme',
          storyName: 'Any story',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'project does not have a story field' },
      });
    });

    it('invalidates the project cache after each successful add so consecutive adds both survive', async () => {
      const p = buildProjectWithStories();
      const pStory = p.story;
      if (pStory === null) {
        throw new Error('buildProjectWithStories must return a non-null story');
      }

      const projectAfterFirstAdd: Project = {
        ...p,
        story: {
          ...pStory,
          stories: [
            pStory.stories[0],
            { id: 'opt_x', name: 'Story X', color: 'RED', description: '' },
            ...pStory.stories.slice(1),
          ],
        },
      };

      let invalidateCalled = false;
      const invalidateProject = jest.fn((_pjcode: string) => {
        invalidateCalled = true;
      });

      const resolveProject = jest.fn(async (pjcode: string) => {
        if (pjcode !== 'acme') return null;
        return { pjcode, project: invalidateCalled ? projectAfterFirstAdd : p };
      });

      const consecutiveUpdateStoryList = jest.fn().mockResolvedValue([]);
      const consecutiveGetProject = jest.fn(async () => {
        return invalidateCalled ? projectAfterFirstAdd : p;
      });
      const consecutiveContext: ConsoleOperationContext = {
        resolveIssueRepository: () => issueRepository,
        resolveProject,
        isPjcodeConfigured: (pjcode: string) => pjcode === 'acme',
        consoleDataOutputDir: baseDir,
        issueAttachmentRepository: null,
        resolveProjectRepository: jest.fn(() => ({
          updateStoryList: consecutiveUpdateStoryList,
          getProject: consecutiveGetProject,
        })),
        invalidateProject,
        updateProjectCacheEntry: null,
        patchItemIntoQueuedTab: null,
      };

      await handleStoryAdd(consecutiveContext, {
        pjcode: 'acme',
        storyName: 'Story X',
      });
      await handleStoryAdd(consecutiveContext, {
        pjcode: 'acme',
        storyName: 'Story Y',
      });

      expect(invalidateProject).toHaveBeenCalledTimes(2);
      expect(invalidateProject).toHaveBeenCalledWith('acme');
      expect(consecutiveUpdateStoryList).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ name: 'Story X' }),
          expect.objectContaining({ name: 'Story Y' }),
        ]),
      );
    });

    it('includes story options added server-side after cache was populated when adding a story', async () => {
      const cachedProject = buildProjectWithStories();
      const cachedStory = cachedProject.story;
      if (cachedStory === null) throw new Error('cachedStory must not be null');
      const serverFreshProject: Project = {
        ...cachedProject,
        story: {
          ...cachedStory,
          stories: [
            ...cachedStory.stories,
            {
              id: 'opt_server_only',
              name: 'Server only story',
              color: 'PURPLE' as const,
              description: '',
            },
          ],
        },
      };
      const localUpdateStoryList = jest.fn().mockResolvedValue([]);
      const localGetProject = jest.fn().mockResolvedValue(serverFreshProject);
      const ctx: ConsoleOperationContext = {
        ...addStoryContext(cachedProject),
        resolveProjectRepository: () => ({
          updateStoryList: localUpdateStoryList,
          getProject: localGetProject,
        }),
      };
      await handleStoryAdd(ctx, { pjcode: 'acme', storyName: 'New story' });
      expect(localUpdateStoryList).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ id: 'opt_server_only' }),
          expect.objectContaining({ name: 'New story' }),
        ]),
      );
    });
  });

  describe('handleStoryColor', () => {
    const projectWithStory = (): Project => ({
      ...project,
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          {
            id: 'opt_blue',
            name: 'Portal redesign',
            color: 'BLUE',
            description: '',
          },
          {
            id: 'opt_green',
            name: 'Move to Okinawa',
            color: 'GREEN',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    });

    beforeEach(() => {
      issueRepository.updateStoryOptionColor.mockResolvedValue(undefined);
    });

    it('returns 502 when resolveProjectRepository is null', async () => {
      const response = await handleStoryColor(
        contextForProject(projectWithStory()),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_blue',
          newColor: 'RED',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'project repository is not configured' },
      });
    });

    it('calls updateStoryOptionColor with the correct project, storyOptionId, and newColor', async () => {
      const storyProject = projectWithStory();
      const response = await handleStoryColor(
        {
          ...contextForProject(storyProject),
          resolveProjectRepository: () => ({
            updateStoryList: jest.fn().mockResolvedValue([]),
            getProject: jest.fn().mockResolvedValue(storyProject),
          }),
        },
        {
          pjcode: 'acme',
          storyOptionId: 'opt_blue',
          newColor: 'RED',
          nameWithOwner: 'acme-labs/portal',
        },
      );

      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateStoryOptionColor).toHaveBeenCalledWith(
        expect.objectContaining({ story: storyProject.story }),
        'opt_blue',
        'RED',
      );
    });

    it('resolves the issue repository from a proxy url of the target repo', async () => {
      const storyProject = projectWithStory();
      const resolvedUrls: string[] = [];
      const recordingContext: ConsoleOperationContext = {
        ...contextForProject(storyProject),
        resolveProjectRepository: () => ({
          updateStoryList: jest.fn().mockResolvedValue([]),
          getProject: jest.fn().mockResolvedValue(storyProject),
        }),
        resolveIssueRepository: (url: string) => {
          resolvedUrls.push(url);
          return issueRepository;
        },
      };

      await handleStoryColor(recordingContext, {
        pjcode: 'acme',
        storyOptionId: 'opt_blue',
        newColor: 'GREEN',
        nameWithOwner: 'acme-labs/portal',
      });

      expect(resolvedUrls).toContain(
        'https://github.com/acme-labs/portal/issues/0',
      );
    });

    it('rejects when storyOptionId is missing', async () => {
      const response = await handleStoryColor(
        contextForProject(projectWithStory()),
        {
          pjcode: 'acme',
          newColor: 'RED',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'storyOptionId is required' },
      });
    });

    it('rejects when newColor is not a valid ConsoleColor', async () => {
      const response = await handleStoryColor(
        contextForProject(projectWithStory()),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_blue',
          newColor: 'MAGENTA',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: {
          error:
            'newColor must be one of GRAY, BLUE, GREEN, YELLOW, ORANGE, RED, PINK, PURPLE',
        },
      });
    });

    it('rejects when nameWithOwner is missing', async () => {
      const response = await handleStoryColor(
        contextForProject(projectWithStory()),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_blue',
          newColor: 'RED',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'nameWithOwner is required' },
      });
    });

    it('rejects when the project has no story field', async () => {
      const projectWithoutStory: Project = { ...project, story: null };

      const response = await handleStoryColor(
        contextForProject(projectWithoutStory),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_blue',
          newColor: 'RED',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'project does not have a story field' },
      });
    });

    it('rejects when storyOptionId is not found in project.story.stories', async () => {
      const response = await handleStoryColor(
        contextForProject(projectWithStory()),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_nonexistent',
          newColor: 'RED',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'story option "opt_nonexistent" not found in project' },
      });
      expect(issueRepository.updateStoryOptionColor).not.toHaveBeenCalled();
    });

    it('calls updateProjectCacheEntry with the updated project after a successful color change', async () => {
      const storyProject = projectWithStory();
      const updatedEntries: { pjcode: string; project: Project }[] = [];
      const contextWithCache: ConsoleOperationContext = {
        ...contextForProject(storyProject),
        resolveProjectRepository: () => ({
          updateStoryList: jest.fn().mockResolvedValue([]),
          getProject: jest.fn().mockResolvedValue(storyProject),
        }),
        updateProjectCacheEntry: (pjcode, updatedProject) => {
          updatedEntries.push({ pjcode, project: updatedProject });
        },
      };

      await handleStoryColor(contextWithCache, {
        pjcode: 'acme',
        storyOptionId: 'opt_blue',
        newColor: 'RED',
        nameWithOwner: 'acme-labs/portal',
      });

      expect(updatedEntries).toHaveLength(1);
      expect(updatedEntries[0].pjcode).toBe('acme');
      expect(updatedEntries[0].project.story?.stories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'opt_blue', color: 'RED' }),
          expect.objectContaining({ id: 'opt_green', color: 'GREEN' }),
        ]),
      );
    });

    it('does not call updateProjectCacheEntry when updateProjectCacheEntry is null', async () => {
      const storyProject = projectWithStory();
      const response = await handleStoryColor(
        {
          ...contextForProject(storyProject),
          resolveProjectRepository: () => ({
            updateStoryList: jest.fn().mockResolvedValue([]),
            getProject: jest.fn().mockResolvedValue(storyProject),
          }),
        },
        {
          pjcode: 'acme',
          storyOptionId: 'opt_blue',
          newColor: 'RED',
          nameWithOwner: 'acme-labs/portal',
        },
      );
      expect(response.statusCode).toBe(200);
    });

    it('includes story options added server-side after cache was populated when changing a color', async () => {
      const cachedProject = projectWithStory();
      const cachedStory = cachedProject.story;
      if (cachedStory === null) throw new Error('cachedStory must not be null');
      const serverFreshProject: Project = {
        ...cachedProject,
        story: {
          ...cachedStory,
          stories: [
            ...cachedStory.stories,
            {
              id: 'opt_server_only',
              name: 'Server only story',
              color: 'PURPLE' as const,
              description: '',
            },
          ],
        },
      };
      const localGetProject = jest.fn().mockResolvedValue(serverFreshProject);
      const ctx: ConsoleOperationContext = {
        ...contextForProject(cachedProject),
        resolveProjectRepository: () => ({
          updateStoryList: jest.fn().mockResolvedValue([]),
          getProject: localGetProject,
        }),
      };
      await handleStoryColor(ctx, {
        pjcode: 'acme',
        storyOptionId: 'opt_blue',
        newColor: 'RED',
        nameWithOwner: 'acme-labs/portal',
      });
      const [projectArg] = issueRepository.updateStoryOptionColor.mock.calls[0];
      expect(
        projectArg.story.stories.find(
          (s: { id: string }) => s.id === 'opt_server_only',
        ),
      ).toBeDefined();
    });
  });

  describe('handleDeleteAllComments', () => {
    it('deletes all comments for the given issue url and returns 200', async () => {
      issueRepository.deleteAllCommentsByUrl.mockResolvedValue(undefined);
      const response = await handleDeleteAllComments(context, {
        issueUrl: 'https://github.com/o/r/issues/1',
      });
      expect(issueRepository.deleteAllCommentsByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(200);
    });

    it('returns 400 when issueUrl is missing', async () => {
      const response = await handleDeleteAllComments(context, {});
      expect(response.statusCode).toBe(400);
    });

    it('propagates an error from deleteAllCommentsByUrl (resulting in 502 from webServer)', async () => {
      issueRepository.deleteAllCommentsByUrl.mockRejectedValue(
        new Error('API failure'),
      );
      await expect(
        handleDeleteAllComments(context, {
          issueUrl: 'https://github.com/o/r/issues/1',
        }),
      ).rejects.toThrow('API failure');
    });
  });

  describe('handleSetDependedIssueUrl', () => {
    const projectWithDependedField = (): Project => ({
      ...project,
      dependedIssueUrlSeparatedByComma: {
        name: 'Depended Issue URL',
        fieldId: 'dependedField',
      },
    });

    it('sets the depended issue URL and returns 200', async () => {
      issueRepository.setDependedIssueUrl.mockResolvedValue(undefined);
      const response = await handleSetDependedIssueUrl(
        contextForProject(projectWithDependedField()),
        {
          pjcode: 'acme',
          issueUrl: 'https://github.com/o/r/issues/1',
          dependedIssueUrl: 'https://github.com/o/r/issues/2',
        },
      );
      expect(issueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        projectWithDependedField(),
        'https://github.com/o/r/issues/2',
      );
      expect(response.statusCode).toBe(200);
    });

    it('returns 400 when issueUrl is missing', async () => {
      const response = await handleSetDependedIssueUrl(
        contextForProject(projectWithDependedField()),
        { pjcode: 'acme', dependedIssueUrl: 'https://github.com/o/r/issues/2' },
      );
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when dependedIssueUrl is missing', async () => {
      const response = await handleSetDependedIssueUrl(
        contextForProject(projectWithDependedField()),
        { pjcode: 'acme', issueUrl: 'https://github.com/o/r/issues/1' },
      );
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when pjcode is missing', async () => {
      const response = await handleSetDependedIssueUrl(
        contextForProject(projectWithDependedField()),
        {
          issueUrl: 'https://github.com/o/r/issues/1',
          dependedIssueUrl: 'https://github.com/o/r/issues/2',
        },
      );
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when project does not have dependedIssueUrlSeparatedByComma configured', async () => {
      const response = await handleSetDependedIssueUrl(
        contextForProject({
          ...project,
          dependedIssueUrlSeparatedByComma: null,
        }),
        {
          pjcode: 'acme',
          issueUrl: 'https://github.com/o/r/issues/1',
          dependedIssueUrl: 'https://github.com/o/r/issues/2',
        },
      );
      expect(response.statusCode).toBe(400);
    });

    it('propagates an error from setDependedIssueUrl (resulting in 502 from webServer)', async () => {
      issueRepository.setDependedIssueUrl.mockRejectedValue(
        new Error('API failure'),
      );
      await expect(
        handleSetDependedIssueUrl(
          contextForProject(projectWithDependedField()),
          {
            pjcode: 'acme',
            issueUrl: 'https://github.com/o/r/issues/1',
            dependedIssueUrl: 'https://github.com/o/r/issues/2',
          },
        ),
      ).rejects.toThrow('API failure');
    });
  });

  describe('handleDeleteStory', () => {
    const projectWithStoriesToDelete = (): Project => ({
      ...project,
      url: 'https://github.com/orgs/acme-labs/projects/1',
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          {
            id: 'opt_keep',
            name: 'Keep this story',
            color: 'BLUE',
            description: '',
          },
          {
            id: 'opt_remove',
            name: 'Remove this story',
            color: 'GREEN',
            description: '',
          },
          {
            id: 'opt_also_keep',
            name: 'Also keep',
            color: 'RED',
            description: '',
          },
          {
            id: 'wms',
            name: 'workflow',
            color: 'BLUE',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    });

    const updateStoryList = jest.fn();
    const getProject = jest.fn();
    const projectRepositoryResolver = jest.fn(() => ({
      updateStoryList,
      getProject,
    }));

    const deleteStoryContext = (p: Project): ConsoleOperationContext => ({
      ...contextForProject(p),
      resolveProjectRepository: projectRepositoryResolver,
    });

    beforeEach(() => {
      updateStoryList.mockResolvedValue([]);
      getProject.mockResolvedValue(projectWithStoriesToDelete());
      projectRepositoryResolver.mockReturnValue({
        updateStoryList,
        getProject,
      });
      issueRepository.getStoryObjectMap.mockResolvedValue(new Map());
      issueRepository.closeIssueByUrl.mockResolvedValue(undefined);
    });

    it('calls updateStoryList with the filtered list and returns 200', async () => {
      const p = projectWithStoriesToDelete();
      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(updateStoryList).toHaveBeenCalledWith(p, [
        {
          id: 'opt_keep',
          name: 'Keep this story',
          color: 'BLUE',
          description: '',
        },
        {
          id: 'opt_also_keep',
          name: 'Also keep',
          color: 'RED',
          description: '',
        },
        {
          id: 'wms',
          name: 'workflow',
          color: 'BLUE',
          description: '',
        },
      ]);
    });

    it('resolves the project repository using the project url', async () => {
      const p = projectWithStoriesToDelete();
      await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });
      expect(projectRepositoryResolver).toHaveBeenCalledWith(p.url);
    });

    it('calls invalidateProject after a successful delete', async () => {
      const p = projectWithStoriesToDelete();
      const invalidateProject = jest.fn();
      const ctx: ConsoleOperationContext = {
        ...deleteStoryContext(p),
        invalidateProject,
      };
      await handleDeleteStory(ctx, {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });
      expect(invalidateProject).toHaveBeenCalledWith('acme');
    });

    it('returns 502 when resolveProjectRepository is null', async () => {
      const response = await handleDeleteStory(
        contextForProject(projectWithStoriesToDelete()),
        { pjcode: 'acme', storyOptionId: 'opt_remove' },
      );
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'project repository is not configured' },
      });
    });

    it('returns 400 when storyOptionId is missing', async () => {
      const response = await handleDeleteStory(
        deleteStoryContext(projectWithStoriesToDelete()),
        { pjcode: 'acme' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'storyOptionId is required' },
      });
    });

    it('returns 400 when pjcode is not configured', async () => {
      const response = await handleDeleteStory(
        deleteStoryContext(projectWithStoriesToDelete()),
        { pjcode: 'unknown', storyOptionId: 'opt_remove' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'no project configured for pjcode "unknown"' },
      });
    });

    it('returns 400 when the project has no story field', async () => {
      const projectWithoutStory: Project = {
        ...projectWithStoriesToDelete(),
        story: null,
      };
      const response = await handleDeleteStory(
        deleteStoryContext(projectWithoutStory),
        { pjcode: 'acme', storyOptionId: 'opt_remove' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'project does not have a story field' },
      });
    });

    it('returns 400 when the story option is not found', async () => {
      const response = await handleDeleteStory(
        deleteStoryContext(projectWithStoriesToDelete()),
        { pjcode: 'acme', storyOptionId: 'opt_nonexistent' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'story option "opt_nonexistent" not found in project' },
      });
    });

    it('returns 400 when attempting to delete the workflow management story', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const wmsId = story.workflowManagementStory.id;
      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: wmsId,
      });
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'cannot delete the workflow management story' },
      });
    });

    it('closes the story issue when one exists in the project', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRemove = story.stories.find((s) => s.id === 'opt_remove');
      if (storyToRemove === undefined)
        throw new Error('test fixture must have opt_remove story');
      const storyIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/ops/issues/42',
        title: 'Remove this story',
      };
      const storyObjectMap: StoryObjectMap = new Map([
        [storyToRemove.name, { story: storyToRemove, storyIssue, issues: [] }],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });

      expect(response.statusCode).toBe(200);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/acme-labs/ops/issues/42',
        'completed',
      );
    });

    it('does not call closeIssueByUrl when the story has no associated issue', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRemove = story.stories.find((s) => s.id === 'opt_remove');
      if (storyToRemove === undefined)
        throw new Error('test fixture must have opt_remove story');
      const storyObjectMap: StoryObjectMap = new Map([
        [
          storyToRemove.name,
          { story: storyToRemove, storyIssue: null, issues: [] },
        ],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });

      expect(issueRepository.closeIssueByUrl).not.toHaveBeenCalled();
    });

    it('returns 502 when the project URL has no extractable owner', async () => {
      const p: Project = {
        ...projectWithStoriesToDelete(),
        url: 'https://example.com/invalid/project/url',
      };
      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'cannot determine project owner from project URL' },
      });
    });

    it('returns 200 even when closeIssueByUrl throws after story deletion', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRemove = story.stories.find((s) => s.id === 'opt_remove');
      if (storyToRemove === undefined)
        throw new Error('test fixture must have opt_remove story');
      const storyIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/ops/issues/42',
        title: 'Remove this story',
      };
      issueRepository.getStoryObjectMap.mockResolvedValue(
        new Map([
          [
            storyToRemove.name,
            { story: storyToRemove, storyIssue, issues: [] },
          ],
        ]),
      );
      issueRepository.closeIssueByUrl.mockRejectedValue(
        new Error('network error'),
      );

      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });

      expect(response.statusCode).toBe(200);
    });

    it('closes open tasks assigned to the story when the story is deleted', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRemove = story.stories.find((s) => s.id === 'opt_remove');
      if (storyToRemove === undefined)
        throw new Error('test fixture must have opt_remove story');
      const openTask: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/ops/issues/100',
        isClosed: false,
        isPr: false,
      };
      const storyObjectMap: StoryObjectMap = new Map([
        [
          storyToRemove.name,
          { story: storyToRemove, storyIssue: null, issues: [openTask] },
        ],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });

      expect(response.statusCode).toBe(200);
      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/acme-labs/ops/issues/100',
        'not_planned',
      );
    });

    it('does not close tasks that are already closed when the story is deleted', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRemove = story.stories.find((s) => s.id === 'opt_remove');
      if (storyToRemove === undefined)
        throw new Error('test fixture must have opt_remove story');
      const closedTask: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/ops/issues/101',
        isClosed: true,
        isPr: false,
      };
      const storyObjectMap: StoryObjectMap = new Map([
        [
          storyToRemove.name,
          { story: storyToRemove, storyIssue: null, issues: [closedTask] },
        ],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });

      expect(issueRepository.closeIssueByUrl).not.toHaveBeenCalled();
    });

    it('returns 200 even when closing a task throws after story deletion', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRemove = story.stories.find((s) => s.id === 'opt_remove');
      if (storyToRemove === undefined)
        throw new Error('test fixture must have opt_remove story');
      const openTask: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/ops/issues/102',
        isClosed: false,
        isPr: false,
      };
      const storyObjectMap: StoryObjectMap = new Map([
        [
          storyToRemove.name,
          { story: storyToRemove, storyIssue: null, issues: [openTask] },
        ],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);
      issueRepository.closeIssueByUrl.mockRejectedValue(
        new Error('network error'),
      );

      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });

      expect(issueRepository.closeIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/acme-labs/ops/issues/102',
        'not_planned',
      );
      expect(response.statusCode).toBe(200);
    });

    it('does not close pull requests assigned to the story when the story is deleted', async () => {
      const p = projectWithStoriesToDelete();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRemove = story.stories.find((s) => s.id === 'opt_remove');
      if (storyToRemove === undefined)
        throw new Error('test fixture must have opt_remove story');
      const openPr: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/ops/pull/200',
        isClosed: false,
        isPr: true,
      };
      const storyObjectMap: StoryObjectMap = new Map([
        [
          storyToRemove.name,
          { story: storyToRemove, storyIssue: null, issues: [openPr] },
        ],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      const response = await handleDeleteStory(deleteStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });

      expect(response.statusCode).toBe(200);
      expect(issueRepository.closeIssueByUrl).not.toHaveBeenCalled();
    });

    it('preserves story options added server-side after cache was populated when deleting a story', async () => {
      const cachedProject = projectWithStoriesToDelete();
      const cachedStory = cachedProject.story;
      if (cachedStory === null) throw new Error('cachedStory must not be null');
      const serverFreshProject: Project = {
        ...cachedProject,
        story: {
          ...cachedStory,
          stories: [
            ...cachedStory.stories,
            {
              id: 'opt_server_only',
              name: 'Server only story',
              color: 'PURPLE' as const,
              description: '',
            },
          ],
        },
      };
      const localUpdateStoryList = jest.fn().mockResolvedValue([]);
      const localGetProject = jest.fn().mockResolvedValue(serverFreshProject);
      const ctx: ConsoleOperationContext = {
        ...deleteStoryContext(cachedProject),
        resolveProjectRepository: () => ({
          updateStoryList: localUpdateStoryList,
          getProject: localGetProject,
        }),
      };
      await handleDeleteStory(ctx, {
        pjcode: 'acme',
        storyOptionId: 'opt_remove',
      });
      expect(localUpdateStoryList).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ id: 'opt_server_only' }),
        ]),
      );
      expect(localUpdateStoryList).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([expect.objectContaining({ id: 'opt_remove' })]),
      );
    });
  });

  describe('handleStoryRename', () => {
    const projectWithStoriesToRename = (): Project => ({
      ...project,
      url: 'https://github.com/orgs/acme-labs/projects/1',
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          {
            id: 'opt_alpha',
            name: 'Alpha story',
            color: 'BLUE',
            description: '',
          },
          {
            id: 'opt_beta',
            name: 'Beta story',
            color: 'GREEN',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    });

    const updateStoryList = jest.fn();
    const renameGetProject = jest.fn();
    const projectRepositoryResolver = jest.fn(() => ({
      updateStoryList,
      getProject: renameGetProject,
    }));

    const renameStoryContext = (p: Project): ConsoleOperationContext => ({
      ...contextForProject(p),
      resolveProjectRepository: projectRepositoryResolver,
    });

    beforeEach(() => {
      updateStoryList.mockResolvedValue([]);
      renameGetProject.mockResolvedValue(null);
      projectRepositoryResolver.mockReturnValue({
        updateStoryList,
        getProject: renameGetProject,
      });
      issueRepository.getStoryObjectMap.mockResolvedValue(new Map());
      issueRepository.updateIssue.mockResolvedValue(undefined);
    });

    it('calls updateStoryList with the renamed list and returns 200', async () => {
      const p = projectWithStoriesToRename();
      const response = await handleStoryRename(renameStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_alpha',
        newName: 'Alpha renamed',
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(updateStoryList).toHaveBeenCalledWith(p, [
        {
          id: 'opt_alpha',
          name: 'Alpha renamed',
          color: 'BLUE',
          description: '',
        },
        {
          id: 'opt_beta',
          name: 'Beta story',
          color: 'GREEN',
          description: '',
        },
      ]);
    });

    it('calls invalidateProject after a successful rename', async () => {
      const p = projectWithStoriesToRename();
      const invalidateProject = jest.fn();
      const ctx: ConsoleOperationContext = {
        ...renameStoryContext(p),
        invalidateProject,
      };
      await handleStoryRename(ctx, {
        pjcode: 'acme',
        storyOptionId: 'opt_alpha',
        newName: 'Alpha renamed',
      });
      expect(invalidateProject).toHaveBeenCalledWith('acme');
    });

    it('returns 502 when resolveProjectRepository is null', async () => {
      const response = await handleStoryRename(
        contextForProject(projectWithStoriesToRename()),
        { pjcode: 'acme', storyOptionId: 'opt_alpha', newName: 'New name' },
      );
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'project repository is not configured' },
      });
    });

    it('returns 400 when storyOptionId is missing', async () => {
      const response = await handleStoryRename(
        renameStoryContext(projectWithStoriesToRename()),
        { pjcode: 'acme', newName: 'New name' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'storyOptionId is required' },
      });
    });

    it('returns 400 when newName is missing', async () => {
      const response = await handleStoryRename(
        renameStoryContext(projectWithStoriesToRename()),
        { pjcode: 'acme', storyOptionId: 'opt_alpha' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'newName is required' },
      });
    });

    it('returns 400 when pjcode is not configured', async () => {
      const response = await handleStoryRename(
        renameStoryContext(projectWithStoriesToRename()),
        { pjcode: 'unknown', storyOptionId: 'opt_alpha', newName: 'New name' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'no project configured for pjcode "unknown"' },
      });
    });

    it('returns 400 when the project has no story field', async () => {
      const projectWithoutStory: Project = {
        ...projectWithStoriesToRename(),
        story: null,
      };
      const response = await handleStoryRename(
        renameStoryContext(projectWithoutStory),
        { pjcode: 'acme', storyOptionId: 'opt_alpha', newName: 'New name' },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'project does not have a story field' },
      });
    });

    it('returns 400 when the story option is not found', async () => {
      const response = await handleStoryRename(
        renameStoryContext(projectWithStoriesToRename()),
        {
          pjcode: 'acme',
          storyOptionId: 'opt_nonexistent',
          newName: 'New name',
        },
      );
      expect(response).toEqual({
        statusCode: 400,
        body: { error: 'story option "opt_nonexistent" not found in project' },
      });
    });

    it('returns 502 when the project URL has no extractable owner', async () => {
      const p: Project = {
        ...projectWithStoriesToRename(),
        url: 'https://example.com/invalid/project/url',
      };
      const response = await handleStoryRename(renameStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_alpha',
        newName: 'New name',
      });
      expect(response).toEqual({
        statusCode: 502,
        body: { error: 'cannot determine project owner from project URL' },
      });
    });

    it('calls updateIssue with the new title when the story has an associated issue', async () => {
      const p = projectWithStoriesToRename();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRename = story.stories.find((s) => s.id === 'opt_alpha');
      if (storyToRename === undefined)
        throw new Error('test fixture must have opt_alpha story');
      const storyIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/acme-labs/ops/issues/10',
        title: 'Alpha story',
      };
      const storyObjectMap: StoryObjectMap = new Map([
        [storyToRename.name, { story: storyToRename, storyIssue, issues: [] }],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      const response = await handleStoryRename(renameStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_alpha',
        newName: 'Alpha renamed',
      });

      expect(response.statusCode).toBe(200);
      expect(issueRepository.updateIssue).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Alpha renamed' }),
      );
    });

    it('does not call updateIssue when the story has no associated issue', async () => {
      const p = projectWithStoriesToRename();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const storyToRename = story.stories.find((s) => s.id === 'opt_alpha');
      if (storyToRename === undefined)
        throw new Error('test fixture must have opt_alpha story');
      const storyObjectMap: StoryObjectMap = new Map([
        [
          storyToRename.name,
          { story: storyToRename, storyIssue: null, issues: [] },
        ],
      ]);
      issueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

      await handleStoryRename(renameStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_alpha',
        newName: 'Alpha renamed',
      });

      expect(issueRepository.updateIssue).not.toHaveBeenCalled();
    });

    it('includes story options added server-side after cache was populated in the renamed list', async () => {
      const p = projectWithStoriesToRename();
      const { story } = p;
      if (story === null) throw new Error('test fixture must have story');
      const freshProject: Project = {
        ...p,
        story: {
          ...story,
          stories: [
            ...story.stories,
            {
              id: 'opt_server_only',
              name: 'Server only',
              color: 'PURPLE' as const,
              description: '',
            },
          ],
        },
      };
      renameGetProject.mockResolvedValue(freshProject);
      const response = await handleStoryRename(renameStoryContext(p), {
        pjcode: 'acme',
        storyOptionId: 'opt_alpha',
        newName: 'Alpha renamed',
      });
      expect(response.statusCode).toBe(200);
      expect(updateStoryList).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ id: 'opt_server_only' }),
        ]),
      );
    });
  });

  describe('handleTimer', () => {
    it('returns 400 when pjcode is missing', () => {
      expect(handleTimer(context, {})).toEqual({
        statusCode: 400,
        body: { error: 'pjcode is required' },
      });
    });

    it('returns 400 when pjcode is not configured', () => {
      expect(handleTimer(context, { pjcode: 'unknown' })).toEqual({
        statusCode: 400,
        body: { error: 'pjcode is not configured' },
      });
    });

    it('returns 502 when consoleDataOutputDir is null', () => {
      const ctx: ConsoleOperationContext = {
        ...context,
        consoleDataOutputDir: null,
      };
      expect(handleTimer(ctx, { pjcode: 'acme', durationSeconds: 60 })).toEqual(
        {
          statusCode: 502,
          body: { error: 'consoleDataOutputDir is not configured' },
        },
      );
    });

    it('returns 400 when durationSeconds is not a positive integer', () => {
      expect(
        handleTimer(context, { pjcode: 'acme', durationSeconds: -1 }),
      ).toEqual({
        statusCode: 400,
        body: { error: 'durationSeconds must be a positive integer' },
      });
      expect(
        handleTimer(context, { pjcode: 'acme', durationSeconds: 0 }),
      ).toEqual({
        statusCode: 400,
        body: { error: 'durationSeconds must be a positive integer' },
      });
      expect(
        handleTimer(context, { pjcode: 'acme', durationSeconds: 1.5 }),
      ).toEqual({
        statusCode: 400,
        body: { error: 'durationSeconds must be a positive integer' },
      });
      expect(handleTimer(context, { pjcode: 'acme' })).toEqual({
        statusCode: 400,
        body: { error: 'durationSeconds must be a positive integer' },
      });
    });

    it('writes timer file and returns 200 when starting a timer', () => {
      const response = handleTimer(context, {
        pjcode: 'acme',
        durationSeconds: 1800,
      });
      expect(response).toEqual({ statusCode: 200, body: { ok: true } });
      const stored = readProjectTimer(baseDir, 'acme');
      expect(stored).not.toBeNull();
      expect(stored?.durationSeconds).toBe(1800);
    });

    it('deletes timer file and returns 200 when stopping a timer', () => {
      handleTimer(context, { pjcode: 'acme', durationSeconds: 1800 });
      const response = handleTimer(context, {
        pjcode: 'acme',
        action: 'stop',
      });
      expect(response).toEqual({ statusCode: 200, body: { ok: true } });
      expect(readProjectTimer(baseDir, 'acme')).toBeNull();
    });
  });

  describe('handleProjectMaxPreparingUpdate', () => {
    let fetchProjectReadmeSpy: jest.SpyInstance;
    let updateProjectV2ReadmeSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchProjectReadmeSpy = jest
        .spyOn(projectConfig, 'fetchProjectReadme')
        .mockResolvedValue('# Project\n');
      updateProjectV2ReadmeSpy = jest
        .spyOn(projectConfig, 'updateProjectV2Readme')
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      fetchProjectReadmeSpy.mockRestore();
      updateProjectV2ReadmeSpy.mockRestore();
    });

    it('returns 502 when githubToken is null', async () => {
      const response = await handleProjectMaxPreparingUpdate(context, null, {
        pjcode: 'acme',
        maximumPreparingIssuesCount: 3,
      });
      expect(response.statusCode).toBe(502);
    });

    it('returns 400 when maximumPreparingIssuesCount is not a positive integer', async () => {
      const response = await handleProjectMaxPreparingUpdate(context, 'token', {
        pjcode: 'acme',
        maximumPreparingIssuesCount: 0,
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when pjcode is not configured', async () => {
      const response = await handleProjectMaxPreparingUpdate(context, 'token', {
        pjcode: 'unknown',
        maximumPreparingIssuesCount: 3,
      });
      expect(response.statusCode).toBe(400);
    });

    it('creates README and returns 200 when project has no README', async () => {
      fetchProjectReadmeSpy.mockResolvedValue(null);
      const response = await handleProjectMaxPreparingUpdate(context, 'token', {
        pjcode: 'acme',
        maximumPreparingIssuesCount: 3,
      });
      expect(response.statusCode).toBe(200);
      expect(updateProjectV2ReadmeSpy).toHaveBeenCalledWith(
        project.id,
        expect.stringContaining('maximumPreparingIssuesCount'),
        'token',
      );
    });

    it('returns 502 when updateProjectV2Readme throws', async () => {
      updateProjectV2ReadmeSpy.mockRejectedValue(new Error('update failed'));
      const response = await handleProjectMaxPreparingUpdate(context, 'token', {
        pjcode: 'acme',
        maximumPreparingIssuesCount: 3,
      });
      expect(response.statusCode).toBe(502);
    });

    it('returns 200 and updates the README on success', async () => {
      const response = await handleProjectMaxPreparingUpdate(
        context,
        'gh-token',
        { pjcode: 'acme', maximumPreparingIssuesCount: 5 },
      );
      expect(response.statusCode).toBe(200);
      expect(fetchProjectReadmeSpy).toHaveBeenCalledWith(
        project.url,
        'gh-token',
      );
      expect(updateProjectV2ReadmeSpy).toHaveBeenCalledWith(
        project.id,
        expect.stringContaining('maximumPreparingIssuesCount'),
        'gh-token',
      );
    });
  });
});
