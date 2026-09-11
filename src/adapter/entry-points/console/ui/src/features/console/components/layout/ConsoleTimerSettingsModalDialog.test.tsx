import { act, fireEvent, render } from '@testing-library/react';
import { ConsoleTimerSettingsModalDialog } from './ConsoleTimerSettingsModalDialog';

const baseProps = {
  isOpen: false,
  isTimerActive: false,
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
  let originalInnerWidth: number;

  beforeEach(() => {
    jest.clearAllMocks();
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('renders the timer button when the dialog is closed', () => {
    const { getByRole, queryByRole } = render(
      <ConsoleTimerSettingsModalDialog {...baseProps} isOpen={false} />,
    );
    expect(
      getByRole('button', { name: 'Console Settings' }),
    ).toBeInTheDocument();
    expect(queryByRole('dialog')).toBeNull();
  });

  it('renders the timer button when the dialog is open', () => {
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog {...baseProps} isOpen={true} />,
    );
    expect(
      getByRole('button', { name: 'Console Settings' }),
    ).toBeInTheDocument();
  });

  it('calls onOpen when the timer button is clicked', () => {
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

  it('adds active class to the button when isTimerActive is true', () => {
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={false}
        isTimerActive={true}
      />,
    );
    expect(getByRole('button', { name: 'Console Settings' })).toHaveClass(
      'console-timer-settings-button--active',
    );
  });

  it('does not add active class to the button when isTimerActive is false', () => {
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={false}
        isTimerActive={false}
      />,
    );
    expect(getByRole('button', { name: 'Console Settings' })).not.toHaveClass(
      'console-timer-settings-button--active',
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
    expect(getByLabelText('beta')).toHaveValue(null);
  });

  it('displays empty input for projects with 0 minutes so users can type without deleting a zero first', () => {
    const { getByLabelText } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        pjcodes={['alpha', 'beta']}
        projectMinutes={{ alpha: 10, beta: 0 }}
      />,
    );
    expect(getByLabelText('alpha')).toHaveValue(10);
    expect(getByLabelText('beta')).toHaveValue(null);
  });

  it('renders the timer mode toggle after the project list', () => {
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        pjcodes={['alpha']}
        projectMinutes={{ alpha: 5 }}
      />,
    );
    const timerSwitch = getByRole('switch', { name: 'Timer Mode' });
    const projectList = getByRole('list');
    expect(
      projectList.compareDocumentPosition(timerSwitch) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it('calls onToggleTimerMode when the timer mode switch is clicked', () => {
    const onToggleTimerMode = jest.fn();
    const { getByRole } = render(
      <ConsoleTimerSettingsModalDialog
        {...baseProps}
        isOpen={true}
        timerMode={false}
        onToggleTimerMode={onToggleTimerMode}
      />,
    );
    fireEvent.click(getByRole('switch', { name: 'Timer Mode' }));
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

  it('clamps dialog right position so dialog stays within viewport when button is near the left edge', async () => {
    const testViewportWidth = 500;
    const buttonRight = 35;
    const cssDialogMinWidth = 280;
    const edgeMargin = 8;
    const maxAllowedRight = testViewportWidth - cssDialogMinWidth - edgeMargin;

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: testViewportWidth,
    });

    const { getByRole, rerender } = render(
      <ConsoleTimerSettingsModalDialog {...baseProps} isOpen={false} />,
    );

    const settingsButton = getByRole('button', { name: 'Console Settings' });
    jest.spyOn(settingsButton, 'getBoundingClientRect').mockReturnValue({
      right: buttonRight,
      bottom: 40,
      top: 10,
      left: 5,
      width: 30,
      height: 30,
      x: 5,
      y: 10,
      toJSON: () => ({}),
    } as DOMRect);

    await act(async () => {
      rerender(
        <ConsoleTimerSettingsModalDialog {...baseProps} isOpen={true} />,
      );
    });

    const dialog = getByRole('dialog');
    const rightValue = parseFloat((dialog as HTMLElement).style.right);
    expect(rightValue).toBeLessThanOrEqual(maxAllowedRight);
  });
});
