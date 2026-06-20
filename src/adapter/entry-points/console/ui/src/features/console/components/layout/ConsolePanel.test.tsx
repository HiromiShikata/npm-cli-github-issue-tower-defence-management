import { fireEvent, render } from '@testing-library/react';
import { ConsolePanel } from './ConsolePanel';

describe('ConsolePanel', () => {
  it('renders expanded by default', () => {
    const { getByText } = render(
      <ConsolePanel title="Description">
        <p>content</p>
      </ConsolePanel>,
    );
    expect(getByText('content')).toBeInTheDocument();
  });

  it('renders collapsed when defaultCollapsed is set', () => {
    const { queryByText } = render(
      <ConsolePanel title="Commits" defaultCollapsed>
        <p>content</p>
      </ConsolePanel>,
    );
    expect(queryByText('content')).toBeNull();
  });

  it('toggles collapsed state on the header button', () => {
    const { getByRole, queryByText } = render(
      <ConsolePanel title="Comments" defaultCollapsed>
        <p>content</p>
      </ConsolePanel>,
    );
    fireEvent.click(getByRole('button'));
    expect(queryByText('content')).not.toBeNull();
  });
});
