import {
  hasBacklogTicketUrl,
  hasStoryIssueLabel,
  isRegularStory,
  isStoryUnset,
} from './storyValueClassify';

describe('storyValueClassify', () => {
  it.each([
    { story: null, expected: true },
    { story: '', expected: true },
    { story: '   ', expected: true },
    { story: 'NO STORY', expected: true },
    { story: 'no story', expected: true },
    { story: 'feature A (No Story yet)', expected: true },
    { story: 'feature A', expected: false },
    { story: 'regular / chores', expected: false },
  ])('isStoryUnset returns $expected for $story', ({ story, expected }) => {
    expect(isStoryUnset(story)).toBe(expected);
  });

  it.each([
    { story: 'regular / chores', expected: true },
    { story: 'regular / workflow management', expected: true },
    { story: 'feature A', expected: false },
    { story: 'irregular / chores', expected: false },
  ])('isRegularStory returns $expected for $story', ({ story, expected }) => {
    expect(isRegularStory(story)).toBe(expected);
  });

  it.each([
    { text: 'See https://example.backlog.com/view/EXAMPLE-1', expected: true },
    { text: 'See https://example.backlog.jp/view/EXAMPLE-2', expected: true },
    {
      text: 'See https://example.backlog.com/projects/EXAMPLE',
      expected: false,
    },
    { text: 'See https://github.com/owner/repo/issues/1', expected: false },
    { text: '', expected: false },
  ])(
    'hasBacklogTicketUrl returns $expected for $text',
    ({ text, expected }) => {
      expect(hasBacklogTicketUrl(text)).toBe(expected);
    },
  );

  it.each([
    { labels: ['story'], expected: true },
    { labels: ['bug', 'story'], expected: true },
    { labels: ['stories'], expected: false },
    { labels: [], expected: false },
  ])(
    'hasStoryIssueLabel returns $expected for $labels',
    ({ labels, expected }) => {
      expect(hasStoryIssueLabel(labels)).toBe(expected);
    },
  );
});
