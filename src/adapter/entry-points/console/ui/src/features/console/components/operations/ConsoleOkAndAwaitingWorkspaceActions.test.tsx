import { fireEvent, render } from '@testing-library/react';
import { consoleStatusOptionsFixture } from '../../testing/fixtures';
import { ConsoleOkAndAwaitingWorkspaceActions } from './ConsoleOkAndAwaitingWorkspaceActions';

describe('ConsoleOkAndAwaitingWorkspaceActions', () => {
  it('renders the ok & Awaiting Workspace button when the option exists', () => {
    const { getByRole } = render(
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={consoleStatusOptionsFixture}
        onOkAndAwaitingWorkspace={() => {}}
      />,
    );
    expect(getByRole('button')).toBeInTheDocument();
  });

  it('calls the handler with the Awaiting Workspace option on click', () => {
    const onOkAndAwaitingWorkspace = jest.fn();
    const { getByRole } = render(
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={consoleStatusOptionsFixture}
        onOkAndAwaitingWorkspace={onOkAndAwaitingWorkspace}
      />,
    );
    fireEvent.click(getByRole('button'));
    expect(onOkAndAwaitingWorkspace).toHaveBeenCalledTimes(1);
    expect(onOkAndAwaitingWorkspace.mock.calls[0][0].name).toBe(
      'Awaiting Workspace',
    );
  });

  it('renders nothing when no Awaiting Workspace option is present', () => {
    const { container } = render(
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={[{ id: 'x', name: 'Preparation', color: 'YELLOW' }]}
        onOkAndAwaitingWorkspace={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
