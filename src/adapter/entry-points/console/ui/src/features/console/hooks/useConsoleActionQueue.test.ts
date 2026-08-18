import { act, renderHook } from "@testing-library/react";
import { useConsoleActionQueue } from "./useConsoleActionQueue";

const OFFLINE_QUEUE_STORAGE_KEY = "console-offline-action-queue";

const offlinePayload = {
	itemUrl: "https://github.com/o/r/pull/851",
	projectItemId: "PVTI_1",
	itemNumber: 851,
	repo: "o/r",
	isPr: true,
	apiPath: "/api/review",
	requestBody: {
		pjcode: "acme",
		action: "approve",
		prUrl: "https://github.com/o/r/pull/851",
		projectItemId: "PVTI_1",
	},
};

const makeAction = (
	overrides: Partial<
		Parameters<ReturnType<typeof useConsoleActionQueue>["enqueue"]>[0]
	> = {},
) => ({
	message: "Approved — PR #851",
	color: "green" as const,
	commit: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
	advance: jest.fn(),
	...overrides,
});

const flushMicrotasks = (): Promise<void> =>
	Promise.resolve().then(() => undefined);

describe("useConsoleActionQueue", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		localStorage.clear();
	});

	afterEach(() => {
		jest.useRealTimers();
		localStorage.clear();
	});

	it("advances immediately but only commits after the five second window", () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction();
		act(() => {
			result.current.enqueue(action);
		});
		expect(action.advance).toHaveBeenCalledTimes(1);
		expect(action.commit).not.toHaveBeenCalled();
		expect(result.current.pending?.message).toBe("Approved — PR #851");
		expect(result.current.pending?.remainingSeconds).toBe(5);

		act(() => {
			jest.advanceTimersByTime(4900);
		});
		expect(action.commit).not.toHaveBeenCalled();

		act(() => {
			jest.advanceTimersByTime(200);
		});
		expect(action.commit).toHaveBeenCalledTimes(1);
		expect(result.current.pending).toBeNull();
	});

	it("counts the remaining seconds down during the window", () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		act(() => {
			result.current.enqueue(makeAction());
		});
		act(() => {
			jest.advanceTimersByTime(2000);
		});
		expect(result.current.pending?.remainingSeconds).toBe(3);
		expect(result.current.pending?.progress).toBeCloseTo(0.6, 1);
	});

	it("cancels the command when undo is called within the window", () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction();
		act(() => {
			result.current.enqueue(action);
		});
		act(() => {
			jest.advanceTimersByTime(2000);
			result.current.undo();
		});
		expect(result.current.pending).toBeNull();
		act(() => {
			jest.advanceTimersByTime(5000);
		});
		expect(action.commit).not.toHaveBeenCalled();
	});

	it("flushes the previous pending action when a new one is enqueued", () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const first = makeAction({ message: "Approved — PR #851" });
		const second = makeAction({
			message: "Rejected — PR #853",
			color: "amber",
		});
		act(() => {
			result.current.enqueue(first);
		});
		act(() => {
			jest.advanceTimersByTime(1000);
			result.current.enqueue(second);
		});
		expect(first.commit).toHaveBeenCalledTimes(1);
		expect(second.commit).not.toHaveBeenCalled();
		expect(result.current.pending?.message).toBe("Rejected — PR #853");
		act(() => {
			jest.advanceTimersByTime(5000);
		});
		expect(second.commit).toHaveBeenCalledTimes(1);
	});

	it("does not commit twice if the window elapses after a manual flush", () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const first = makeAction();
		const second = makeAction({ message: "Closed — #845", color: "red" });
		act(() => {
			result.current.enqueue(first);
		});
		act(() => {
			result.current.enqueue(second);
		});
		expect(first.commit).toHaveBeenCalledTimes(1);
		act(() => {
			jest.advanceTimersByTime(6000);
		});
		expect(first.commit).toHaveBeenCalledTimes(1);
		expect(second.commit).toHaveBeenCalledTimes(1);
	});

	it("surfaces the failure reason when the timer commit rejects", async () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new Error("HTTP 422 review cannot be requested")),
		});
		act(() => {
			result.current.enqueue(action);
		});
		expect(result.current.error).toBeNull();
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		expect(action.commit).toHaveBeenCalledTimes(1);
		expect(result.current.error).toEqual({
			message: "Approved — PR #851",
			reason: "HTTP 422 review cannot be requested",
		});
	});

	it("surfaces the failure reason when the previous action commit rejects on enqueue", async () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const first = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new Error("network down")),
		});
		const second = makeAction({
			message: "Rejected — PR #853",
			color: "amber",
		});
		act(() => {
			result.current.enqueue(first);
		});
		await act(async () => {
			jest.advanceTimersByTime(1000);
			result.current.enqueue(second);
			await flushMicrotasks();
		});
		expect(first.commit).toHaveBeenCalledTimes(1);
		expect(result.current.error).toEqual({
			message: "Approved — PR #851",
			reason: "network down",
		});
	});

	it("clears the surfaced error when dismissError is called", async () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest.fn<Promise<void>, []>().mockRejectedValue(new Error("boom")),
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		expect(result.current.error).not.toBeNull();
		act(() => {
			result.current.dismissError();
		});
		expect(result.current.error).toBeNull();
	});

	it("does not surface an error when the commit resolves", async () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction();
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		expect(result.current.error).toBeNull();
	});

	it("adds the action to the offline queue when the commit rejects with a network error", async () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new TypeError("Failed to fetch")),
			offline: offlinePayload,
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		expect(result.current.error).toBeNull();
		expect(result.current.offlineActions).toHaveLength(1);
		expect(result.current.offlineActions[0].message).toBe("Approved — PR #851");
		expect(result.current.offlineActions[0].apiPath).toBe("/api/review");
	});

	it("surfaces a server error as an error rather than queuing it offline", async () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new Error("HTTP 422 review cannot be requested")),
			offline: offlinePayload,
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		expect(result.current.error).toEqual({
			message: "Approved — PR #851",
			reason: "HTTP 422 review cannot be requested",
		});
		expect(result.current.offlineActions).toHaveLength(0);
	});

	it("keeps the offline queue in localStorage so it survives a remount", async () => {
		const { result, unmount } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new TypeError("Failed to fetch")),
			offline: offlinePayload,
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		expect(result.current.offlineActions).toHaveLength(1);
		unmount();

		const { result: result2 } = renderHook(() => useConsoleActionQueue());
		expect(result2.current.offlineActions).toHaveLength(1);
		expect(result2.current.offlineActions[0].message).toBe(
			"Approved — PR #851",
		);
	});

	it("does not send anything before confirmOfflineAction is called", async () => {
		const fetchMock = jest.fn();
		global.fetch = fetchMock as unknown as typeof fetch;
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new TypeError("Failed to fetch")),
			offline: offlinePayload,
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		expect(result.current.offlineActions).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("sends the stored request and removes the action when confirmOfflineAction is called", async () => {
		const fetchMock = jest.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({}),
		}));
		global.fetch = fetchMock as unknown as typeof fetch;
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new TypeError("Failed to fetch")),
			offline: offlinePayload,
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		const id = result.current.offlineActions[0].id;
		await act(async () => {
			await result.current.confirmOfflineAction(id);
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/review",
			expect.objectContaining({ method: "POST" }),
		);
		expect(result.current.offlineActions).toHaveLength(0);
		expect(result.current.error).toBeNull();
	});

	it("surfaces a server rejection from confirmOfflineAction as an error and removes the action", async () => {
		const fetchMock = jest.fn(async () => ({
			ok: false,
			status: 422,
			text: async () => "review cannot be requested",
		}));
		global.fetch = fetchMock as unknown as typeof fetch;
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new TypeError("Failed to fetch")),
			offline: offlinePayload,
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		const id = result.current.offlineActions[0].id;
		await act(async () => {
			await result.current.confirmOfflineAction(id);
		});
		expect(result.current.error).not.toBeNull();
		expect(result.current.offlineActions).toHaveLength(0);
	});

	it("removes the action from localStorage when discardOfflineAction is called", async () => {
		const { result } = renderHook(() => useConsoleActionQueue());
		const action = makeAction({
			commit: jest
				.fn<Promise<void>, []>()
				.mockRejectedValue(new TypeError("Failed to fetch")),
			offline: offlinePayload,
		});
		act(() => {
			result.current.enqueue(action);
		});
		await act(async () => {
			jest.advanceTimersByTime(5000);
			await flushMicrotasks();
		});
		const id = result.current.offlineActions[0].id;
		act(() => {
			result.current.discardOfflineAction(id);
		});
		expect(result.current.offlineActions).toHaveLength(0);
		const stored: unknown[] = JSON.parse(
			localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) ?? "[]",
		);
		expect(stored).toHaveLength(0);
	});
});
