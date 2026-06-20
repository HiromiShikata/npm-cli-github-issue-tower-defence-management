import { fireEvent, render } from '@testing-library/react';
import { ConsoleNextActionDateGroup } from './ConsoleNextActionDateGroup';

describe('ConsoleNextActionDateGroup', () => {
  it('shows +1 day and +1 week outside the todo-by-human tab', () => {
    const { getByText, queryByText } = render(
      <ConsoleNextActionDateGroup
        isTodoByHuman={false}
        onSetNextActionDate={() => {}}
      />,
    );
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(getByText('+1 week')).toBeInTheDocument();
    expect(queryByText('+1 week and skip')).toBeNull();
  });

  it('shows +1 week and skip on the todo-by-human tab', () => {
    const { getByText } = render(
      <ConsoleNextActionDateGroup
        isTodoByHuman
        onSetNextActionDate={() => {}}
      />,
    );
    expect(getByText('+1 week and skip')).toBeInTheDocument();
  });

  it('reports the snooze actions', () => {
    const onSetNextActionDate = jest.fn();
    const { getByText } = render(
      <ConsoleNextActionDateGroup
        isTodoByHuman={false}
        onSetNextActionDate={onSetNextActionDate}
      />,
    );
    fireEvent.click(getByText('+1 day'));
    fireEvent.click(getByText('+1 week'));
    expect(onSetNextActionDate.mock.calls.map((call) => call[0])).toEqual([
      'snooze_1day',
      'snooze_1week',
    ]);
  });
});
