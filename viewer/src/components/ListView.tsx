import React from 'react';
import type { PrListItem, StoryDefinition } from '../api/types';

type ListViewProps = {
  stories: StoryDefinition[];
  items: PrListItem[];
  doneSet: Set<string>;
  onSelectPr: (item: PrListItem) => void;
};

const buildPrKey = (repo: string, prNumber: number): string =>
  `${repo}/${prNumber}`;

const groupByStory = (
  items: PrListItem[],
  stories: StoryDefinition[],
  doneSet: Set<string>,
): { story: StoryDefinition; items: PrListItem[] }[] => {
  const pending = items.filter(
    (item) => !doneSet.has(buildPrKey(item.pr.repo, item.pr.number)),
  );
  const storyOrder = stories.map((s) => s.name);
  const grouped = new Map<string, PrListItem[]>();
  for (const item of pending) {
    const storyName = item.issue.story ?? '';
    const existing = grouped.get(storyName);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(storyName, [item]);
    }
  }
  const result: { story: StoryDefinition; items: PrListItem[] }[] = [];
  for (const story of stories) {
    const storyItems = grouped.get(story.name);
    if (storyItems && storyItems.length > 0) {
      result.push({ story, items: storyItems });
    }
  }
  for (const [storyName, storyItems] of grouped.entries()) {
    if (!storyOrder.includes(storyName) && storyItems.length > 0) {
      result.push({
        story: { name: storyName, color: '#9ca3af', order: 999 },
        items: storyItems,
      });
    }
  }
  return result;
};

type PrCardProps = {
  item: PrListItem;
  onSelect: (item: PrListItem) => void;
};

const PrCard = ({ item, onSelect }: PrCardProps): React.JSX.Element => (
  <button
    type="button"
    onClick={() => onSelect(item)}
    style={{
      width: '100%',
      display: 'block',
      padding: '0.75rem',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      cursor: 'pointer',
      textAlign: 'left',
      marginBottom: '0.5rem',
    }}
  >
    <div
      style={{
        fontWeight: 600,
        fontSize: '0.9375rem',
        marginBottom: '0.25rem',
        color: '#111827',
      }}
    >
      {item.issue.title}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
      {item.changedDirectories.map((dir) => (
        <span
          key={dir}
          style={{
            fontSize: '0.75rem',
            padding: '0.125rem 0.5rem',
            background: '#f3f4f6',
            color: '#6b7280',
            borderRadius: '999px',
            fontFamily: 'monospace',
          }}
        >
          {dir}
        </span>
      ))}
    </div>
  </button>
);

export const ListView = ({
  stories,
  items,
  doneSet,
  onSelectPr,
}: ListViewProps): React.JSX.Element => {
  const pending = items.filter(
    (item) => !doneSet.has(buildPrKey(item.pr.repo, item.pr.number)),
  );
  const grouped = groupByStory(items, stories, doneSet);

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          PR Review
        </h1>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          {pending.length} / {items.length}
        </span>
      </div>

      {grouped.map(({ story, items: storyItems }) => (
        <div key={story.name} style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <span
              style={{
                width: '0.625rem',
                height: '0.625rem',
                borderRadius: '50%',
                backgroundColor: story.color,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
              }}
            >
              {story.name}
            </span>
          </div>
          {storyItems.map((item) => (
            <PrCard
              key={`${item.pr.repo}-${item.pr.number}`}
              item={item}
              onSelect={onSelectPr}
            />
          ))}
        </div>
      ))}

      {pending.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          All PRs have been reviewed.
        </div>
      )}
    </div>
  );
};
