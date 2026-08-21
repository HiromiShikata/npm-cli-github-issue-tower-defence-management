import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConsoleOfflinePendingActionsPanel } from "./ConsoleOfflinePendingActionsPanel";

const approveAction = {
	id: "offline-1",
	message: "Approved — PR #851",
	color: "green" as const,
	itemNumber: 851,
	isPr: true,
	currentTitle: "Add serveConsole subcommand under entry-points",
	currentState: "open" as const,
	currentPrStatus: {
		found: true,
		isConflicted: false,
		mergeableStatus: "MERGEABLE" as const,
		isPassedAllCiJob: true,
		isCiStateSuccess: true,
		isBranchOutOfDate: false,
		missingRequiredCheckNames: [],
	},
	fetchError: false,
};

const rejectAction = {
	id: "offline-2",
	message: "Rejected — PR #853",
	color: "amber" as const,
	itemNumber: 853,
	isPr: true,
	currentTitle: "Add server-side console API handlers",
	currentState: "open" as const,
	currentPrStatus: {
		found: true,
		isConflicted: true,
		mergeableStatus: "CONFLICTING" as const,
		isPassedAllCiJob: false,
		isCiStateSuccess: false,
		isBranchOutOfDate: true,
		missingRequiredCheckNames: ["test", "build"],
	},
	fetchError: false,
};

const meta: Meta<typeof ConsoleOfflinePendingActionsPanel> = {
	title: "Console/ConsoleOfflinePendingActionsPanel",
	component: ConsoleOfflinePendingActionsPanel,
	args: {
		isOnline: true,
		isConfirming: false,
		onConfirm: () => {},
		onDiscard: () => {},
	},
};

export default meta;

type Story = StoryObj<typeof ConsoleOfflinePendingActionsPanel>;

export const SingleActionOnline: Story = {
	args: {
		actions: [approveAction],
		isOnline: true,
	},
};

export const MultipleActionsOnline: Story = {
	args: {
		actions: [approveAction, rejectAction],
		isOnline: true,
	},
};

export const LoadingCurrentState: Story = {
	args: {
		actions: [
			{
				...approveAction,
				currentTitle: null,
				currentState: null,
				currentPrStatus: null,
			},
		],
		isOnline: true,
	},
};

export const FetchError: Story = {
	args: {
		actions: [
			{
				...approveAction,
				currentTitle: null,
				currentState: null,
				currentPrStatus: null,
				fetchError: true,
			},
		],
		isOnline: true,
	},
};

export const OfflineWithQueuedActions: Story = {
	args: {
		actions: [approveAction, rejectAction],
		isOnline: false,
	},
};

export const ConfirmingInProgress: Story = {
	args: {
		actions: [approveAction],
		isOnline: true,
		isConfirming: true,
	},
};
