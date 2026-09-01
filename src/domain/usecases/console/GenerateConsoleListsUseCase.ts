import type { Issue } from "../../entities/Issue";
import type { FieldOption, Project } from "../../entities/Project";
import {
	AWAITING_WORKSPACE_STATUS_NAME,
	FAILED_PREPARATION_STATUS_NAME,
	IN_TMUX_BY_AGENT_STATUS_NAME,
	LEGACY_TODO_STATUS_NAME,
	PREPARATION_STATUS_NAME,
	TODO_BY_AGENT_STATUS_NAME,
	TODO_STATUS_NAME,
} from "../../entities/WorkflowStatus";
import { encodeForURI } from "../utils";

export type ConsoleColor = FieldOption["color"];

export type ConsoleListItem = {
	number: number;
	title: string;
	url: string;
	repo: string;
	nameWithOwner: string;
	projectItemId: string;
	itemId: string;
	isPr: boolean;
	story: string;
	status: string | null;
	agent: string | null;
	nextActionDate: string | null;
	nextActionHour: number | null;
	dependedIssueUrls: string[];
	labels: string[];
	createdAt: string;
	relatedOpenPullRequestUrls: string[];
};

export type ConsoleFieldOption = {
	id: string;
	name: string;
	color: ConsoleColor;
};

export type ConsoleStatusTab = {
	pjcode: string;
	generatedAt: string;
	statusOptions: ConsoleFieldOption[];
	agentOptions: ConsoleFieldOption[];
	storyOrder: string[];
	storyColors: Record<string, { color: ConsoleColor }>;
	items: ConsoleListItem[];
};

export type ConsoleQueuedTab = {
	pjcode: string;
	generatedAt: string;
	statusOptions: ConsoleFieldOption[];
	agentOptions: ConsoleFieldOption[];
	storyOrder: string[];
	storyColors: Record<string, { color: ConsoleColor }>;
	items: ConsoleListItem[];
};

export type ConsoleTabName =
	| "workflow-blocker"
	| "prs"
	| "failed-preparation"
	| "todo-by-human"
	| "todo-by-agent"
	| "queued"
	| "stories";

export type ConsoleStoryEntry = {
	storyName: string;
	storyOptionId: string;
	color: ConsoleColor;
	openItemCount: number;
	storyViewUrl: string | null;
};

export type ConsoleStoriesTab = {
	pjcode: string;
	generatedAt: string;
	stories: ConsoleStoryEntry[];
	storyOrder: string[];
	storyColors: Record<string, { color: ConsoleColor }>;
	defaultNameWithOwner: string | null;
};

export type ConsoleLists = {
	"workflow-blocker": ConsoleStatusTab;
	prs: ConsoleStatusTab;
	"failed-preparation": ConsoleStatusTab;
	"todo-by-human": ConsoleStatusTab;
	"todo-by-agent": ConsoleStatusTab;
	queued: ConsoleQueuedTab;
	stories: ConsoleStoriesTab;
};

export type GenerateConsoleListsInput = {
	project: Project;
	issues: Issue[];
	pjcode: string;
	assigneeLogin: string;
	generatedAt: string;
	workflowBlockerStoryName: string | null;
	urlOfStoryView: string | null;
};

const UNKNOWN_STORY_SORT_INDEX = 999999;

export class GenerateConsoleListsUseCase {
	run = (input: GenerateConsoleListsInput): ConsoleLists => {
		const {
			project,
			issues,
			pjcode,
			assigneeLogin,
			generatedAt,
			workflowBlockerStoryName,
			urlOfStoryView,
		} = input;

		const storyOptions = project.story ? project.story.stories : [];
		const storyOrder = storyOptions.map((option) => option.name);
		const statusOptions = project.status.statuses;

		const relatedOpenPullRequestUrlsByIssueUrl =
			this.buildRelatedOpenPullRequestUrlsByIssueUrl(issues);

		const visibleIssues = issues.filter(
			(issue) =>
				issue.status?.toLowerCase() !==
				IN_TMUX_BY_AGENT_STATUS_NAME.toLowerCase(),
		);

		const actionableIssues = visibleIssues.filter((issue) =>
			this.isActionable(issue, assigneeLogin),
		);

		const buildStatusTabFromSource = (
			sourceIssues: Issue[],
			selector: (issue: Issue) => boolean,
			excludedStatusNames: string[],
			agentOptions: ConsoleFieldOption[] = [],
		): ConsoleStatusTab => ({
			pjcode,
			generatedAt,
			statusOptions: this.buildFieldOptions(statusOptions, excludedStatusNames),
			agentOptions,
			storyOrder,
			storyColors: this.buildStoryColorsObject(storyOptions),
			items: this.sortByStoryOrder(
				sourceIssues
					.filter(selector)
					.map((issue) =>
						this.projectItem(
							issue,
							relatedOpenPullRequestUrlsByIssueUrl.get(issue.url) ?? [],
						),
					),
				storyOrder,
			),
		});

		const buildStatusTab = (
			selector: (issue: Issue) => boolean,
			excludedStatusNames: string[],
			agentOptions: ConsoleFieldOption[] = [],
		): ConsoleStatusTab =>
			buildStatusTabFromSource(
				actionableIssues,
				selector,
				excludedStatusNames,
				agentOptions,
			);

		const openItemCountByStory = new Map<string, number>();
		for (const issue of issues) {
			if (!issue.isClosed && issue.story !== null) {
				openItemCountByStory.set(
					issue.story,
					(openItemCountByStory.get(issue.story) ?? 0) + 1,
				);
			}
		}

		const defaultNameWithOwner =
			issues.find((issue) => issue.nameWithOwner !== "")?.nameWithOwner ?? null;

		const storyEntries: ConsoleStoryEntry[] = storyOptions.map((option) => ({
			storyName: option.name,
			storyOptionId: option.id,
			color: option.color,
			openItemCount: openItemCountByStory.get(option.name) ?? 0,
			storyViewUrl: urlOfStoryView
				? `${urlOfStoryView}?sliceBy%5Bvalue%5D=${encodeForURI(option.name)}`
				: null,
		}));

		return {
			"workflow-blocker": buildStatusTabFromSource(
				issues.filter((issue) => issue.isClosed === false),
				this.workflowBlockerSelector(workflowBlockerStoryName),
				["done"],
			),
			prs: buildStatusTab(
				(issue) =>
					issue.status !== null &&
					issue.status.toLowerCase() === "awaiting quality check",
				["awaiting quality check", "done"],
				this.buildFieldOptions(project.agent?.options ?? [], []),
			),
			"failed-preparation": buildStatusTabFromSource(
				visibleIssues.filter(
					(issue) =>
						!issue.isClosed &&
						issue.assignees.includes(assigneeLogin) &&
						issue.nextActionDate === null &&
						issue.nextActionHour === null,
				),
				(issue) => issue.status === FAILED_PREPARATION_STATUS_NAME,
				[
					"failed preparation",
					"done",
					"preparation",
					"icebox",
					"in tmux by human",
					"in tmux by agent",
					"todo by agent",
				],
			),
			"todo-by-human": buildStatusTab(
				(issue) =>
					issue.status === TODO_STATUS_NAME ||
					issue.status === LEGACY_TODO_STATUS_NAME,
				[TODO_STATUS_NAME.toLowerCase(), "done"],
			),
			"todo-by-agent": buildStatusTab(
				(issue) => issue.status === TODO_BY_AGENT_STATUS_NAME,
				[TODO_BY_AGENT_STATUS_NAME.toLowerCase(), "done"],
			),
			queued: {
				pjcode,
				generatedAt,
				statusOptions: this.buildFieldOptions(statusOptions, []),
				agentOptions: this.buildFieldOptions(project.agent?.options ?? [], []),
				storyOrder,
				storyColors: this.buildStoryColorsObject(storyOptions),
				items: this.sortByStoryOrder(
					visibleIssues
						.filter(
							(issue) =>
								!issue.isClosed &&
								(issue.status === AWAITING_WORKSPACE_STATUS_NAME ||
									issue.status === PREPARATION_STATUS_NAME) &&
								issue.dependedIssueUrls.length === 0,
						)
						.map((issue) =>
							this.projectItem(
								issue,
								relatedOpenPullRequestUrlsByIssueUrl.get(issue.url) ?? [],
							),
						),
					storyOrder,
				),
			},
			stories: {
				pjcode,
				generatedAt,
				stories: storyEntries,
				storyOrder,
				storyColors: this.buildStoryColorsObject(storyOptions),
				defaultNameWithOwner,
			},
		};
	};

	private isActionable = (issue: Issue, assigneeLogin: string): boolean =>
		issue.isClosed === false &&
		issue.assignees.includes(assigneeLogin) &&
		issue.dependedIssueUrls.length === 0 &&
		issue.nextActionDate === null &&
		issue.nextActionHour === null;

	private workflowBlockerSelector = (
		workflowBlockerStoryName: string | null,
	): ((issue: Issue) => boolean) => {
		const target = workflowBlockerStoryName?.toLowerCase() ?? "";
		if (target === "") {
			return () => false;
		}
		return (issue: Issue): boolean =>
			issue.story !== null && issue.story.toLowerCase() === target;
	};

	private buildRelatedOpenPullRequestUrlsByIssueUrl = (
		issues: Issue[],
	): Map<string, string[]> => {
		const urlsByIssueUrl = new Map<string, string[]>();
		for (const issue of issues) {
			if (!issue.isPr || issue.isClosed) {
				continue;
			}
			for (const referencedIssueUrl of issue.closingIssueReferenceUrls) {
				const existing = urlsByIssueUrl.get(referencedIssueUrl);
				if (existing === undefined) {
					urlsByIssueUrl.set(referencedIssueUrl, [issue.url]);
					continue;
				}
				if (!existing.includes(issue.url)) {
					existing.push(issue.url);
				}
			}
		}
		return urlsByIssueUrl;
	};

	private projectItem = (
		issue: Issue,
		relatedOpenPullRequestUrls: string[],
	): ConsoleListItem => ({
		number: issue.number,
		title: issue.title,
		url: issue.url,
		repo: issue.nameWithOwner,
		nameWithOwner: issue.nameWithOwner,
		projectItemId: issue.itemId,
		itemId: issue.itemId,
		isPr: issue.isPr,
		story: issue.story ?? "",
		status: issue.status,
		agent: issue.agent,
		nextActionDate:
			issue.nextActionDate === null ? null : issue.nextActionDate.toISOString(),
		nextActionHour: issue.nextActionHour,
		dependedIssueUrls: issue.dependedIssueUrls,
		labels: issue.labels,
		createdAt: issue.createdAt.toISOString(),
		relatedOpenPullRequestUrls,
	});

	private buildFieldOptions = (
		options: FieldOption[],
		excludedLowerCaseNames: string[],
	): ConsoleFieldOption[] =>
		options
			.filter(
				(option) => !excludedLowerCaseNames.includes(option.name.toLowerCase()),
			)
			.map((option) => ({
				id: option.id,
				name: option.name,
				color: option.color,
			}));

	private buildStoryColorsObject = (
		options: FieldOption[],
	): Record<string, { color: ConsoleColor }> => {
		const result: Record<string, { color: ConsoleColor }> = {};
		for (const option of options) {
			result[option.name] = { color: option.color };
		}
		return result;
	};

	private sortByStoryOrder = (
		items: ConsoleListItem[],
		storyOrder: string[],
	): ConsoleListItem[] => {
		const indexByStory = new Map(
			storyOrder.map((name, index) => [name, index]),
		);
		return items
			.map((item, position) => ({
				item,
				position,
				sortKey: indexByStory.get(item.story) ?? UNKNOWN_STORY_SORT_INDEX,
			}))
			.sort((a, b) => {
				if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
				if (a.item.story !== b.item.story)
					return a.item.story.localeCompare(b.item.story);
				return a.position - b.position;
			})
			.map((entry) => entry.item);
	};
}
