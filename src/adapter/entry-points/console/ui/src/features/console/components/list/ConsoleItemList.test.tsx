import { fireEvent, render } from '@testing-library/react';
import { buildConsoleListRows } from '../../logic/grouping';
import {
  consoleListItemsFixture,
  consoleStoryColorsFixture,
} from '../../testing/fixtures';
import { ConsoleItemList } from './ConsoleItemList';

const rows = buildConsoleListRows(consoleListItemsFixture, {});

describe('ConsoleItemList', () => {
  it('renders group headers and items in array order', () => {
    const { getAllByRole, getByText } = render(
      <ConsoleItemList
        rows={rows}
        storyColors={consoleStoryColorsFixture}
        activeItemId={null}
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText('regular / workflow improvement')).toBeInTheDocument();
    expect(getAllByRole('button').length).toBe(consoleListItemsFixture.length);
  });

  it('reports the selected item', () => {
    const onSelectItem = jest.fn();
    const { getByText } = render(
      <ConsoleItemList
        rows={rows}
        storyColors={consoleStoryColorsFixture}
        activeItemId={null}
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
        isLoading={false}
        error={null}
        onSelectItem={() => {}}
      />,
    );
    expect(getByText('No items.')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    const { getByRole } = render(
      <ConsoleItemList
        rows={[]}
        storyColors={{}}
        activeItemId={null}
        isLoading={false}
        error="HTTP 404"
        onSelectItem={() => {}}
      />,
    );
    expect(getByRole('alert')).toHaveTextContent('HTTP 404');
  });
});
