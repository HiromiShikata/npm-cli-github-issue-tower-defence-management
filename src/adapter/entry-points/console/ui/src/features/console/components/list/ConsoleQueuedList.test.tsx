import { fireEvent, render } from '@testing-library/react';
import { buildConsoleListRows } from '../../logic/grouping';
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
});
