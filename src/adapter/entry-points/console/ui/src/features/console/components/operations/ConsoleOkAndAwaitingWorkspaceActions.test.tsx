import { fireEvent, render } from '@testing-library/react';
import { consoleStatusOptionsFixture } from '../../testing/fixtures';
import { ConsoleOkAndAwaitingWorkspaceActions } from './ConsoleOkAndAwaitingWorkspaceActions';

const [awaitingWorkspaceOption] = consoleStatusOptionsFixture.filter(
  (o) => o.name.toLowerCase() === 'awaiting workspace',
);

const statusOptionsWithoutAwaitingWorkspace =
  consoleStatusOptionsFixture.filter(
    (o) => o.name.toLowerCase() !== 'awaiting workspace',
  );

describe('ConsoleOkAndAwaitingWorkspaceActions', () => {
  it('renders the button when the awaiting workspace option is present', () => {
    const { getByRole } = render(
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={consoleStatusOptionsFixture}
        onOkAndAwaitingWorkspace={() => {}}
      />,
    );
    expect(
      getByRole('button', { name: 'ok & Awaiting Workspace' }),
    ).toBeInTheDocument();
  });

  it('returns null when the awaiting workspace option is absent', () => {
    const { container } = render(
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={statusOptionsWithoutAwaitingWorkspace}
        onOkAndAwaitingWorkspace={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('applies the approve green style class regardless of the status option color', () => {
    const { getByRole } = render(
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={consoleStatusOptionsFixture}
        onOkAndAwaitingWorkspace={() => {}}
      />,
    );
    expect(
      getByRole('button', { name: 'ok & Awaiting Workspace' }),
    ).toHaveClass('console-op-button-approve');
  });

  it('calls the callback with the awaiting workspace option on click', () => {
    const onOkAndAwaitingWorkspace = jest.fn();
    const { getByRole } = render(
      <ConsoleOkAndAwaitingWorkspaceActions
        statusOptions={consoleStatusOptionsFixture}
        onOkAndAwaitingWorkspace={onOkAndAwaitingWorkspace}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'ok & Awaiting Workspace' }));
    expect(onOkAndAwaitingWorkspace).toHaveBeenCalledWith(
      awaitingWorkspaceOption,
    );
  });
});
