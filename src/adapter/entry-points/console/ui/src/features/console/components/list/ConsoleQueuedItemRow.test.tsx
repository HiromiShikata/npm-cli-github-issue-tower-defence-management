import { fireEvent, render } from '@testing-library/react';
import {
  consoleAgentOptionsFixture,
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleQueuedItemRow } from './ConsoleQueuedItemRow';

const awaitingWorkspaceItem = {
  ...consoleListItemsFixture[1],
  status: 'Awaiting Workspace',
  agent: null,
  dependedIssueUrls: [],
};
const preparationWithAgentItem = consoleListItemsFixture[5];

describe('ConsoleQueuedItemRow', () => {
  it('renders the item title', () => {
    const { getByText } = render(
      <ConsoleQueuedItemRow
        item={awaitingWorkspaceItem}
        isActive={false}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        onSelect={() => {}}
      />,
    );
    expect(getByText(awaitingWorkspaceItem.title)).toBeInTheDocument();
  });

  it('renders the status badge with Project V2 color', () => {
    const { getByText } = render(
      <ConsoleQueuedItemRow
        item={awaitingWorkspaceItem}
        isActive={false}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        onSelect={() => {}}
      />,
    );
    const badge = getByText('Awaiting Workspace');
    expect(badge.style.backgroundColor).toBe('rgba(56, 139, 253, 0.1)');
  });

  it('renders the agent badge when the item has an agent', () => {
    const { getByText } = render(
      <ConsoleQueuedItemRow
        item={preparationWithAgentItem}
        isActive={false}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        onSelect={() => {}}
      />,
    );
    expect(getByText('developer')).toBeInTheDocument();
  });

  it('omits the agent badge when agent is null', () => {
    const { queryByText } = render(
      <ConsoleQueuedItemRow
        item={awaitingWorkspaceItem}
        isActive={false}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        onSelect={() => {}}
      />,
    );
    expect(queryByText('developer')).not.toBeInTheDocument();
  });

  it('calls onSelect with the item on click', () => {
    const onSelect = jest.fn();
    const { getByRole } = render(
      <ConsoleQueuedItemRow
        item={awaitingWorkspaceItem}
        isActive={false}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(awaitingWorkspaceItem);
  });

  it('marks the active row with data-active', () => {
    const { getByRole } = render(
      <ConsoleQueuedItemRow
        item={awaitingWorkspaceItem}
        isActive
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        onSelect={() => {}}
      />,
    );
    expect(getByRole('button')).toHaveAttribute('data-active', 'true');
  });

  it('renders the right-side actions placeholder for future buttons', () => {
    const { container } = render(
      <ConsoleQueuedItemRow
        item={awaitingWorkspaceItem}
        isActive={false}
        statusOptions={consoleStatusOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        onSelect={() => {}}
      />,
    );
    expect(
      container.querySelector('.console-queued-item-actions'),
    ).toBeInTheDocument();
  });
});
