import type { ConsoleFieldOption } from '../../logic/types';

export type ConsolePrsAgentFilterProps = {
  agentOptions: ConsoleFieldOption[];
  selectedAgent: string | null;
  onAgentChange: (agent: string | null) => void;
};

export const ConsolePrsAgentFilter = ({
  agentOptions,
  selectedAgent,
  onAgentChange,
}: ConsolePrsAgentFilterProps) => {
  if (agentOptions.length === 0) {
    return null;
  }
  return (
    <div className="console-prs-agent-filter">
      <select
        value={selectedAgent ?? ''}
        onChange={(e) =>
          onAgentChange(e.target.value !== '' ? e.target.value : null)
        }
        aria-label="Filter by agent"
      >
        <option value="">All agents</option>
        {agentOptions.map((option) => (
          <option key={option.id} value={option.name}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};
