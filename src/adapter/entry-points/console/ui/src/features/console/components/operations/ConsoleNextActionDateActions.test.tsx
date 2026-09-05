import { fireEvent, render } from '@testing-library/react';
import { ConsoleNextActionDateActions } from './ConsoleNextActionDateActions';

describe('ConsoleNextActionDateActions', () => {
  it('shows all snooze buttons outside manual triage tabs', () => {
    const { getByText, queryByText } = render(
      <ConsoleNextActionDateActions
        isManualTriage={false}
        onSetNextActionDate={() => {}}
      />,
    );
    expect(getByText('+1 hour')).toBeInTheDocument();
    expect(getByText('+3 hours')).toBeInTheDocument();
    expect(getByText('+6 hours')).toBeInTheDocument();
    expect(getByText('+1 day')).toBeInTheDocument();
    expect(getByText('+2 days')).toBeInTheDocument();
    expect(getByText('+3 days')).toBeInTheDocument();
    expect(getByText('+5 days')).toBeInTheDocument();
    expect(getByText('+1 week')).toBeInTheDocument();
    expect(getByText('+1 month')).toBeInTheDocument();
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

  it('reports all snooze actions', () => {
    const onSetNextActionDate = jest.fn();
    const { getByText } = render(
      <ConsoleNextActionDateActions
        isManualTriage={false}
        onSetNextActionDate={onSetNextActionDate}
      />,
    );
    fireEvent.click(getByText('+1 hour'));
    fireEvent.click(getByText('+3 hours'));
    fireEvent.click(getByText('+6 hours'));
    fireEvent.click(getByText('+1 day'));
    fireEvent.click(getByText('+2 days'));
    fireEvent.click(getByText('+3 days'));
    fireEvent.click(getByText('+5 days'));
    fireEvent.click(getByText('+1 week'));
    fireEvent.click(getByText('+1 month'));
    expect(onSetNextActionDate.mock.calls.map((call) => call[0])).toEqual([
      'snooze_1hour',
      'snooze_3hours',
      'snooze_6hours',
      'snooze_1day',
      'snooze_2days',
      'snooze_3days',
      'snooze_5days',
      'snooze_1week',
      'snooze_1month',
    ]);
  });
});
