import { fireEvent, render } from '@testing-library/react';
import { consoleListItemsFixture } from '../fixtures';
import { ConsoleListItemRow } from './ConsoleListItemRow';

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

describe('ConsoleListItemRow', () => {
  it('renders a PR number with the PR prefix', () => {
    const { getByText } = render(
      <ConsoleListItemRow item={prItem} isActive={false} onSelect={() => {}} />,
    );
    expect(getByText(`PR #${prItem.number}`)).toBeInTheDocument();
    expect(getByText(prItem.title)).toBeInTheDocument();
  });

  it('renders an issue number with the hash prefix', () => {
    const { getByText } = render(
      <ConsoleListItemRow
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
      <ConsoleListItemRow item={prItem} isActive={false} onSelect={onSelect} />,
    );
    fireEvent.click(getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(prItem);
  });

  it('marks the active row', () => {
    const { getByRole } = render(
      <ConsoleListItemRow item={prItem} isActive onSelect={() => {}} />,
    );
    expect(getByRole('button')).toHaveAttribute('data-active', 'true');
  });
});
