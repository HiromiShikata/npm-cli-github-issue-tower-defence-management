import { fireEvent, render } from '@testing-library/react';
import { formatFullTimestamp } from '../../logic/relativeTime';
import { consoleListItemsFixture } from '../../testing/fixtures';
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
});
