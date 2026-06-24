import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
} from '../../../domain/entities/WorkflowStatus';
import {
  ClaudeInteractiveSession,
  ClaudeInteractiveSessionRepository,
} from '../../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
import { InTmuxByHumanSessionTokenCountUseCase } from '../../../domain/usecases/InTmuxByHumanSessionTokenCountUseCase';
import { InTmuxByHumanSessionTokenCountHandler } from './InTmuxByHumanSessionTokenCountHandler';

class FakeClaudeInteractiveSessionRepository implements ClaudeInteractiveSessionRepository {
  constructor(private readonly sessions: ClaudeInteractiveSession[]) {}
  listInteractiveSessions = (): ClaudeInteractiveSession[] => this.sessions;
}

const issueUrlA = 'https://github.com/HiromiShikata/example/issues/1';
const issueUrlB = 'https://github.com/HiromiShikata/example/issues/2';

const issue = (url: string, status: string): Issue => ({
  nameWithOwner: 'HiromiShikata/example',
  number: 1,
  title: 'Example issue',
  state: 'OPEN',
  status,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url,
  assignees: ['hiromi'],
  labels: [],
  org: 'HiromiShikata',
  repo: 'example',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'hiromi',
});

describe('InTmuxByHumanSessionTokenCountHandler', () => {
  let tokenListPath: string;

  beforeEach(() => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'token-list-'));
    tokenListPath = path.join(directory, 'tokens.json');
    fs.writeFileSync(
      tokenListPath,
      JSON.stringify([
        { name: 'alpha', token: 'token-alpha' },
        { name: 'beta', token: 'token-beta' },
      ]),
    );
  });

  afterEach(() => {
    fs.rmSync(path.dirname(tokenListPath), { recursive: true, force: true });
  });

  it('writes one tab-separated line per token with In-Tmux-by-human counts', () => {
    const handler = new InTmuxByHumanSessionTokenCountHandler(
      new InTmuxByHumanSessionTokenCountUseCase(),
      new FakeClaudeInteractiveSessionRepository([
        { token: 'token-alpha', sessionId: 'session-a', issueUrl: issueUrlA },
        { token: 'token-alpha', sessionId: 'session-a', issueUrl: issueUrlA },
        { token: 'token-beta', sessionId: 'session-b', issueUrl: issueUrlB },
      ]),
    );

    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      issues: [
        issue(issueUrlA, IN_TMUX_STATUS_NAME),
        issue(issueUrlB, AWAITING_QUALITY_CHECK_STATUS_NAME),
      ],
    });

    expect(output.lines).toEqual(['alpha\t1', 'beta\t0']);
  });

  it('reports a diagnostic when no token list path is available', () => {
    const handler = new InTmuxByHumanSessionTokenCountHandler(
      new InTmuxByHumanSessionTokenCountUseCase(),
      new FakeClaudeInteractiveSessionRepository([]),
    );
    const previous = process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH;

    const output = handler.handle({ tokenListJsonPath: null, issues: [] });

    expect(output.lines).toEqual([]);
    expect(output.diagnostics[0]).toContain('No token list path provided');

    if (previous !== undefined) {
      process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH = previous;
    }
  });

  it('reports a diagnostic when the token list file has no usable entries', () => {
    fs.writeFileSync(tokenListPath, JSON.stringify([]));
    const handler = new InTmuxByHumanSessionTokenCountHandler(
      new InTmuxByHumanSessionTokenCountUseCase(),
      new FakeClaudeInteractiveSessionRepository([]),
    );

    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      issues: [],
    });

    expect(output.lines).toEqual([]);
    expect(output.diagnostics[0]).toContain('No usable token entries');
  });
});
