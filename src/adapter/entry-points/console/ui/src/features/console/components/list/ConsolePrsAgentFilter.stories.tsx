import type { Meta, StoryObj } from "@storybook/react-vite";
import { consoleAgentOptionsFixture } from "../../testing/fixtures";
import { ConsolePrsAgentFilter } from "./ConsolePrsAgentFilter";

const meta: Meta<typeof ConsolePrsAgentFilter> = {
	title: "Console/ConsolePrsAgentFilter",
	component: ConsolePrsAgentFilter,
	args: {
		agentOptions: consoleAgentOptionsFixture,
		agentCounts: {
			chore: 4,
			accounting: 2,
			triager: 7,
			liaison: 1,
			"systems-analyst": 3,
			developer: 5,
			"pr-reviewer": 6,
			gift: 1,
			"tdpm-workflow-improver": 2,
			"7sea": 0,
			"system-design-reviewer": 0,
		},
		selectedAgent: null,
		onAgentChange: () => {},
	},
};

export default meta;

type Story = StoryObj<typeof ConsolePrsAgentFilter>;

export const AllAgents: Story = {};

export const FilteredByAgent: Story = {
	args: {
		selectedAgent: "developer",
	},
};

export const NoAgentsWithTasks: Story = {
	args: {
		agentCounts: {},
	},
};
