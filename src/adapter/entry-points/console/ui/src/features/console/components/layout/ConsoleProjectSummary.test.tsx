import { render } from '@testing-library/react';
import { ConsoleProjectSummary } from './ConsoleProjectSummary';

describe('ConsoleProjectSummary', () => {
  it('shows the active project code when a pjcode is provided', () => {
    const { getByText } = render(<ConsoleProjectSummary pjcode="umino" />);
    expect(getByText('project: umino')).toBeInTheDocument();
  });

  it('shows a no-project message when the pjcode is null', () => {
    const { getByText } = render(<ConsoleProjectSummary pjcode={null} />);
    expect(getByText('no project selected')).toBeInTheDocument();
  });
});
