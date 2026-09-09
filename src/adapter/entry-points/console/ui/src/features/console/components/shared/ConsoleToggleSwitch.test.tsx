import { fireEvent, render } from '@testing-library/react';
import { ConsoleToggleSwitch } from './ConsoleToggleSwitch';

describe('ConsoleToggleSwitch', () => {
  it('renders as a switch with aria-checked false when unchecked', () => {
    const { getByRole } = render(
      <ConsoleToggleSwitch
        checked={false}
        ariaLabel="Timer Mode"
        onChange={jest.fn()}
      />,
    );
    const toggle = getByRole('switch', { name: 'Timer Mode' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('renders with aria-checked true when checked', () => {
    const { getByRole } = render(
      <ConsoleToggleSwitch
        checked={true}
        ariaLabel="Timer Mode"
        onChange={jest.fn()}
      />,
    );
    const toggle = getByRole('switch', { name: 'Timer Mode' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with true when clicked while unchecked', () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <ConsoleToggleSwitch
        checked={false}
        ariaLabel="Timer Mode"
        onChange={onChange}
      />,
    );
    fireEvent.click(getByRole('switch', { name: 'Timer Mode' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when clicked while checked', () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <ConsoleToggleSwitch
        checked={true}
        ariaLabel="Timer Mode"
        onChange={onChange}
      />,
    );
    fireEvent.click(getByRole('switch', { name: 'Timer Mode' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('applies the on modifier class when checked', () => {
    const { getByRole } = render(
      <ConsoleToggleSwitch
        checked={true}
        ariaLabel="Timer Mode"
        onChange={jest.fn()}
      />,
    );
    expect(getByRole('switch', { name: 'Timer Mode' })).toHaveClass(
      'console-toggle-switch--on',
    );
  });

  it('does not apply the on modifier class when unchecked', () => {
    const { getByRole } = render(
      <ConsoleToggleSwitch
        checked={false}
        ariaLabel="Timer Mode"
        onChange={jest.fn()}
      />,
    );
    expect(getByRole('switch', { name: 'Timer Mode' })).not.toHaveClass(
      'console-toggle-switch--on',
    );
  });
});
