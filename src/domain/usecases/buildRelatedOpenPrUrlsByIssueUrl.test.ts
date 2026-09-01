import { buildRelatedOpenPrUrlsByIssueUrl } from './buildRelatedOpenPrUrlsByIssueUrl';
import { Issue } from '../entities/Issue';

const createIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  author: 'testuser',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

describe('buildRelatedOpenPrUrlsByIssueUrl', () => {
  it('maps an issue URL to an open PR URL via closingIssueReferenceUrls', () => {
    const issueUrl = 'https://github.com/user/repo/issues/1';
    const prUrl = 'https://github.com/user/repo/pull/42';
    const prIssue = createIssue({
      url: prUrl,
      isPr: true,
      isClosed: false,
      closingIssueReferenceUrls: [issueUrl],
    });

    const result = buildRelatedOpenPrUrlsByIssueUrl([prIssue]);

    expect(result.get(issueUrl)).toEqual([prUrl]);
  });

  it('excludes closed PRs', () => {
    const prIssue = createIssue({
      url: 'https://github.com/user/repo/pull/42',
      isPr: true,
      isClosed: true,
      closingIssueReferenceUrls: ['https://github.com/user/repo/issues/1'],
    });

    const result = buildRelatedOpenPrUrlsByIssueUrl([prIssue]);

    expect(result.size).toBe(0);
  });

  it('excludes non-PR items regardless of closingIssueReferenceUrls', () => {
    const regularIssue = createIssue({
      url: 'https://github.com/user/repo/issues/2',
      isPr: false,
      isClosed: false,
      closingIssueReferenceUrls: ['https://github.com/user/repo/issues/1'],
    });

    const result = buildRelatedOpenPrUrlsByIssueUrl([regularIssue]);

    expect(result.size).toBe(0);
  });

  it('accumulates multiple open PRs referencing the same issue URL', () => {
    const issueUrl = 'https://github.com/user/repo/issues/1';
    const prIssue1 = createIssue({
      url: 'https://github.com/user/repo/pull/42',
      number: 42,
      isPr: true,
      isClosed: false,
      closingIssueReferenceUrls: [issueUrl],
    });
    const prIssue2 = createIssue({
      url: 'https://github.com/user/repo/pull/43',
      number: 43,
      isPr: true,
      isClosed: false,
      closingIssueReferenceUrls: [issueUrl],
    });

    const result = buildRelatedOpenPrUrlsByIssueUrl([prIssue1, prIssue2]);

    expect(result.get(issueUrl)).toHaveLength(2);
    expect(result.get(issueUrl)).toContain(prIssue1.url);
    expect(result.get(issueUrl)).toContain(prIssue2.url);
  });

  it('handles a PR that references multiple issues', () => {
    const issueUrl1 = 'https://github.com/user/repo/issues/1';
    const issueUrl2 = 'https://github.com/user/repo/issues/2';
    const prUrl = 'https://github.com/user/repo/pull/42';
    const prIssue = createIssue({
      url: prUrl,
      isPr: true,
      isClosed: false,
      closingIssueReferenceUrls: [issueUrl1, issueUrl2],
    });

    const result = buildRelatedOpenPrUrlsByIssueUrl([prIssue]);

    expect(result.get(issueUrl1)).toEqual([prUrl]);
    expect(result.get(issueUrl2)).toEqual([prUrl]);
  });

  it('returns an empty map when there are no PR items', () => {
    const result = buildRelatedOpenPrUrlsByIssueUrl([]);

    expect(result.size).toBe(0);
  });

  it('deduplicates when the same PR URL appears via multiple closingIssueReferenceUrls entries for the same issue', () => {
    const issueUrl = 'https://github.com/user/repo/issues/1';
    const prUrl = 'https://github.com/user/repo/pull/42';
    const prIssue = createIssue({
      url: prUrl,
      isPr: true,
      isClosed: false,
      closingIssueReferenceUrls: [issueUrl, issueUrl],
    });

    const result = buildRelatedOpenPrUrlsByIssueUrl([prIssue]);

    expect(result.get(issueUrl)).toEqual([prUrl]);
  });
});
