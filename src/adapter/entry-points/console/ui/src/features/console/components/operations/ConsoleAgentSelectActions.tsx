import type { ConsoleFieldOption } from '../../logic/types';
import { ConsoleFieldOptionSelect } from './ConsoleFieldOptionSelect';

export type ConsoleAgentSelectActionsProps = {
  agentOptions: ConsoleFieldOption[];
  currentAgentName: string | null;
  onSetAgent: (option: ConsoleFieldOption) => void;
};

export const ConsoleAgentSelectActions = ({
  agentOptions,
  currentAgentName,
  onSetAgent,
}: ConsoleAgentSelectActionsProps) => {
  if (agentOptions.length === 0) return null;

  const currentOption =
    currentAgentName !== null
      ? (agentOptions.find((o) => o.name === currentAgentName) ?? null)
      : null;

  return (
    <div className="console-op-group">
      <ConsoleFieldOptionSelect
        key={currentOption?.id ?? 'none'}
        className="console-agent-select"
        ariaLabel="Set agent"
        placeholder="— agent —"
        currentOption={currentOption}
        options={agentOptions}
        onSelect={onSetAgent}
      />
    </div>
  );
};
