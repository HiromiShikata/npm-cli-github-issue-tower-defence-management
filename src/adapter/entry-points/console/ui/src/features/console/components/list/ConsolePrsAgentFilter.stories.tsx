import type { Meta, StoryObj } from "@storybook/react-vite";
import { consoleAgentOptionsFixture } from "../../testing/fixtures";
import { ConsolePrsAgentFilter } from "./ConsolePrsAgentFilter";

const meta: Meta<typeof ConsolePrsAgentFilter> = {
	title: "Console/ConsolePrsAgentFilter",
	component: ConsolePrsAgentFilter,
	args: {
		agentOptions: consoleAgentOptionsFixture,
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

export const NoAgentOptions: Story = {
	args: {
		agentOptions: [],
	},
};
