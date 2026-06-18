import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { consoleListItemsFixture } from '../fixtures';
import { ConsoleItemRow } from './ConsoleItemRow';

describe('ConsoleItemRow', () => {
  it('renders the title, number, repo, and PR badge', () => {
    render(
      <ConsoleItemRow
        item={consoleListItemsFixture[0]}
        isSelected={false}
        onSelect={() => undefined}
      />,
    );
    expect(
      screen.getByText(consoleListItemsFixture[0].title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`#${consoleListItemsFixture[0].number}`),
    ).toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('marks the row pressed when selected', () => {
    render(
      <ConsoleItemRow
        item={consoleListItemsFixture[1]}
        isSelected
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('invokes onSelect with the item on click', async () => {
    const onSelect = jest.fn();
    render(
      <ConsoleItemRow
        item={consoleListItemsFixture[1]}
        isSelected={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(consoleListItemsFixture[1]);
  });
});
