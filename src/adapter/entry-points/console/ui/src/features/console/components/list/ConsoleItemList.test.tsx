import { fireEvent, render } from '@testing-library/react';
import { buildConsoleListRows } from '../../logic/grouping';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleItemList } from './ConsoleItemList';

const rows = buildConsoleListRows(consoleListItemsFixture, {}, []);
const now = Date.parse('2026-06-19T12:00:00.000Z');

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

  it('renders executive summary text inside each item card when executiveSummaries is provided', () => {
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
});
