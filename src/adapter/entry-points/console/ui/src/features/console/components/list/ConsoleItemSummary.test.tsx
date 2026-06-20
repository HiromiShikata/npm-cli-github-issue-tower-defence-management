import { fireEvent, render } from '@testing-library/react';
import { consoleListItemsFixture } from '../../testing/fixtures';
import { ConsoleItemSummary } from './ConsoleItemSummary';

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

describe('ConsoleItemSummary', () => {
  it('renders a PR number with the PR prefix', () => {
    const { getByText } = render(
      <ConsoleItemSummary item={prItem} isActive={false} onSelect={() => {}} />,
    );
    expect(getByText(`PR #${prItem.number}`)).toBeInTheDocument();
    expect(getByText(prItem.title)).toBeInTheDocument();
  });

  it('renders an issue number with the hash prefix', () => {
    const { getByText } = render(
      <ConsoleItemSummary
        item={issueItem}
        isActive={false}
        onSelect={() => {}}
      />,
    );
    expect(getByText(`#${issueItem.number}`)).toBeInTheDocument();
  });

  it('reports the item on click', () => {
    const onSelect = jest.fn();
    const { getByRole } = render(
      <ConsoleItemSummary item={prItem} isActive={false} onSelect={onSelect} />,
    );
    fireEvent.click(getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(prItem);
  });

  it('marks the active row', () => {
    const { getByRole } = render(
      <ConsoleItemSummary item={prItem} isActive onSelect={() => {}} />,
    );
    expect(getByRole('button')).toHaveAttribute('data-active', 'true');
  });
});
