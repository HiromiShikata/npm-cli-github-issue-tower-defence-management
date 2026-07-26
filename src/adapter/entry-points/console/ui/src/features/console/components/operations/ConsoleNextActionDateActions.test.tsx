import { fireEvent, render } from '@testing-library/react';
import { ConsoleNextActionDateActions } from './ConsoleNextActionDateActions';

describe('ConsoleNextActionDateActions', () => {
  it('shows +1 day and +1 week outside manual triage tabs', () => {
    const { getByText, queryByText } = render(
      <ConsoleNextActionDateActions
        isManualTriage={false}
        onSetNextActionDate={() => {}}
      />,
    );
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(getByText('+1 week')).toBeInTheDocument();
    expect(queryByText('+1 week and skip')).toBeNull();
  });

  it('shows +1 week and skip on manual triage tabs', () => {
    const { getByText } = render(
      <ConsoleNextActionDateActions
        isManualTriage
        onSetNextActionDate={() => {}}
      />,
    );
    expect(getByText('+1 week and skip')).toBeInTheDocument();
  });

  it('reports the snooze actions', () => {
    const onSetNextActionDate = jest.fn();
    const { getByText } = render(
      <ConsoleNextActionDateActions
        isManualTriage={false}
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
