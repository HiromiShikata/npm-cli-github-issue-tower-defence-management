import { fireEvent, render } from '@testing-library/react';
import { colorFromEnum } from '../../logic/colors';
import { buildConsoleListRows } from '../../logic/grouping';
import type {
  ConsoleListItem,
  ConsoleStoryColorSource,
} from '../../logic/types';
import {
  consoleAgentOptionsFixture,
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleQueuedList } from './ConsoleQueuedList';

const queuedItems = consoleListItemsFixture.filter(
  (item) =>
    (item.status === 'Awaiting Workspace' || item.status === 'Preparation') &&
    item.dependedIssueUrls.length === 0,
);
const rows = buildConsoleListRows(queuedItems, {}, []);

const buildStoryOptionIdKeyingQueuedItem = (
  overrides: Partial<ConsoleListItem>,
): ConsoleListItem => ({
  number: 1,
  title: 'Story option id keying queued fixture item',
  url: 'https://github.com/o/r/issues/1',
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: 'PVTI_queued-story-option-id-keying',
  itemId: 'PVTI_queued-story-option-id-keying',
  isPr: false,
  relatedOpenPullRequestUrls: [],
  story: 'Duplicate Queued Story Name',
  status: 'Awaiting Workspace',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-19T00:00:00.000Z',
  ...overrides,
});

describe('ConsoleQueuedList', () => {
  it('renders group headers and queued item rows', () => {
    const { container } = render(
      <ConsoleQueuedList
        rows={rows}
        storyColors={consoleStoryColorsFixture}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        activeItemId={null}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(queuedItems.length);
  });

  it('calls onSelectItem with the clicked item', () => {
    const onSelectItem = jest.fn();
    const { getByText } = render(
      <ConsoleQueuedList
        rows={rows}
        storyColors={consoleStoryColorsFixture}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        activeItemId={null}
        isLoading={false}
        error={null}
        onSelectItem={onSelectItem}
      />,
    );
    fireEvent.click(getByText(queuedItems[0].title));
    expect(onSelectItem).toHaveBeenCalledWith(queuedItems[0]);
  });

  it('shows the loading state', () => {
    const { getByText } = render(
      <ConsoleQueuedList
        rows={[]}
        storyColors={{}}
        statusOptions={[]}
        agentOptions={[]}
        activeItemId={null}
        isLoading
        error={null}
        onSelectItem={() => {}}
      />,
    );
    expect(getByText('Loading list...')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    const { getByText } = render(
      <ConsoleQueuedList
        rows={[]}
        storyColors={{}}
        statusOptions={[]}
        agentOptions={[]}
        activeItemId={null}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    expect(getByText('No items')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    const { getByRole } = render(
      <ConsoleQueuedList
        rows={[]}
        storyColors={{}}
        statusOptions={[]}
        agentOptions={[]}
        activeItemId={null}
        isLoading={false}
        error="HTTP 503"
        onSelectItem={() => {}}
      />,
    );
    expect(getByRole('alert')).toHaveTextContent('HTTP 503');
  });

  it('renders a distinct, correctly-resolved color for each group header when two story options share the same display name', () => {
    const itemForOptionA = buildStoryOptionIdKeyingQueuedItem({
      itemId: 'queued-item-a',
      projectItemId: 'queued-item-a',
      title: 'Queued item under story option A',
      storyOptionId: 'queued-story-option-a',
    });
    const itemForOptionB = buildStoryOptionIdKeyingQueuedItem({
      itemId: 'queued-item-b',
      projectItemId: 'queued-item-b',
      title: 'Queued item under story option B',
      storyOptionId: 'queued-story-option-b',
    });
    const collidingRows = buildConsoleListRows(
      [itemForOptionA, itemForOptionB],
      {},
      [],
    );
    const storyColorsById: ConsoleStoryColorSource = {
      'queued-story-option-a': { color: 'GREEN' },
      'queued-story-option-b': { color: 'ORANGE' },
    };
    const { container } = render(
      <ConsoleQueuedList
        rows={collidingRows}
        storyColors={storyColorsById}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        activeItemId={null}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    const headers = container.querySelectorAll('.console-list-group');
    expect(headers.length).toBe(2);
    const headerTexts = Array.from(headers).map(
      (header) => header.textContent ?? '',
    );
    expect(headerTexts[0]).toContain('Duplicate Queued Story Name');
    expect(headerTexts[1]).toContain('Duplicate Queued Story Name');
    const counts = Array.from(headers).map(
      (header) => header.querySelector('.console-group-count')?.textContent,
    );
    expect(counts).toEqual(['1', '1']);
    const dotA = headers[0].querySelector('.console-story-dot') as HTMLElement;
    const dotB = headers[1].querySelector('.console-story-dot') as HTMLElement;
    expect(dotA).toHaveStyle({ backgroundColor: colorFromEnum('GREEN').dot });
    expect(dotB).toHaveStyle({ backgroundColor: colorFromEnum('ORANGE').dot });
    expect(dotA.style.backgroundColor).not.toBe(dotB.style.backgroundColor);
  });

  it('renders the group header with the story name-matched color when the item has no resolvable storyOptionId', () => {
    const itemWithoutStoryOptionId = buildStoryOptionIdKeyingQueuedItem({
      itemId: 'queued-item-without-story-option-id',
      projectItemId: 'queued-item-without-story-option-id',
      title: 'Queued item without a resolvable story option id',
      story: 'Duplicate Queued Story Name',
      storyOptionId: null,
    });
    const itemWithResolvedStoryOptionId = buildStoryOptionIdKeyingQueuedItem({
      itemId: 'queued-item-with-resolved-story-option-id',
      projectItemId: 'queued-item-with-resolved-story-option-id',
      title: 'Queued item with a resolved story option id',
      story: 'Another Queued Story',
      storyOptionId: 'queued-story-option-a',
    });
    const rowsWithNullStoryOptionId = buildConsoleListRows(
      [itemWithoutStoryOptionId, itemWithResolvedStoryOptionId],
      {},
      [],
    );
    const storyColorsById: ConsoleStoryColorSource = {
      'queued-story-option-a': { color: 'GREEN' },
      'Duplicate Queued Story Name': { color: 'YELLOW' },
    };
    const { container } = render(
      <ConsoleQueuedList
        rows={rowsWithNullStoryOptionId}
        storyColors={storyColorsById}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        activeItemId={null}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    const headers = container.querySelectorAll('.console-list-group');
    expect(headers.length).toBe(2);
    const nullOptionHeader = Array.from(headers).find((header) =>
      header.textContent?.includes('Duplicate Queued Story Name'),
    ) as HTMLElement;
    const resolvedOptionHeader = Array.from(headers).find((header) =>
      header.textContent?.includes('Another Queued Story'),
    ) as HTMLElement;
    expect(nullOptionHeader).not.toBeUndefined();
    expect(resolvedOptionHeader).not.toBeUndefined();
    const nullOptionDot = nullOptionHeader.querySelector(
      '.console-story-dot',
    ) as HTMLElement;
    const resolvedOptionDot = resolvedOptionHeader.querySelector(
      '.console-story-dot',
    ) as HTMLElement;
    expect(nullOptionDot).toHaveStyle({
      backgroundColor: colorFromEnum('YELLOW').dot,
    });
    expect(resolvedOptionDot).toHaveStyle({
      backgroundColor: colorFromEnum('GREEN').dot,
    });
    expect(nullOptionDot.style.backgroundColor).not.toBe(
      resolvedOptionDot.style.backgroundColor,
    );
    expect(nullOptionDot.style.backgroundColor).not.toBe(
      colorFromEnum(null).dot,
    );
  });

  it('renders the group header with the story name-matched color when the item has storyOptionId omitted (undefined)', () => {
    const itemWithUndefinedStoryOptionId = buildStoryOptionIdKeyingQueuedItem({
      itemId: 'queued-item-undefined-story-option-id',
      projectItemId: 'queued-item-undefined-story-option-id',
      title: 'Queued item with storyOptionId omitted',
      story: 'Some Known Queued Story',
    });
    const rowsWithUndefinedStoryOptionId = buildConsoleListRows(
      [itemWithUndefinedStoryOptionId],
      {},
      [],
    );
    const storyColorsById: ConsoleStoryColorSource = {
      'queued-story-option-other': { color: 'RED' },
      'Some Known Queued Story': { color: 'PURPLE' },
    };
    const { container } = render(
      <ConsoleQueuedList
        rows={rowsWithUndefinedStoryOptionId}
        storyColors={storyColorsById}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        activeItemId={null}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    const header = container.querySelector('.console-list-group');
    expect(header).not.toBeNull();
    const dot = header?.querySelector('.console-story-dot') as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: colorFromEnum('PURPLE').dot });
    expect(dot.style.backgroundColor).not.toBe(colorFromEnum('RED').dot);
    expect(dot.style.backgroundColor).not.toBe(colorFromEnum(null).dot);
  });
});
