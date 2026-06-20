import { fireEvent, render } from '@testing-library/react';
import {
  consoleListItemsFixture,
  consoleStoryColorsFixture,
} from '../fixtures';
import { buildConsoleListRows } from '../grouping';
import { ConsoleListView } from './ConsoleListView';

const rows = buildConsoleListRows(consoleListItemsFixture, {});

describe('ConsoleListView', () => {
  it('renders group headers and items in array order', () => {
    const { getAllByRole, getByText } = render(
      <ConsoleListView
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
      <ConsoleListView
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
      <ConsoleListView
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
      <ConsoleListView
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
      <ConsoleListView
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
