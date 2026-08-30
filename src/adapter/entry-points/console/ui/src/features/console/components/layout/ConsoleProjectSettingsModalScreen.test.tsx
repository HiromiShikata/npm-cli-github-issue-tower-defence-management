import { fireEvent, render, screen } from '@testing-library/react';
import { ConsoleProjectSettingsModalScreen } from './ConsoleProjectSettingsModalScreen';

const baseProps = {
  value: '5',
  onChange: jest.fn(),
  isLoading: false,
  isSaving: false,
  error: null,
  onSave: jest.fn(),
  onClose: jest.fn(),
};

describe('ConsoleProjectSettingsModalScreen', () => {
  it('shows the current maximumPreparingIssuesCount value', () => {
    render(<ConsoleProjectSettingsModalScreen {...baseProps} />);
    const input = screen.getByLabelText('Maximum preparing issues count');
    expect((input as HTMLInputElement).value).toBe('5');
  });

  it('shows an empty input when no current value is set', () => {
    render(<ConsoleProjectSettingsModalScreen {...baseProps} value="" />);
    const input = screen.getByLabelText('Maximum preparing issues count');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('calls onChange with the new string value when the user types', () => {
    const onChange = jest.fn();
    render(
      <ConsoleProjectSettingsModalScreen {...baseProps} onChange={onChange} />,
    );
    const input = screen.getByLabelText('Maximum preparing issues count');
    fireEvent.change(input, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith('10');
  });

  it('calls onSave with the parsed count when Save is clicked', () => {
    const onSave = jest.fn();
    render(
      <ConsoleProjectSettingsModalScreen
        {...baseProps}
        value="8"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByLabelText('Save settings'));
    expect(onSave).toHaveBeenCalledWith(8);
  });

  it('disables Save when the value is empty', () => {
    render(<ConsoleProjectSettingsModalScreen {...baseProps} value="" />);
    expect(screen.getByLabelText('Save settings')).toBeDisabled();
  });

  it('disables Save when isSaving is true', () => {
    render(
      <ConsoleProjectSettingsModalScreen {...baseProps} isSaving={true} />,
    );
    expect(screen.getByLabelText('Save settings')).toBeDisabled();
  });

  it('shows a loading state when isLoading is true', () => {
    render(
      <ConsoleProjectSettingsModalScreen {...baseProps} isLoading={true} />,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Maximum preparing issues count'),
    ).toBeNull();
  });

  it('displays the error message when an error is present', () => {
    render(
      <ConsoleProjectSettingsModalScreen
        {...baseProps}
        error="Failed to save"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <ConsoleProjectSettingsModalScreen {...baseProps} onClose={onClose} />,
    );
    fireEvent.click(screen.getByLabelText('Close project settings'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays the value from the value prop on rerender', () => {
    const { rerender } = render(
      <ConsoleProjectSettingsModalScreen {...baseProps} value="3" />,
    );
    let input = screen.getByLabelText('Maximum preparing issues count');
    expect((input as HTMLInputElement).value).toBe('3');
    rerender(<ConsoleProjectSettingsModalScreen {...baseProps} value="9" />);
    input = screen.getByLabelText('Maximum preparing issues count');
    expect((input as HTMLInputElement).value).toBe('9');
  });
});
