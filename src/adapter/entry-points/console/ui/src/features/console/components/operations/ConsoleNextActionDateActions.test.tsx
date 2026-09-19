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
    expect(getByText('+1h')).toBeInTheDocument();
    expect(getByText('+3h')).toBeInTheDocument();
    expect(getByText('+6h')).toBeInTheDocument();
    expect(getByText('+1d')).toBeInTheDocument();
    expect(getByText('+2d')).toBeInTheDocument();
    expect(getByText('+3d')).toBeInTheDocument();
    expect(getByText('+5d')).toBeInTheDocument();
    expect(getByText('+1w')).toBeInTheDocument();
    expect(getByText('+1mo')).toBeInTheDocument();
    expect(queryByText('+1w skip')).toBeNull();
  });

  it('shows +1w skip on manual triage tabs', () => {
    const { getByText } = render(
      <ConsoleNextActionDateActions
        isManualTriage
        onSetNextActionDate={() => {}}
      />,
    );
    expect(getByText('+1w skip')).toBeInTheDocument();
  });

  it('reports all snooze actions', () => {
    const onSetNextActionDate = jest.fn();
    const { getByText } = render(
      <ConsoleNextActionDateActions
        isManualTriage={false}
        onSetNextActionDate={onSetNextActionDate}
      />,
    );
    fireEvent.click(getByText('+1h'));
    fireEvent.click(getByText('+3h'));
    fireEvent.click(getByText('+6h'));
    fireEvent.click(getByText('+1d'));
    fireEvent.click(getByText('+2d'));
    fireEvent.click(getByText('+3d'));
    fireEvent.click(getByText('+5d'));
    fireEvent.click(getByText('+1w'));
    fireEvent.click(getByText('+1mo'));
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
