import { Issue } from '../entities/Issue';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { ClaudeInteractiveSession } from './adapter-interfaces/ClaudeInteractiveSessionRepository';
import { InTmuxByHumanSessionTokenCountUseCase } from './InTmuxByHumanSessionTokenCountUseCase';
import { OauthTokenCandidate } from './OauthTokenSelectUseCase';

const candidate = (name: string): OauthTokenCandidate => ({
  name,
  token: `fake-token-${name}`,
  snapshot: null,
});

const session = (
  name: string,
  sessionId: string,
  issueUrl: string,
): ClaudeInteractiveSession => ({
  token: `fake-token-${name}`,
  sessionId,
  issueUrl,
});

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

describe('InTmuxByHumanSessionTokenCountUseCase', () => {
  const useCase = new InTmuxByHumanSessionTokenCountUseCase();
  const issueUrlA = 'https://github.com/HiromiShikata/example/issues/1';
  const issueUrlB = 'https://github.com/HiromiShikata/example/issues/2';

  it('counts a session whose issue is in In-Tmux-by-human status', () => {
    const result = useCase.run(
      [candidate('alpha')],
      [session('alpha', 'session-a', issueUrlA)],
      [issue(issueUrlA, IN_TMUX_STATUS_NAME)],
    );

    const alpha = result.counts.find((entry) => entry.name === 'alpha');
    expect(alpha?.count).toBe(1);
  });

  it('does not count a session whose issue is in another status', () => {
    const result = useCase.run(
      [candidate('alpha')],
      [session('alpha', 'session-a', issueUrlA)],
      [issue(issueUrlA, AWAITING_QUALITY_CHECK_STATUS_NAME)],
    );

    const alpha = result.counts.find((entry) => entry.name === 'alpha');
    expect(alpha?.count).toBe(0);
  });

  it('does not count a session whose issue is closed even in In-Tmux-by-human status', () => {
    const closedIssue: Issue = {
      ...issue(issueUrlA, IN_TMUX_STATUS_NAME),
      isClosed: true,
    };
    const result = useCase.run(
      [candidate('alpha')],
      [session('alpha', 'session-a', issueUrlA)],
      [closedIssue],
    );

    const alpha = result.counts.find((entry) => entry.name === 'alpha');
    expect(alpha?.count).toBe(0);
  });

  it('dedupes distinct sessions sharing one session id under the same token', () => {
    const result = useCase.run(
      [candidate('alpha')],
      [
        session('alpha', 'session-a', issueUrlA),
        session('alpha', 'session-a', issueUrlA),
        session('alpha', 'session-a', issueUrlA),
      ],
      [issue(issueUrlA, IN_TMUX_STATUS_NAME)],
    );

    const alpha = result.counts.find((entry) => entry.name === 'alpha');
    expect(alpha?.count).toBe(1);
  });

  it('counts distinct session ids separately under the same token', () => {
    const result = useCase.run(
      [candidate('alpha')],
      [
        session('alpha', 'session-a', issueUrlA),
        session('alpha', 'session-b', issueUrlB),
      ],
      [
        issue(issueUrlA, IN_TMUX_STATUS_NAME),
        issue(issueUrlB, IN_TMUX_STATUS_NAME),
      ],
    );

    const alpha = result.counts.find((entry) => entry.name === 'alpha');
    expect(alpha?.count).toBe(2);
  });

  it('reports counts per token across multiple tokens', () => {
    const result = useCase.run(
      [candidate('alpha'), candidate('beta')],
      [
        session('alpha', 'session-a', issueUrlA),
        session('beta', 'session-b', issueUrlB),
      ],
      [
        issue(issueUrlA, IN_TMUX_STATUS_NAME),
        issue(issueUrlB, AWAITING_QUALITY_CHECK_STATUS_NAME),
      ],
    );

    expect(result.counts).toEqual([
      { name: 'alpha', token: 'fake-token-alpha', count: 1 },
      { name: 'beta', token: 'fake-token-beta', count: 0 },
    ]);

    const beta = result.counts.find((entry) => entry.name === 'beta');
    expect(beta?.count).toBe(0);
  });

  it('reports zero for a token with no matching interactive session', () => {
    const result = useCase.run(
      [candidate('lonely')],
      [session('other', 'session-x', issueUrlA)],
      [issue(issueUrlA, IN_TMUX_STATUS_NAME)],
    );

    const lonely = result.counts.find((entry) => entry.name === 'lonely');
    expect(lonely?.count).toBe(0);
  });

  it('ignores a session whose issue url is not present among the issues', () => {
    const result = useCase.run(
      [candidate('alpha')],
      [session('alpha', 'session-a', issueUrlB)],
      [issue(issueUrlA, IN_TMUX_STATUS_NAME)],
    );

    const alpha = result.counts.find((entry) => entry.name === 'alpha');
    expect(alpha?.count).toBe(0);
  });
});
