import {
  OwnerCallFileRepository,
  SessionCommandRepository,
  SessionHost,
  SessionHostRepository,
  SessionReadCommandResult,
} from '../adapter-interfaces/LiveSessionToolRepository';
import { IssueRepository } from '../adapter-interfaces/IssueRepository';
import {
  LIVE_SESSION_COMMENT_BODY_LIMIT_BYTES,
  LIVE_SESSION_SCREEN_DEFAULT_LINE_COUNT,
  LIVE_SESSION_SCREEN_MAX_LINE_COUNT,
  LIVE_SESSION_TASK_BODY_LIMIT_BYTES,
  LIVE_SESSION_TOOL_NAMES,
  LIVE_SESSION_TOOL_OUTPUT_LIMIT_BYTES,
  LiveSessionToolCallInput,
  LiveSessionToolCallOutcome,
  LiveSessionToolCallRunner,
  capLiveSessionText,
  isBinaryText,
  isPathInsideFolder,
  lastScreenLines,
  issueUrlOfSessionName,
  joinSessionFolderPath,
  normalizeLiveSessionName,
} from './LiveSessionToolCall';

export type LiveSessionIssueReader = Pick<
  IssueRepository,
  | 'getIssueByUrl'
  | 'getIssueOrPullRequestBody'
  | 'getIssueOrPullRequestComments'
>;

export type LiveSessionToolCallDependencies = {
  ownerCalls: OwnerCallFileRepository;
  hosts: SessionHostRepository;
  commands: SessionCommandRepository;
  issues: LiveSessionIssueReader;
};

const LOCAL_HOST: SessionHost = { kind: 'local' };

const NO_SESSION_NAME_TEXT = 'セッション名が指定されていません。';

const SESSION_NOT_LOCATED_TEXT = 'セッションが見つかりません。';

const HOST_NOT_IN_TABLE_TEXT =
  'セッションが動いているホストが作業ホストの一覧にありません。';

const HOST_UNREACHABLE_TEXT =
  'セッションが動いているホストに接続できませんでした。';

const TASK_ISSUE_NOT_DERIVABLE_TEXT =
  'セッション名からタスク Issue の URL を特定できません。';

const TASK_ISSUE_NOT_FOUND_TEXT = 'タスク Issue が見つかりません。';

const PANE_PATH_UNAVAILABLE_TEXT =
  'セッションの作業フォルダを取得できませんでした。';

const FILE_NOT_FOUND_TEXT = 'ファイルまたはフォルダが見つかりません。';

const FILE_OUTSIDE_FOLDER_TEXT =
  '指定されたパスはセッションの作業フォルダの外にあるため、読めません。';

const FILE_BINARY_TEXT = 'バイナリファイルのため内容は表示できません。';

const FILE_TYPE_UNSUPPORTED_TEXT =
  '通常のファイルでもフォルダでもないため、読めません。';

type SessionArgument =
  { kind: 'ok'; sessionName: string | null } | { kind: 'invalid' };

type SessionLocation =
  | { kind: 'located'; sessionName: string; host: SessionHost }
  | { kind: 'notLocated'; text: string };

type ScreenArgument = { kind: 'ok'; lineCount: number } | { kind: 'invalid' };

const describeHost = (host: SessionHost): string => {
  if (host.kind === 'local') {
    return 'local';
  }
  return host.name;
};

const readSessionArgument = (
  input: LiveSessionToolCallInput,
): SessionArgument => {
  const value = input.arguments.sessionName;
  if (value === undefined || value === null) {
    return { kind: 'ok', sessionName: input.sessionName };
  }
  if (typeof value !== 'string') {
    return { kind: 'invalid' };
  }
  return { kind: 'ok', sessionName: value };
};

const readScreenLineCount = (value: unknown): ScreenArgument => {
  if (value === undefined || value === null) {
    return { kind: 'ok', lineCount: LIVE_SESSION_SCREEN_DEFAULT_LINE_COUNT };
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > LIVE_SESSION_SCREEN_MAX_LINE_COUNT
  ) {
    return { kind: 'invalid' };
  }
  return { kind: 'ok', lineCount: value };
};

const readPathArgument = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const commandSucceeded = (result: SessionReadCommandResult): boolean =>
  result.kind === 'exited' && result.exitCode === 0;

const outputOf = (text: string): LiveSessionToolCallOutcome => ({
  kind: 'output',
  output: capLiveSessionText(text, LIVE_SESSION_TOOL_OUTPUT_LIMIT_BYTES),
});

export class LiveSessionToolCallUseCase implements LiveSessionToolCallRunner {
  constructor(private readonly dependencies: LiveSessionToolCallDependencies) {}

  run = async (
    input: LiveSessionToolCallInput,
  ): Promise<LiveSessionToolCallOutcome> => {
    switch (input.name) {
      case LIVE_SESSION_TOOL_NAMES.callingSessionsList:
        return this.callingSessionsList();
      case LIVE_SESSION_TOOL_NAMES.sessionScreenRead:
        return this.sessionScreenRead(input);
      case LIVE_SESSION_TOOL_NAMES.sessionTaskIssueRead:
        return this.sessionTaskIssueRead(input);
      case LIVE_SESSION_TOOL_NAMES.sessionFileRead:
        return this.sessionFileRead(input);
      default:
        return { kind: 'unknownTool' };
    }
  };

  private callingSessionsList =
    async (): Promise<LiveSessionToolCallOutcome> => {
      const entries = this.dependencies.ownerCalls
        .listPendingOwnerCalls()
        .map((call) => {
          const sessionName = normalizeLiveSessionName(call.sessionName);
          const issueUrl =
            sessionName === null ? null : issueUrlOfSessionName(sessionName);
          const host =
            issueUrl === null
              ? LOCAL_HOST
              : this.dependencies.hosts.findHostOfIssueSession(issueUrl);
          return {
            sessionName: call.sessionName,
            calledAt: call.calledAt,
            host: describeHost(host),
            taskIssueUrl: issueUrl,
          };
        });
      return outputOf(JSON.stringify({ calls: entries }, null, 2));
    };

  private sessionScreenRead = async (
    input: LiveSessionToolCallInput,
  ): Promise<LiveSessionToolCallOutcome> => {
    const session = readSessionArgument(input);
    if (session.kind === 'invalid') {
      return { kind: 'invalidArguments' };
    }
    const screenLines = readScreenLineCount(input.arguments.lineCount);
    if (screenLines.kind === 'invalid') {
      return { kind: 'invalidArguments' };
    }
    if (session.sessionName === null || session.sessionName.trim() === '') {
      return outputOf(NO_SESSION_NAME_TEXT);
    }
    const location = await this.locateSession(session.sessionName);
    if (location.kind === 'notLocated') {
      return outputOf(location.text);
    }
    const capture = await this.dependencies.commands.run(location.host, {
      kind: 'tmuxCapturePane',
      sessionName: location.sessionName,
    });
    if (!commandSucceeded(capture) || capture.kind !== 'exited') {
      return outputOf(SESSION_NOT_LOCATED_TEXT);
    }
    return outputOf(lastScreenLines(capture.stdout, screenLines.lineCount));
  };

  private sessionTaskIssueRead = async (
    input: LiveSessionToolCallInput,
  ): Promise<LiveSessionToolCallOutcome> => {
    const session = readSessionArgument(input);
    if (session.kind === 'invalid') {
      return { kind: 'invalidArguments' };
    }
    if (session.sessionName === null || session.sessionName.trim() === '') {
      return outputOf(NO_SESSION_NAME_TEXT);
    }
    const sessionName = normalizeLiveSessionName(session.sessionName);
    const issueUrl =
      sessionName === null ? null : issueUrlOfSessionName(sessionName);
    if (issueUrl === null) {
      return outputOf(TASK_ISSUE_NOT_DERIVABLE_TEXT);
    }
    const issue = await this.dependencies.issues.getIssueByUrl(issueUrl);
    if (issue === null) {
      return outputOf(TASK_ISSUE_NOT_FOUND_TEXT);
    }
    const body =
      await this.dependencies.issues.getIssueOrPullRequestBody(issueUrl);
    const comments =
      await this.dependencies.issues.getIssueOrPullRequestComments(issueUrl);
    const latestComment = comments.reduce<(typeof comments)[number] | null>(
      (latest, comment) =>
        latest === null ||
        comment.createdAt.getTime() > latest.createdAt.getTime()
          ? comment
          : latest,
      null,
    );
    return outputOf(
      JSON.stringify(
        {
          url: issueUrl,
          title: issue.title,
          body: capLiveSessionText(body, LIVE_SESSION_TASK_BODY_LIMIT_BYTES),
          latestComment:
            latestComment === null
              ? null
              : {
                  author: latestComment.author,
                  createdAt: latestComment.createdAt.toISOString(),
                  body: capLiveSessionText(
                    latestComment.body,
                    LIVE_SESSION_COMMENT_BODY_LIMIT_BYTES,
                  ),
                },
        },
        null,
        2,
      ),
    );
  };

  private sessionFileRead = async (
    input: LiveSessionToolCallInput,
  ): Promise<LiveSessionToolCallOutcome> => {
    const session = readSessionArgument(input);
    if (session.kind === 'invalid') {
      return { kind: 'invalidArguments' };
    }
    const relativePath = readPathArgument(input.arguments.path);
    if (relativePath === null) {
      return { kind: 'invalidArguments' };
    }
    if (session.sessionName === null || session.sessionName.trim() === '') {
      return outputOf(NO_SESSION_NAME_TEXT);
    }
    const location = await this.locateSession(session.sessionName);
    if (location.kind === 'notLocated') {
      return outputOf(location.text);
    }
    const { host, sessionName } = location;
    const panePath = await this.dependencies.commands.run(host, {
      kind: 'tmuxPanePath',
      sessionName,
    });
    if (!commandSucceeded(panePath) || panePath.kind !== 'exited') {
      return outputOf(PANE_PATH_UNAVAILABLE_TEXT);
    }
    const folderRealPath = await this.realPathOf(
      host,
      panePath.stdout.replace(/\n$/, ''),
    );
    if (folderRealPath === null) {
      return outputOf(PANE_PATH_UNAVAILABLE_TEXT);
    }
    const targetRealPath = await this.realPathOf(
      host,
      joinSessionFolderPath(folderRealPath, relativePath),
    );
    if (targetRealPath === null) {
      return outputOf(FILE_NOT_FOUND_TEXT);
    }
    if (!isPathInsideFolder(folderRealPath, targetRealPath)) {
      return outputOf(FILE_OUTSIDE_FOLDER_TEXT);
    }
    const fileType = await this.dependencies.commands.run(host, {
      kind: 'fileType',
      path: targetRealPath,
    });
    if (!commandSucceeded(fileType) || fileType.kind !== 'exited') {
      return outputOf(FILE_NOT_FOUND_TEXT);
    }
    const typeName = fileType.stdout.trim();
    if (typeName === 'directory') {
      return this.listDirectory(host, targetRealPath);
    }
    if (typeName === 'regular file' || typeName === 'regular empty file') {
      return this.readFileText(host, targetRealPath);
    }
    return outputOf(FILE_TYPE_UNSUPPORTED_TEXT);
  };

  private locateSession = async (rawName: string): Promise<SessionLocation> => {
    const sessionName = normalizeLiveSessionName(rawName);
    if (sessionName === null) {
      return { kind: 'notLocated', text: SESSION_NOT_LOCATED_TEXT };
    }
    const issueUrl = issueUrlOfSessionName(sessionName);
    const host =
      issueUrl === null
        ? LOCAL_HOST
        : this.dependencies.hosts.findHostOfIssueSession(issueUrl);
    if (host.kind === 'unknownRemote') {
      return { kind: 'notLocated', text: HOST_NOT_IN_TABLE_TEXT };
    }
    const exists = await this.dependencies.commands.run(host, {
      kind: 'tmuxHasSession',
      sessionName,
    });
    if (exists.kind === 'unreachable') {
      return { kind: 'notLocated', text: HOST_UNREACHABLE_TEXT };
    }
    if (exists.exitCode !== 0) {
      return { kind: 'notLocated', text: SESSION_NOT_LOCATED_TEXT };
    }
    return { kind: 'located', sessionName, host };
  };

  private realPathOf = async (
    host: SessionHost,
    path: string,
  ): Promise<string | null> => {
    const result = await this.dependencies.commands.run(host, {
      kind: 'realPath',
      path,
    });
    if (!commandSucceeded(result) || result.kind !== 'exited') {
      return null;
    }
    return result.stdout.replace(/\n$/, '');
  };

  private listDirectory = async (
    host: SessionHost,
    directoryPath: string,
  ): Promise<LiveSessionToolCallOutcome> => {
    const result = await this.dependencies.commands.run(host, {
      kind: 'listDirectory',
      path: directoryPath,
    });
    if (!commandSucceeded(result) || result.kind !== 'exited') {
      return outputOf(FILE_NOT_FOUND_TEXT);
    }
    const entries = result.stdout
      .split('\n')
      .filter((entry) => entry.length > 0)
      .sort();
    return outputOf(entries.join('\n'));
  };

  private readFileText = async (
    host: SessionHost,
    filePath: string,
  ): Promise<LiveSessionToolCallOutcome> => {
    const result = await this.dependencies.commands.run(host, {
      kind: 'readFileHead',
      path: filePath,
      byteLimit: LIVE_SESSION_TOOL_OUTPUT_LIMIT_BYTES + 1,
    });
    if (!commandSucceeded(result) || result.kind !== 'exited') {
      return outputOf(FILE_NOT_FOUND_TEXT);
    }
    if (isBinaryText(result.stdout)) {
      return outputOf(FILE_BINARY_TEXT);
    }
    return outputOf(result.stdout);
  };
}
