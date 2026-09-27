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
    expect(
      screen.getByRole('combobox', { name: 'Set agent' }),
    ).toBeInTheDocument();
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
    const select = screen.getByRole('combobox', {
      name: 'Set agent',
    }) as HTMLSelectElement;
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

  it('pre-selects the current agent by id when duplicate names exist', () => {
    const duplicateNameAgentOptions = [
      { id: 'agent_dup_1', name: 'developer', color: 'BLUE' as const },
      { id: 'agent_dup_2', name: 'developer', color: 'GRAY' as const },
    ];
    const props = {
      agentOptions: duplicateNameAgentOptions,
      currentAgentName: 'developer',
      currentAgentOptionId: 'agent_dup_2',
      onSetAgent: jest.fn(),
    };
    render(<ConsoleAgentSelectActions {...props} />);
    const select = screen.getByRole('combobox', {
      name: 'Set agent',
    }) as HTMLSelectElement;
    expect(select.value).toBe('agent_dup_2');
  });

  it('pre-selects the current agent by id when the id points to a different option than the name would match', () => {
    const props = {
      agentOptions,
      currentAgentName: 'developer',
      currentAgentOptionId: 'agent_2',
      onSetAgent: jest.fn(),
    };
    render(<ConsoleAgentSelectActions {...props} />);
    const select = screen.getByRole('combobox', {
      name: 'Set agent',
    }) as HTMLSelectElement;
    expect(select.value).toBe('agent_2');
  });

  it('falls back to matching by name when currentAgentOptionId is null', () => {
    const props = {
      agentOptions,
      currentAgentName: 'chore',
      currentAgentOptionId: null,
      onSetAgent: jest.fn(),
    };
    render(<ConsoleAgentSelectActions {...props} />);
    const select = screen.getByRole('combobox', {
      name: 'Set agent',
    }) as HTMLSelectElement;
    expect(select.value).toBe('agent_2');
  });

  it('does not pre-select any option when currentAgentOptionId does not match any option, even when the name would match a different one', () => {
    const props = {
      agentOptions,
      currentAgentName: 'chore',
      currentAgentOptionId: 'agent_stale',
      onSetAgent: jest.fn(),
    };
    render(<ConsoleAgentSelectActions {...props} />);
    const select = screen.getByRole('combobox', {
      name: 'Set agent',
    }) as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('pre-selects the first matching name when duplicate names exist and no id is supplied', () => {
    const duplicateNameAgentOptions = [
      { id: 'agent_dup_1', name: 'developer', color: 'BLUE' as const },
      { id: 'agent_dup_2', name: 'developer', color: 'GRAY' as const },
    ];
    const props = {
      agentOptions: duplicateNameAgentOptions,
      currentAgentName: 'developer',
      currentAgentOptionId: null,
      onSetAgent: jest.fn(),
    };
    render(<ConsoleAgentSelectActions {...props} />);
    const select = screen.getByRole('combobox', {
      name: 'Set agent',
    }) as HTMLSelectElement;
    expect(select.value).toBe('agent_dup_1');
  });

  it('still calls onSetAgent with the full option object when currentAgentOptionId is supplied', () => {
    const onSetAgent = jest.fn();
    const props = {
      agentOptions,
      currentAgentName: 'developer',
      currentAgentOptionId: 'agent_1',
      onSetAgent,
    };
    render(<ConsoleAgentSelectActions {...props} />);
    const select = screen.getByRole('combobox', { name: 'Set agent' });
    fireEvent.change(select, { target: { value: 'agent_2' } });
    expect(onSetAgent).toHaveBeenCalledWith(agentOptions[1]);
  });
});
