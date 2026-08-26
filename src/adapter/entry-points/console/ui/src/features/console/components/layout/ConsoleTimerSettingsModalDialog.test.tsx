import { fireEvent, render } from '@testing-library/react';
import { ConsoleTimerSettingsModalDialog } from './ConsoleTimerSettingsModalDialog';

const baseProps = {
  isOpen: false,
  timerMode: false,
  projectMinutes: {},
  pjcodes: ['alpha', 'beta', 'gamma'],
  isLoadingPjcodes: false,
  onOpen: jest.fn(),
  onToggleTimerMode: jest.fn(),
  onChangeMinutes: jest.fn(),
  onSave: jest.fn(),
  onClose: jest.fn(),
};

describe('ConsoleTimerSettingsModalDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the gear button when the dialog is closed', () => {
    const { getByRole, queryByRole } = render(
      <ConsoleTimerSettingsModalDialog {...baseProps} isOpen={false} />,
    );
    expect(
      getByRole('button', { name: 'Console Settings' }),
    ).toBeInTheDocument();
    expect(queryByRole('dialog')).toBeNull();
  });

  it('renders the gear button when the dialog is open', () => {
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog {...baseProps} isOpen={true} />,
    );
    expect(
      getByRole('button', { name: 'Console Settings' }),
    ).toBeInTheDocument();
  });

  it('calls onOpen when the gear button is clicked', () => {
    const onOpen = jest.fn();
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={false}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Console Settings' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders the dialog when isOpen is true', () => {
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog {...baseProps} isOpen={true} />,
    );
    expect(getByRole('dialog')).toBeInTheDocument();
    expect(getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Console Settings',
    );
  });

  it('shows loading state when isLoadingPjcodes is true', () => {
    const { getByText, queryByRole } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        isLoadingPjcodes={true}
      />,
    );
    expect(getByText('Loading projects...')).toBeInTheDocument();
    expect(queryByRole('list')).toBeNull();
  });

  it('renders per-project minute inputs when loaded', () => {
    const { getByLabelText } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        pjcodes={['alpha', 'beta']}
        projectMinutes={{ alpha: 5, beta: 0 }}
      />,
    );
    expect(getByLabelText('alpha')).toHaveValue(5);
    expect(getByLabelText('beta')).toHaveValue(0);
  });

  it('shows "Skip" label for projects with 0 minutes', () => {
    const { getAllByText, queryByText } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        pjcodes={['alpha', 'beta']}
        projectMinutes={{ alpha: 5, beta: 0 }}
      />,
    );
    expect(getAllByText('Skip')).toHaveLength(1);
    expect(queryByText('min')).toBeInTheDocument();
  });

  it('calls onSave when "Save and Close" is clicked', () => {
    const onSave = jest.fn();
    const { getByText } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        onSave={onSave}
      />,
    );
    fireEvent.click(getByText('Save and Close'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleTimerMode when the timer mode checkbox is changed', () => {
    const onToggleTimerMode = jest.fn();
    const { getByLabelText } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        timerMode={false}
        onToggleTimerMode={onToggleTimerMode}
      />,
    );
    fireEvent.click(getByLabelText('Timer Mode'));
    expect(onToggleTimerMode).toHaveBeenCalledWith(true);
  });

  it('calls onChangeMinutes when a minutes input changes', () => {
    const onChangeMinutes = jest.fn();
    const { getByLabelText } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        pjcodes={['alpha']}
        projectMinutes={{ alpha: 5 }}
        onChangeMinutes={onChangeMinutes}
      />,
    );
    fireEvent.change(getByLabelText('alpha'), { target: { value: '10' } });
    expect(onChangeMinutes).toHaveBeenCalledWith('alpha', 10);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
