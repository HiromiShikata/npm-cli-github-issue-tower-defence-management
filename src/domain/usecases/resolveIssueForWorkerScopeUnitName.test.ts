import { resolveIssueForWorkerScopeUnitName } from './resolveIssueForWorkerScopeUnitName';
import { Issue } from '../entities/Issue';

const buildIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'owner/repo',
  number: 1,
  title: 'title',
  state: 'OPEN',
  status: 'Preparation',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/owner/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'owner',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'author',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

describe('resolveIssueForWorkerScopeUnitName', () => {
  it.each([
    {
      name: 'matches a scope unit name built from org, repo, and issue number',
      scopeUnitName: 'aw-owner-repo-1-12345.scope',
      issues: [buildIssue({ org: 'owner', repo: 'repo', number: 1 })],
      expected: 'https://github.com/owner/repo/issues/1',
    },
    {
      name: 'matches when org and repo names themselves contain hyphens',
      scopeUnitName:
        'aw-HiromiShikata-npm-cli-github-issue-tower-defence-management-2694-99.scope',
      issues: [
        buildIssue({
          org: 'HiromiShikata',
          repo: 'npm-cli-github-issue-tower-defence-management',
          number: 2694,
          url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/2694',
        }),
      ],
      expected:
        'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/2694',
    },
    {
      name: 'picks the issue whose prefix matches out of several candidates',
      scopeUnitName: 'aw-owner-repo-42-555.scope',
      issues: [
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 4,
          url: 'https://github.com/owner/repo/issues/4',
        }),
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 42,
          url: 'https://github.com/owner/repo/issues/42',
        }),
      ],
      expected: 'https://github.com/owner/repo/issues/42',
    },
    {
      name: 'returns null when no issue prefix matches the scope unit name',
      scopeUnitName: 'aw-someorg-somerepo-999-1234.scope',
      issues: [buildIssue({ org: 'owner', repo: 'repo', number: 1 })],
      expected: null,
    },
    {
      name: 'returns null when the scope unit name has no trailing pid before .scope',
      scopeUnitName: 'aw-owner-repo-1-.scope',
      issues: [buildIssue({ org: 'owner', repo: 'repo', number: 1 })],
      expected: null,
    },
    {
      name: 'returns null for a cl-*.scope unit name (a different scope family)',
      scopeUnitName: 'cl-some-session-9.scope',
      issues: [buildIssue({ org: 'owner', repo: 'repo', number: 1 })],
      expected: null,
    },
    {
      name: 'returns null when the issues list is empty',
      scopeUnitName: 'aw-owner-repo-1-123.scope',
      issues: [],
      expected: null,
    },
  ])('$name', ({ scopeUnitName, issues, expected }) => {
    const resolved = resolveIssueForWorkerScopeUnitName(scopeUnitName, issues);
    expect(resolved === null ? null : resolved.url).toBe(expected);
  });
});
