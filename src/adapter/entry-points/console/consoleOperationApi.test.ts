import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'jest-mock-extended';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import {
  ConsoleOperationContext,
  ConsoleProjectBinding,
  handleAttachmentUpload,
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
      resolveIssueRepository: () => issueRepository,
      resolveProject: async (pjcode: string) =>
        pjcode === 'acme' ? { pjcode, project } : null,
      isPjcodeConfigured: (pjcode: string) => pjcode === 'acme',
      consoleDataOutputDir: baseDir,
      issueAttachmentRepository: null,
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

  describe('handleReview', () => {
    it('approves and sets Awaiting workspace then records done', async () => {
      const response = await handleReview(context, {
        pjcode: 'acme',
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
        expect.objectContaining({
          itemId: 'PVTI_a',
          url: 'https://github.com/o/r/pull/1',
        }),
        'status_aw',
      );
      expect(issueRepository.get).not.toHaveBeenCalled();
      expectRecordedAcrossTabs('PVTI_a');
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
        action: 'approve',
        prUrl: 'https://github.com/meta-site/hr-audit-mock/pull/178',
        projectItemId: 'PVTI_resolver',
      });

      expect(resolvedUrls).toContain(
        'https://github.com/meta-site/hr-audit-mock/pull/178',
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
      expectRecordedAcrossTabs('PVTI_b');
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
      expectRecordedAcrossTabs('PVTI_b');
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
        action: 'approve',
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
        action: 'approve',
        prUrl: 'https://github.com/o/r/pull/1',
      });
      expect(response.statusCode).toBe(400);
    });

    it('approves using the request project item id without a GraphQL item fetch', async () => {
      issueRepository.get.mockResolvedValue(null);
      const response = await handleReview(context, {
        pjcode: 'acme',
        action: 'approve',
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
      expectRecordedAcrossTabs('PVTI_d');
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
      expectRecordedAcrossTabs('PVTI_e');
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
      expectRecordedAcrossTabs('PVTI_i');
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
      for (const tab of CONSOLE_DONE_TAB_NAMES) {
        expect(readDoneProjectItemIds(baseDir, 'globex', tab)).toContain(
          'PVTI_x',
        );
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
        pjcode: 'acme',
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
        pjcode: 'acme',
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
});
