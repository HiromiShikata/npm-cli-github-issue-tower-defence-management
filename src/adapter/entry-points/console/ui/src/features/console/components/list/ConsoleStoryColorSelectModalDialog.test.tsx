import { fireEvent, render } from '@testing-library/react';
import { ConsoleStoryColorSelectModalDialog } from './ConsoleStoryColorSelectModalDialog';

const defaultProps = {
  storyName: 'TDPM Console port',
  storyOptionId: '1491051e',
  onSelectColor: () => undefined,
  onClose: () => undefined,
  disabled: false,
};

describe('ConsoleStoryColorSelectModalDialog', () => {
  it('renders the dialog with the story name', () => {
    const { getByRole } = render(
      <ConsoleStoryColorSelectModalDialog {...defaultProps} />,
    );
    expect(
      getByRole('dialog', { name: 'Change color for TDPM Console port' }),
    ).toBeInTheDocument();
  });

  it('renders a swatch button for each color including GRAY', () => {
    const { getByRole } = render(
      <ConsoleStoryColorSelectModalDialog {...defaultProps} />,
    );
    expect(getByRole('button', { name: 'GREEN' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'GRAY (disable)' })).toBeInTheDocument();
  });

  it('calls onSelectColor with storyOptionId and the selected color when a swatch is clicked', () => {
    const onSelectColor = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryColorSelectModalDialog
        {...defaultProps}
        onSelectColor={onSelectColor}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'GREEN' }));
    expect(onSelectColor).toHaveBeenCalledWith('1491051e', 'GREEN');
  });

  it('calls onClose after a color swatch is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryColorSelectModalDialog
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'GREEN' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryColorSelectModalDialog
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryColorSelectModalDialog
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables all swatches when disabled prop is true', () => {
    const { getByRole } = render(
      <ConsoleStoryColorSelectModalDialog {...defaultProps} disabled={true} />,
    );
    expect(getByRole('button', { name: 'GREEN' })).toBeDisabled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn();
    render(
      <ConsoleStoryColorSelectModalDialog
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
