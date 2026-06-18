import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleNextActionDateGroup } from './ConsoleNextActionDateGroup';

describe('ConsoleNextActionDateGroup', () => {
  it('labels the week button as a plain snooze on non-todo tabs', () => {
    render(<ConsoleNextActionDateGroup tab="prs" onSnooze={() => undefined} />);
    expect(screen.getByText('+1 week')).toBeInTheDocument();
    expect(screen.queryByText('+1 week and skip')).toBeNull();
  });

  it('labels the week button as skip on the todo-by-human tab', () => {
    render(
      <ConsoleNextActionDateGroup
        tab="todo-by-human"
        onSnooze={() => undefined}
      />,
    );
    expect(screen.getByText('+1 week and skip')).toBeInTheDocument();
  });

  it('emits the snooze events on click', async () => {
    const onSnooze = jest.fn();
    render(<ConsoleNextActionDateGroup tab="prs" onSnooze={onSnooze} />);
    await userEvent.click(screen.getByText('+1 day'));
    await userEvent.click(screen.getByText('+1 week'));
    expect(onSnooze.mock.calls.map((call) => call[0])).toEqual([
      'snooze_1day',
      'snooze_1week',
    ]);
  });
});
