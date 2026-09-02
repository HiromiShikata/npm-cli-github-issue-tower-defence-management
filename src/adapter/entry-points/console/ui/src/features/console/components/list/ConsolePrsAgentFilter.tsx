import type { ConsoleFieldOption } from "../../logic/types";

export type ConsolePrsAgentFilterProps = {
	agentOptions: ConsoleFieldOption[];
	agentCounts: Record<string, number>;
	selectedAgent: string | null;
	onAgentChange: (agent: string | null) => void;
};

export const ConsolePrsAgentFilter = ({
	agentOptions,
	agentCounts,
	selectedAgent,
	onAgentChange,
}: ConsolePrsAgentFilterProps) => {
	const optionsWithTasks = agentOptions.filter(
		(option) => (agentCounts[option.name] ?? 0) > 0,
	);
	if (optionsWithTasks.length === 0) {
		return null;
	}
	return (
		<div className="console-prs-agent-filter">
			<select
				value={selectedAgent ?? ""}
				onChange={(e) =>
					onAgentChange(e.target.value !== "" ? e.target.value : null)
				}
				aria-label="Filter by agent"
			>
				<option value="">All agents</option>
				{optionsWithTasks.map((option) => (
					<option key={option.id} value={option.name}>
						{option.name} ({agentCounts[option.name]})
					</option>
				))}
			</select>
		</div>
	);
};
