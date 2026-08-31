import { fireEvent, render } from '@testing-library/react';
import { consoleStatusOptionsFixture } from '../../testing/fixtures';
import { ConsoleStatusActions } from './ConsoleStatusActions';

describe('ConsoleStatusActions', () => {
  it('renders only the three routed status buttons that exist in the data', () => {
    const { getByText, queryByText } = render(
      <ConsoleStatusActions
        statusOptions={consoleStatusOptionsFixture}
        onSetStatus={() => {}}
        onSetInTmuxByHuman={() => {}}
      />,
    );
    expect(getByText('In Tmux by human')).toBeInTheDocument();
    expect(getByText('Todo by human')).toBeInTheDocument();
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
    expect(queryByText('In Tmux by agent')).toBeNull();
    expect(queryByText('Todo by agent')).toBeNull();
    expect(queryByText('Preparation')).toBeNull();
  });

  it('routes In Tmux by human to the intmux handler and others to the status handler', () => {
    const onSetStatus = jest.fn();
    const onSetInTmuxByHuman = jest.fn();
    const { getByText } = render(
      <ConsoleStatusActions
        statusOptions={consoleStatusOptionsFixture}
        onSetStatus={onSetStatus}
        onSetInTmuxByHuman={onSetInTmuxByHuman}
      />,
    );
    fireEvent.click(getByText('In Tmux by human'));
    fireEvent.click(getByText('Todo by human'));
    expect(onSetInTmuxByHuman).toHaveBeenCalledTimes(1);
    expect(onSetInTmuxByHuman.mock.calls[0][0].name).toBe('In Tmux by human');
    expect(onSetStatus).toHaveBeenCalledTimes(1);
    expect(onSetStatus.mock.calls[0][0].name).toBe('Todo by human');
  });

  it('renders nothing when no routed option exists', () => {
    const { container } = render(
      <ConsoleStatusActions
        statusOptions={[{ id: 'x', name: 'Preparation', color: 'YELLOW' }]}
        onSetStatus={() => {}}
        onSetInTmuxByHuman={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
