import { render } from '@testing-library/react';
import { ConsoleProjectHeader } from './ConsoleProjectHeader';

describe('ConsoleProjectHeader', () => {
  it('shows the active project code when a pjcode is provided', () => {
    const { getByText } = render(<ConsoleProjectHeader pjcode="umino" />);
    expect(getByText('project: umino')).toBeInTheDocument();
  });

  it('shows a no-project message when the pjcode is null', () => {
    const { getByText } = render(<ConsoleProjectHeader pjcode={null} />);
    expect(getByText('no project selected')).toBeInTheDocument();
  });
});
