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

  it('appends the count to the title when provided', () => {
    const { getByText } = render(
      <ConsolePanel title="Changed files" count={3}>
        <p>content</p>
      </ConsolePanel>,
    );
    expect(getByText('Changed files (3)')).toBeInTheDocument();
  });

  it('omits the count when it is null', () => {
    const { getByText } = render(
      <ConsolePanel title="Description" count={null}>
        <p>content</p>
      </ConsolePanel>,
    );
    expect(getByText('Description')).toBeInTheDocument();
  });

  it('renders the header action node', () => {
    const { getByText } = render(
      <ConsolePanel title="Description" headerAction={<a href="/x">open</a>}>
        <p>content</p>
      </ConsolePanel>,
    );
    expect(getByText('open')).toBeInTheDocument();
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
