import { render } from '@testing-library/react';
import { ConsoleStoryGroupHeader } from './ConsoleStoryGroupHeader';

describe('ConsoleStoryGroupHeader', () => {
  it('renders the story name and count', () => {
    const { getByText } = render(
      <ConsoleStoryGroupHeader
        story="TDPM Console port"
        count={4}
        colorEnum="BLUE"
      />,
    );
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText('4')).toBeInTheDocument();
  });

  it('applies the dot color from the enum', () => {
    const { container } = render(
      <ConsoleStoryGroupHeader story="s" count={1} colorEnum="GREEN" />,
    );
    const dot = container.querySelector('.console-story-dot');
    expect(dot).toHaveStyle({ backgroundColor: '#3fb950' });
  });
});
