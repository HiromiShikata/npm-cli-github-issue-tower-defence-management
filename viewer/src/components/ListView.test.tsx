import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListView } from './ListView';
import type { PrListItem, StoryDefinition } from '../api/types';

const makeStories = (): StoryDefinition[] => [
  { name: 'Story A', color: '#ff0000', order: 0 },
  { name: 'Story B', color: '#00ff00', order: 1 },
];

const makeItems = (): PrListItem[] => [
  {
    issue: { number: 1, title: 'Task 1', author: 'dev', url: 'https://github.com/o/r/issues/1', story: 'Story A', projectItemId: 'PVTI_1' },
    pr: { number: 10, repo: 'o/r', title: 'PR 10', additions: 5, deletions: 2, changedFiles: 1, url: 'https://github.com/o/r/pull/10' },
    changedDirectories: ['src/api'],
  },
  {
    issue: { number: 2, title: 'Task 2', author: 'dev', url: 'https://github.com/o/r/issues/2', story: 'Story B', projectItemId: 'PVTI_2' },
    pr: { number: 11, repo: 'o/r', title: 'PR 11', additions: 3, deletions: 1, changedFiles: 1, url: 'https://github.com/o/r/pull/11' },
    changedDirectories: ['src/components'],
  },
];

describe('ListView', () => {
  it('renders PR count in header', () => {
    render(<ListView stories={makeStories()} items={makeItems()} doneSet={new Set()} onSelectPr={vi.fn()} />);
    expect(screen.getByText('2 / 2')).toBeDefined();
  });

  it('renders story group headers with dot', () => {
    render(<ListView stories={makeStories()} items={makeItems()} doneSet={new Set()} onSelectPr={vi.fn()} />);
    expect(screen.getByText('Story A')).toBeDefined();
    expect(screen.getByText('Story B')).toBeDefined();
  });

  it('renders issue titles not PR titles', () => {
    render(<ListView stories={makeStories()} items={makeItems()} doneSet={new Set()} onSelectPr={vi.fn()} />);
    expect(screen.getByText('Task 1')).toBeDefined();
    expect(screen.getByText('Task 2')).toBeDefined();
    expect(screen.queryByText('PR 10')).toBeNull();
  });

  it('renders changed directories as tags', () => {
    render(<ListView stories={makeStories()} items={makeItems()} doneSet={new Set()} onSelectPr={vi.fn()} />);
    expect(screen.getByText('src/api')).toBeDefined();
    expect(screen.getByText('src/components')).toBeDefined();
  });

  it('excludes done items from list', () => {
    const doneSet = new Set(['o/r/10']);
    render(<ListView stories={makeStories()} items={makeItems()} doneSet={doneSet} onSelectPr={vi.fn()} />);
    expect(screen.queryByText('Task 1')).toBeNull();
    expect(screen.getByText('Task 2')).toBeDefined();
    expect(screen.getByText('1 / 2')).toBeDefined();
  });

  it('calls onSelectPr when PR card is clicked', async () => {
    const onSelectPr = vi.fn();
    render(<ListView stories={makeStories()} items={makeItems()} doneSet={new Set()} onSelectPr={onSelectPr} />);
    await userEvent.click(screen.getByText('Task 1'));
    expect(onSelectPr).toHaveBeenCalledWith(makeItems()[0]);
  });

  it('shows all reviewed message when all done', () => {
    const doneSet = new Set(['o/r/10', 'o/r/11']);
    render(<ListView stories={makeStories()} items={makeItems()} doneSet={doneSet} onSelectPr={vi.fn()} />);
    expect(screen.getByText('All PRs have been reviewed.')).toBeDefined();
  });
});
