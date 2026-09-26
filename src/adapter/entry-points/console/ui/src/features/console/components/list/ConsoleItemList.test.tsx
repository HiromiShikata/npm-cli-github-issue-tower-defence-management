import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { colorFromEnum } from '../../logic/colors';
import { buildConsoleListRows } from '../../logic/grouping';
import type {
  ConsoleListItem,
  ConsoleStoryColorSource,
} from '../../logic/types';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleItemList } from './ConsoleItemList';

const rows = buildConsoleListRows(consoleListItemsFixture, {}, []);
const now = Date.parse('2026-06-19T12:00:00.000Z');

const buildStoryOptionIdKeyingItem = (
  overrides: Partial<ConsoleListItem>,
): ConsoleListItem => ({
  number: 1,
  title: 'Story option id keying fixture item',
  url: 'https://github.com/o/r/issues/1',
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: 'PVTI_story-option-id-keying',
  itemId: 'PVTI_story-option-id-keying',
  isPr: false,
  relatedOpenPullRequestUrls: [],
  story: 'Duplicate Story Name',
  status: null,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-19T00:00:00.000Z',
  ...overrides,
});

describe('ConsoleItemList', () => {
  it('renders group headers and items in array order', () => {
    const { getAllByRole, container } = render(
      <ConsoleItemList
        rows={rows}
        storyColors={consoleStoryColorsFixture}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    const groupHeaderTexts = Array.from(
      container.querySelectorAll('.console-group-header'),
    ).map((header) => header.textContent ?? '');
    expect(
      groupHeaderTexts.some((text) => text.includes('TDPM Console port')),
    ).toBe(true);
    expect(
      groupHeaderTexts.some((text) =>
        text.includes('regular / workflow improvement'),
      ),
    ).toBe(true);
    expect(getAllByRole('button').length).toBe(consoleListItemsFixture.length);
  });

  it('reports the selected item', () => {
    const onSelectItem = jest.fn();
    const { getByText } = render(
      <ConsoleItemList
        rows={rows}
        storyColors={consoleStoryColorsFixture}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={onSelectItem}
      />,
    );
    fireEvent.click(
      getByText('Add serveConsole subcommand under entry-points'),
    );
    expect(onSelectItem).toHaveBeenCalledWith(consoleListItemsFixture[0]);
  });

  it('shows the loading state', () => {
    const { getByText } = render(
      <ConsoleItemList
        rows={[]}
        storyColors={{}}
        activeItemId={null}
        now={now}
        isLoading
        error={null}
        onSelectItem={() => {}}
      />,
    );
    expect(getByText('Loading list...')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    const { getByText } = render(
      <ConsoleItemList
        rows={[]}
        storyColors={{}}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    expect(getByText('No items')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    const { getByRole } = render(
      <ConsoleItemList
        rows={[]}
        storyColors={{}}
        activeItemId={null}
        now={now}
        isLoading={false}
        error="HTTP 404"
        onSelectItem={() => {}}
      />,
    );
    expect(getByRole('alert')).toHaveTextContent('HTTP 404');
  });

  it('renders the ok & Awaiting Workspace button for each item when onOkAndAwaitingWorkspace is provided', () => {
    const prsItems = consoleListItemsFixture.filter((item) => item.isPr);
    const prsRows = buildConsoleListRows(prsItems, {}, []);
    const onOkAndAwaitingWorkspace = jest.fn();
    const { getAllByRole } = render(
      <ConsoleItemList
        rows={prsRows}
        storyColors={consoleStoryColorsFixture}
        statusOptions={consoleStatusOptionsFixture}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
        onOkAndAwaitingWorkspace={onOkAndAwaitingWorkspace}
      />,
    );
    const buttons = getAllByRole('button');
    expect(buttons.length).toBe(prsItems.length * 2);
  });

  it('calls onOkAndAwaitingWorkspace with the item and option when the action button is clicked', () => {
    const singleItem = consoleListItemsFixture[0];
    const singleRow = buildConsoleListRows([singleItem], {}, []);
    const onOkAndAwaitingWorkspace = jest.fn();
    const { getAllByRole } = render(
      <ConsoleItemList
        rows={singleRow}
        storyColors={consoleStoryColorsFixture}
        statusOptions={consoleStatusOptionsFixture}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
        onOkAndAwaitingWorkspace={onOkAndAwaitingWorkspace}
      />,
    );
    const buttons = getAllByRole('button');
    const actionButton = buttons[1];
    fireEvent.click(actionButton);
    expect(onOkAndAwaitingWorkspace).toHaveBeenCalledTimes(1);
    expect(onOkAndAwaitingWorkspace.mock.calls[0][0]).toEqual(singleItem);
    expect(onOkAndAwaitingWorkspace.mock.calls[0][1].name).toBe(
      'Awaiting Workspace',
    );
  });

  it('renders executive summary text in each list row when executiveSummaries is provided', () => {
    const singleItem = consoleListItemsFixture[0];
    const singleRow = buildConsoleListRows([singleItem], {}, []);
    const summary =
      'タスクのゴール: OK ボタンを追加する\n残りの作業と判断: なし';
    const { container } = render(
      <ConsoleItemList
        rows={singleRow}
        storyColors={consoleStoryColorsFixture}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
        executiveSummaries={{ [singleItem.projectItemId]: summary }}
      />,
    );
    const el = container.querySelector('.console-item-executive-summary');
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe(summary);
  });

  it('does not render action buttons when onOkAndAwaitingWorkspace is omitted', () => {
    const { getAllByRole } = render(
      <ConsoleItemList
        rows={rows}
        storyColors={consoleStoryColorsFixture}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    expect(getAllByRole('button').length).toBe(consoleListItemsFixture.length);
  });

  it('declares only border-bottom on console-list-row so that list items stack vertically rather than appearing side-by-side', () => {
    const css = readFileSync(join(__dirname, '../../../../index.css'), 'utf-8');
    const match = css.match(/\.console-list-row\s*\{([^}]+)\}/);
    const ruleBlock = match ? match[1] : null;
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock?.trim().replace(/\s+/g, ' ')).toBe(
      'border-bottom: 1px solid #21262d;',
    );
  });

  it('renders a distinct, correctly-resolved color for each group header when two story options share the same display name', () => {
    const itemForOptionA = buildStoryOptionIdKeyingItem({
      itemId: 'item-a',
      projectItemId: 'item-a',
      title: 'Item under story option A',
      storyOptionId: 'story-option-a',
    });
    const itemForOptionB = buildStoryOptionIdKeyingItem({
      itemId: 'item-b',
      projectItemId: 'item-b',
      title: 'Item under story option B',
      storyOptionId: 'story-option-b',
    });
    const collidingRows = buildConsoleListRows(
      [itemForOptionA, itemForOptionB],
      {},
      [],
    );
    const storyColorsById: ConsoleStoryColorSource = {
      'story-option-a': { color: 'BLUE' },
      'story-option-b': { color: 'RED' },
    };
    const { container } = render(
      <ConsoleItemList
        rows={collidingRows}
        storyColors={storyColorsById}
        activeItemId={null}
        now={now}
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
    expect(headerTexts[0]).toContain('Duplicate Story Name');
    expect(headerTexts[1]).toContain('Duplicate Story Name');
    const counts = Array.from(headers).map(
      (header) => header.querySelector('.console-group-count')?.textContent,
    );
    expect(counts).toEqual(['1', '1']);
    const dotA = headers[0].querySelector('.console-story-dot') as HTMLElement;
    const dotB = headers[1].querySelector('.console-story-dot') as HTMLElement;
    expect(dotA).toHaveStyle({ backgroundColor: colorFromEnum('BLUE').dot });
    expect(dotB).toHaveStyle({ backgroundColor: colorFromEnum('RED').dot });
    expect(dotA.style.backgroundColor).not.toBe(dotB.style.backgroundColor);
  });

  it('renders the group header with the story name-matched color when the item has no resolvable storyOptionId', () => {
    const itemWithoutStoryOptionId = buildStoryOptionIdKeyingItem({
      itemId: 'item-without-story-option-id',
      projectItemId: 'item-without-story-option-id',
      title: 'Item without a resolvable story option id',
      story: 'Duplicate Story Name',
      storyOptionId: null,
    });
    const itemWithResolvedStoryOptionId = buildStoryOptionIdKeyingItem({
      itemId: 'item-with-resolved-story-option-id',
      projectItemId: 'item-with-resolved-story-option-id',
      title: 'Item with a resolved story option id',
      story: 'Another Story',
      storyOptionId: 'story-option-a',
    });
    const rowsWithNullStoryOptionId = buildConsoleListRows(
      [itemWithoutStoryOptionId, itemWithResolvedStoryOptionId],
      {},
      [],
    );
    const storyColorsById: ConsoleStoryColorSource = {
      'story-option-a': { color: 'BLUE' },
      'Duplicate Story Name': { color: 'YELLOW' },
    };
    const { container } = render(
      <ConsoleItemList
        rows={rowsWithNullStoryOptionId}
        storyColors={storyColorsById}
        activeItemId={null}
        now={now}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    const headers = container.querySelectorAll('.console-list-group');
    expect(headers.length).toBe(2);
    const nullOptionHeader = Array.from(headers).find((header) =>
      header.textContent?.includes('Duplicate Story Name'),
    ) as HTMLElement;
    const resolvedOptionHeader = Array.from(headers).find((header) =>
      header.textContent?.includes('Another Story'),
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
      backgroundColor: colorFromEnum('BLUE').dot,
    });
    expect(nullOptionDot.style.backgroundColor).not.toBe(
      resolvedOptionDot.style.backgroundColor,
    );
    expect(nullOptionDot.style.backgroundColor).not.toBe(
      colorFromEnum(null).dot,
    );
  });

  it('renders the group header with the story name-matched color when the item has storyOptionId omitted (undefined)', () => {
    const itemWithUndefinedStoryOptionId = buildStoryOptionIdKeyingItem({
      itemId: 'item-undefined-story-option-id',
      projectItemId: 'item-undefined-story-option-id',
      title: 'Item with storyOptionId omitted',
      story: 'Some Known Story',
    });
    const rowsWithUndefinedStoryOptionId = buildConsoleListRows(
      [itemWithUndefinedStoryOptionId],
      {},
      [],
    );
    const storyColorsById: ConsoleStoryColorSource = {
      'story-option-other': { color: 'RED' },
      'Some Known Story': { color: 'PURPLE' },
    };
    const { container } = render(
      <ConsoleItemList
        rows={rowsWithUndefinedStoryOptionId}
        storyColors={storyColorsById}
        activeItemId={null}
        now={now}
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
