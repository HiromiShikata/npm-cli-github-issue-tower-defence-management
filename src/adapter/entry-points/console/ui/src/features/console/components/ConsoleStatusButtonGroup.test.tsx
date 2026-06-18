import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONSOLE_COLOR_PALETTE } from '../colors';
import { consoleStatusOptionsFixture } from '../fixtures';
import { ConsoleStatusButtonGroup } from './ConsoleStatusButtonGroup';

describe('ConsoleStatusButtonGroup', () => {
  it('renders the status buttons in left-to-right prototype order', () => {
    render(
      <ConsoleStatusButtonGroup
        statusOptions={consoleStatusOptionsFixture}
        onSetStatus={() => undefined}
        onSetInTmux={() => undefined}
      />,
    );
    const labels = screen
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual([
      'In Tmux by agent',
      'In Tmux by human',
      'Todo by human',
      'Awaiting Workspace',
    ]);
  });

  it('colors each button from its status option color enum', () => {
    render(
      <ConsoleStatusButtonGroup
        statusOptions={consoleStatusOptionsFixture}
        onSetStatus={() => undefined}
        onSetInTmux={() => undefined}
      />,
    );
    expect(screen.getByText('Awaiting Workspace')).toHaveStyle({
      backgroundColor: CONSOLE_COLOR_PALETTE.GREEN.bg,
      color: CONSOLE_COLOR_PALETTE.GREEN.fg,
    });
  });

  it('routes In Tmux by human through onSetInTmux and others through onSetStatus', async () => {
    const onSetStatus = jest.fn();
    const onSetInTmux = jest.fn();
    render(
      <ConsoleStatusButtonGroup
        statusOptions={consoleStatusOptionsFixture}
        onSetStatus={onSetStatus}
        onSetInTmux={onSetInTmux}
      />,
    );
    await userEvent.click(screen.getByText('In Tmux by human'));
    await userEvent.click(screen.getByText('Todo by human'));
    expect(onSetInTmux).toHaveBeenCalledTimes(1);
    expect(onSetStatus).toHaveBeenCalledWith(consoleStatusOptionsFixture[2]);
  });

  it('renders nothing when no known status option is present', () => {
    const { container } = render(
      <ConsoleStatusButtonGroup
        statusOptions={[]}
        onSetStatus={() => undefined}
        onSetInTmux={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
