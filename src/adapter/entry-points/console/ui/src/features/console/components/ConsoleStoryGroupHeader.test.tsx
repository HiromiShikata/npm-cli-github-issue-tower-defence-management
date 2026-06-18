import { render, screen } from '@testing-library/react';
import { CONSOLE_COLOR_PALETTE } from '../colors';
import { ConsoleStoryGroupHeader } from './ConsoleStoryGroupHeader';

describe('ConsoleStoryGroupHeader', () => {
  it('renders the story name and count', () => {
    render(
      <ConsoleStoryGroupHeader
        story="TDPM Console port"
        color="BLUE"
        count={3}
      />,
    );
    expect(screen.getByText('TDPM Console port')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('colors the story dot from the color enum', () => {
    const { container } = render(
      <ConsoleStoryGroupHeader story="Story" color="RED" count={1} />,
    );
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveStyle({
      backgroundColor: CONSOLE_COLOR_PALETTE.RED.dot,
    });
  });
});
