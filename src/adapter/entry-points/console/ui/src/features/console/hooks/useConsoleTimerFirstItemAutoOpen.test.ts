import { renderHook } from "@testing-library/react";
import type { ConsoleListItem } from "../logic/types";
import { useConsoleTimerFirstItemAutoOpen } from "./useConsoleTimerFirstItemAutoOpen";

const makeItem = (id: string): ConsoleListItem => ({
	number: 1,
	title: "Test task",
	url: `https://github.com/o/r/issues/1`,
	repo: "o/r",
	nameWithOwner: "o/r",
	projectItemId: id,
	itemId: id,
	isPr: false,
	story: "story",
	status: null,
	agent: null,
	nextActionDate: null,
	nextActionHour: null,
	dependedIssueUrls: [],
	labels: [],
	createdAt: "2026-01-01T00:00:00.000Z",
	relatedOpenPullRequestUrls: [],
});

describe("useConsoleTimerFirstItemAutoOpen", () => {
	it("opens the first pending item when timer mode is active and project changes", () => {
		const openItem = jest.fn();
		renderHook(() =>
			useConsoleTimerFirstItemAutoOpen(
				true,
				"acme",
				[makeItem("PVTI_1"), makeItem("PVTI_2")],
				null,
				openItem,
			),
		);
		expect(openItem).toHaveBeenCalledWith("PVTI_1");
	});

	it("does not open an item when timer mode is off", () => {
		const openItem = jest.fn();
		renderHook(() =>
			useConsoleTimerFirstItemAutoOpen(
				false,
				"acme",
				[makeItem("PVTI_1")],
				null,
				openItem,
			),
		);
		expect(openItem).not.toHaveBeenCalled();
	});

	it("does not open an item when pending items is empty", () => {
		const openItem = jest.fn();
		renderHook(() =>
			useConsoleTimerFirstItemAutoOpen(true, "acme", [], null, openItem),
		);
		expect(openItem).not.toHaveBeenCalled();
	});

	it("does not open an item when an item is already selected", () => {
		const openItem = jest.fn();
		renderHook(() =>
			useConsoleTimerFirstItemAutoOpen(
				true,
				"acme",
				[makeItem("PVTI_1")],
				"PVTI_1",
				openItem,
			),
		);
		expect(openItem).not.toHaveBeenCalled();
	});

	it("does not re-open on re-render without project change", () => {
		const openItem = jest.fn();
		const { rerender } = renderHook(() =>
			useConsoleTimerFirstItemAutoOpen(
				true,
				"acme",
				[makeItem("PVTI_1")],
				null,
				openItem,
			),
		);
		rerender();
		expect(openItem).toHaveBeenCalledTimes(1);
	});

	it("opens first item again when navigating to a new project", () => {
		const openItem = jest.fn();
		const { rerender } = renderHook(
			({ pjcode }: { pjcode: string }) =>
				useConsoleTimerFirstItemAutoOpen(
					true,
					pjcode,
					[makeItem("PVTI_1")],
					null,
					openItem,
				),
			{ initialProps: { pjcode: "acme" } },
		);
		expect(openItem).toHaveBeenCalledWith("PVTI_1");
		openItem.mockClear();

		rerender({ pjcode: "beta" });
		expect(openItem).toHaveBeenCalledWith("PVTI_1");
	});

	it("does not open item when pjcode is null", () => {
		const openItem = jest.fn();
		renderHook(() =>
			useConsoleTimerFirstItemAutoOpen(
				true,
				null,
				[makeItem("PVTI_1")],
				null,
				openItem,
			),
		);
		expect(openItem).not.toHaveBeenCalled();
	});

	it("opens item when items load after initial empty state", () => {
		const openItem = jest.fn();
		const { rerender } = renderHook(
			({ items }: { items: ConsoleListItem[] }) =>
				useConsoleTimerFirstItemAutoOpen(true, "acme", items, null, openItem),
			{ initialProps: { items: [] as ConsoleListItem[] } },
		);
		expect(openItem).not.toHaveBeenCalled();

		rerender({ items: [makeItem("PVTI_1")] });
		expect(openItem).toHaveBeenCalledWith("PVTI_1");
	});

	it("does not open item again after timer mode turns off and back on without project change", () => {
		const openItem = jest.fn();
		const { rerender } = renderHook(
			({ timerMode }: { timerMode: boolean }) =>
				useConsoleTimerFirstItemAutoOpen(
					timerMode,
					"acme",
					[makeItem("PVTI_1")],
					null,
					openItem,
				),
			{ initialProps: { timerMode: true } },
		);
		expect(openItem).toHaveBeenCalledTimes(1);
		openItem.mockClear();

		rerender({ timerMode: false });
		rerender({ timerMode: true });
		expect(openItem).not.toHaveBeenCalled();
	});
});
