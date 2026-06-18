import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { consoleListItemsFixture } from '../fixtures';
import { ConsoleListView } from './ConsoleListView';

const storyColors = {
  'TDPM Console port': 'BLUE' as const,
  'regular / workflow improvement': 'GREEN' as const,
};

describe('ConsoleListView', () => {
  it('renders a story group header per story with the group count', () => {
    render(
      <ConsoleListView
        items={consoleListItemsFixture}
        storyColors={storyColors}
        selectedItemId={null}
        onSelectItem={() => undefined}
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.getByText('TDPM Console port')).toBeInTheDocument();
    expect(
      screen.getByText('regular / workflow improvement'),
    ).toBeInTheDocument();
  });

  it('invokes onSelectItem with the clicked item', async () => {
    const onSelectItem = jest.fn();
    render(
      <ConsoleListView
        items={consoleListItemsFixture}
        storyColors={storyColors}
        selectedItemId={null}
        onSelectItem={onSelectItem}
        isLoading={false}
        error={null}
      />,
    );
    await userEvent.click(screen.getByText(consoleListItemsFixture[0].title));
    expect(onSelectItem).toHaveBeenCalledWith(consoleListItemsFixture[0]);
  });

  it('shows the loading state', () => {
    render(
      <ConsoleListView
        items={[]}
        storyColors={storyColors}
        selectedItemId={null}
        onSelectItem={() => undefined}
        isLoading
        error={null}
      />,
    );
    expect(screen.getByText('Loading list…')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    render(
      <ConsoleListView
        items={[]}
        storyColors={storyColors}
        selectedItemId={null}
        onSelectItem={() => undefined}
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.getByText('No items in this tab.')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    render(
      <ConsoleListView
        items={[]}
        storyColors={storyColors}
        selectedItemId={null}
        onSelectItem={() => undefined}
        isLoading={false}
        error="HTTP 404"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 404');
  });
});
