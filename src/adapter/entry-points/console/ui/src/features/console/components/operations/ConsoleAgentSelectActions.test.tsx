import { fireEvent, render, screen } from '@testing-library/react';
import { ConsoleAgentSelectActions } from './ConsoleAgentSelectActions';

const agentOptions = [
  { id: 'agent_1', name: 'developer', color: 'BLUE' as const },
  { id: 'agent_2', name: 'chore', color: 'GRAY' as const },
];

describe('ConsoleAgentSelectActions', () => {
  it('renders null when agentOptions is empty', () => {
    const { container } = render(
      <ConsoleAgentSelectActions
        agentOptions={[]}
        currentAgentName={null}
        onSetAgent={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a select with agent options', () => {
    render(
      <ConsoleAgentSelectActions
        agentOptions={agentOptions}
        currentAgentName={null}
        onSetAgent={jest.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Set agent' })).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('chore')).toBeInTheDocument();
  });

  it('pre-selects the current agent by name', () => {
    render(
      <ConsoleAgentSelectActions
        agentOptions={agentOptions}
        currentAgentName="chore"
        onSetAgent={jest.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Set agent' }) as HTMLSelectElement;
    expect(select.value).toBe('agent_2');
  });

  it('calls onSetAgent when a different option is chosen', () => {
    const onSetAgent = jest.fn();
    render(
      <ConsoleAgentSelectActions
        agentOptions={agentOptions}
        currentAgentName={null}
        onSetAgent={onSetAgent}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Set agent' });
    fireEvent.change(select, { target: { value: 'agent_1' } });
    expect(onSetAgent).toHaveBeenCalledWith(agentOptions[0]);
  });

  it('does not call onSetAgent when the same option is re-selected', () => {
    const onSetAgent = jest.fn();
    render(
      <ConsoleAgentSelectActions
        agentOptions={agentOptions}
        currentAgentName="developer"
        onSetAgent={onSetAgent}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Set agent' });
    fireEvent.change(select, { target: { value: 'agent_1' } });
    expect(onSetAgent).not.toHaveBeenCalled();
  });
});
