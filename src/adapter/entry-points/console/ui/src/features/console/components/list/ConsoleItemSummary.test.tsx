import { fireEvent, render } from '@testing-library/react';
import { formatFullTimestamp } from '../../logic/relativeTime';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleItemSummary } from './ConsoleItemSummary';

const now = Date.parse('2026-06-19T12:00:00.000Z');
const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

describe('ConsoleItemSummary', () => {
  it('renders the number, repository and PR type pills for a pull request', () => {
    const { getByText } = render(
      <ConsoleItemSummary
        item={prItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(getByText(`#${prItem.number}`)).toBeInTheDocument();
    expect(getByText(prItem.repo)).toBeInTheDocument();
    expect(getByText('PR')).toBeInTheDocument();
    expect(getByText(prItem.title)).toBeInTheDocument();
  });

  it('renders the Issue type pill for an issue', () => {
    const { getByText } = render(
      <ConsoleItemSummary
        item={issueItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(getByText(`#${issueItem.number}`)).toBeInTheDocument();
    expect(getByText('Issue')).toBeInTheDocument();
  });

  it('renders the opened relative time with the full timestamp title', () => {
    const { getByText } = render(
      <ConsoleItemSummary
        item={prItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    const createdAt = getByText('2 days ago');
    expect(createdAt).toHaveAttribute(
      'title',
      formatFullTimestamp(prItem.createdAt),
    );
  });

  it('renders the story, status and depended issue url for a pull request', () => {
    const { getByText } = render(
      <ConsoleItemSummary
        item={prItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(getByText('Story')).toBeInTheDocument();
    expect(getByText(prItem.story)).toBeInTheDocument();
    expect(getByText('Status')).toBeInTheDocument();
    expect(getByText(prItem.status as string)).toBeInTheDocument();
    expect(getByText('Depended Issue URL')).toBeInTheDocument();
    expect(getByText(prItem.dependedIssueUrls.join(', '))).toBeInTheDocument();
  });

  it('renders the next action date and hour for an issue', () => {
    const { getByText, queryByText } = render(
      <ConsoleItemSummary
        item={issueItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(getByText('Next Action Date')).toBeInTheDocument();
    expect(
      getByText((issueItem.nextActionDate as string).slice(0, 10)),
    ).toBeInTheDocument();
    expect(getByText('Next Action Hour')).toBeInTheDocument();
    expect(getByText(String(issueItem.nextActionHour))).toBeInTheDocument();
    expect(queryByText('Depended Issue URL')).not.toBeInTheDocument();
  });

  it('omits the status field when the item has no status', () => {
    const itemWithoutStatus = { ...prItem, status: null };
    const { queryByText } = render(
      <ConsoleItemSummary
        item={itemWithoutStatus}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(queryByText('Status')).not.toBeInTheDocument();
  });

  it('reports the item on click', () => {
    const onSelect = jest.fn();
    const { getByRole } = render(
      <ConsoleItemSummary
        item={prItem}
        isActive={false}
        now={now}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(prItem);
  });

  it('marks the active row', () => {
    const { getByRole } = render(
      <ConsoleItemSummary
        item={prItem}
        isActive
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(getByRole('button')).toHaveAttribute('data-active', 'true');
  });

  it('renders the agent field next to status when agent is set', () => {
    const agentItem = { ...prItem, agent: 'developer' };
    const { getByText } = render(
      <ConsoleItemSummary
        item={agentItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(getByText('Agent')).toBeInTheDocument();
    expect(getByText('developer')).toBeInTheDocument();
  });

  it('renders the agent field when agent is set and no other fields are present', () => {
    const agentOnlyItem = {
      ...prItem,
      story: '',
      status: null,
      agent: 'developer',
      nextActionDate: null,
      nextActionHour: null,
      dependedIssueUrls: [],
    };
    const { getByText } = render(
      <ConsoleItemSummary
        item={agentOnlyItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(getByText('Agent')).toBeInTheDocument();
    expect(getByText('developer')).toBeInTheDocument();
  });

  it('omits the agent field when agent is null', () => {
    const noAgentItem = { ...prItem, agent: null };
    const { queryByText } = render(
      <ConsoleItemSummary
        item={noAgentItem}
        isActive={false}
        now={now}
        onSelect={() => {}}
      />,
    );
    expect(queryByText('Agent')).not.toBeInTheDocument();
  });

  it('applies the Project V2 status color from statusOptions to the status badge', () => {
    const awaitingWorkspaceItem = {
      ...prItem,
      status: 'Awaiting Workspace',
    };
    const { getByText } = render(
      <ConsoleItemSummary
        item={awaitingWorkspaceItem}
        isActive={false}
        now={now}
        statusOptions={consoleStatusOptionsFixture}
        onSelect={() => {}}
      />,
    );
    const badge = getByText('Awaiting Workspace');
    expect(badge.style.backgroundColor).toBe('rgba(56, 139, 253, 0.1)');
    expect(badge.style.color).toBe('rgb(56, 139, 253)');
  });

  it('applies gray color to the status badge when statusOptions is empty', () => {
    const { getByText } = render(
      <ConsoleItemSummary
        item={prItem}
        isActive={false}
        now={now}
        statusOptions={[]}
        onSelect={() => {}}
      />,
    );
    const badge = getByText(prItem.status as string);
    expect(badge.style.backgroundColor).toBe('rgba(110, 118, 129, 0.1)');
  });
});
