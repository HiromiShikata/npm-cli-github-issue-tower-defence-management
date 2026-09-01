import * as fs from "fs";
import { mock } from "jest-mock-extended";
import * as os from "os";
import * as path from "path";
import type { IssueRepository } from "../../../domain/usecases/adapter-interfaces/IssueRepository";
import {
	type AirplaneSnapshotPayload,
	type AirplaneSyncResponseWriter,
	handleAirplaneSync,
} from "./consoleAirplaneSnapshotApi";
import { IssueTitleStateCache, PullRequestStatusCache } from "./consoleReadApi";

type DoneEvent = { type: "done"; snapshot: AirplaneSnapshotPayload };

const isDoneEvent = (e: unknown): e is DoneEvent => {
	if (typeof e !== "object" || e === null) return false;
	if (!("type" in e) || !("snapshot" in e)) return false;
	return e.type === "done";
};

const captureEvents = (writer: { writtenData: string[] }): unknown[] => {
	const result: unknown[] = [];
	for (const chunk of writer.writtenData.join("").split("\n\n")) {
		if (chunk.startsWith("data: ")) {
			const parsed: unknown = JSON.parse(chunk.slice("data: ".length));
			result.push(parsed);
		}
	}
	return result;
};

const buildResponseWriter = (): AirplaneSyncResponseWriter & {
	writtenData: string[];
} => {
	const writtenData: string[] = [];
	return {
		writtenData,
		writeHead: () => {},
		write: (data: string) => {
			writtenData.push(data);
		},
		end: () => {},
	};
};

const writeListJson = (
	dir: string,
	pjcode: string,
	tab: string,
	payload: unknown,
): void => {
	const tabDir = path.join(dir, pjcode, tab);
	fs.mkdirSync(tabDir, { recursive: true });
	fs.writeFileSync(path.join(tabDir, "list.json"), JSON.stringify(payload));
};

describe("handleAirplaneSync", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "airplane-sync-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	it("calls getOpenPullRequestCiStatus and getPullRequestSummary for each cached related PR URL instead of findRelatedOpenPRs", async () => {
		const issueUrl = "https://github.com/o/r/issues/1";
		const prUrl1 = "https://github.com/o/r/pull/10";
		const prUrl2 = "https://github.com/o/r/pull/11";

		writeListJson(tmpDir, "pj1", "todo-by-agent", {
			items: [
				{
					url: issueUrl,
					isPr: false,
					relatedOpenPullRequestUrls: [prUrl1, prUrl2],
				},
			],
		});

		const issueRepository = mock<IssueRepository>();
		issueRepository.getIssueOrPullRequestBody.mockResolvedValue("issue body");
		issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
		issueRepository.getIssueOrPullRequestState.mockResolvedValue({
			state: "open",
			merged: false,
			isPullRequest: false,
			title: "Issue title",
		});
		issueRepository.getOpenPullRequestCiStatus.mockImplementation(
			async (url: string) => ({
				url,
				branchName: "feature-branch",
				createdAt: "2024-01-01T00:00:00Z",
				isDraft: false,
				isConflicted: false,
				mergeable: "MERGEABLE",
				isPassedAllCiJob: true,
				isCiStateSuccess: true,
				isBranchOutOfDate: false,
				missingRequiredCheckNames: [],
			}),
		);
		issueRepository.getPullRequestSummary.mockResolvedValue({
			title: "PR title",
			body: "PR body",
			additions: 5,
			deletions: 2,
			changedFiles: 1,
		});

		const response = buildResponseWriter();
		await handleAirplaneSync(
			response,
			tmpDir,
			() => issueRepository,
			new IssueTitleStateCache(),
			new PullRequestStatusCache(),
		);

		expect(issueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
		expect(issueRepository.getOpenPullRequestCiStatus).toHaveBeenCalledWith(
			prUrl1,
		);
		expect(issueRepository.getOpenPullRequestCiStatus).toHaveBeenCalledWith(
			prUrl2,
		);
		expect(issueRepository.getPullRequestSummary).toHaveBeenCalledWith(prUrl1);
		expect(issueRepository.getPullRequestSummary).toHaveBeenCalledWith(prUrl2);

		const events = captureEvents(response);
		const doneEvent = events.find(isDoneEvent);
		expect(doneEvent).toBeDefined();
		const itemData = doneEvent?.snapshot.items[issueUrl];
		expect(itemData).toBeDefined();
		expect(itemData?.relatedPrs).toHaveLength(2);
		expect(itemData?.relatedPrs?.[0].url).toBe(prUrl1);
		expect(itemData?.relatedPrs?.[1].url).toBe(prUrl2);
		expect(itemData?.relatedPrs?.[0].isResolvedAllReviewComments).toBe(false);
	});

	it("excludes related PRs where getOpenPullRequestCiStatus returns null", async () => {
		const issueUrl = "https://github.com/o/r/issues/2";
		const prUrlOpen = "https://github.com/o/r/pull/20";
		const prUrlClosed = "https://github.com/o/r/pull/21";

		writeListJson(tmpDir, "pj1", "todo-by-agent", {
			items: [
				{
					url: issueUrl,
					isPr: false,
					relatedOpenPullRequestUrls: [prUrlOpen, prUrlClosed],
				},
			],
		});

		const issueRepository = mock<IssueRepository>();
		issueRepository.getIssueOrPullRequestBody.mockResolvedValue("");
		issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
		issueRepository.getIssueOrPullRequestState.mockResolvedValue({
			state: "open",
			merged: false,
			isPullRequest: false,
			title: "Issue title",
		});
		issueRepository.getOpenPullRequestCiStatus.mockImplementation(
			async (url: string) =>
				url === prUrlOpen
					? {
							url,
							branchName: null,
							createdAt: "2024-02-01T00:00:00Z",
							isDraft: false,
							isConflicted: false,
							mergeable: "MERGEABLE",
							isPassedAllCiJob: true,
							isCiStateSuccess: true,
							isBranchOutOfDate: false,
							missingRequiredCheckNames: [],
						}
					: null,
		);
		issueRepository.getPullRequestSummary.mockResolvedValue(null);

		const response = buildResponseWriter();
		await handleAirplaneSync(
			response,
			tmpDir,
			() => issueRepository,
			new IssueTitleStateCache(),
			new PullRequestStatusCache(),
		);

		const events = captureEvents(response);
		const doneEvent = events.find(isDoneEvent);
		const itemData = doneEvent?.snapshot.items[issueUrl];
		expect(itemData?.relatedPrs).toHaveLength(1);
		expect(itemData?.relatedPrs?.[0].url).toBe(prUrlOpen);
		expect(issueRepository.getPullRequestSummary).not.toHaveBeenCalledWith(
			prUrlClosed,
		);
	});

	it("produces an empty relatedPrs array when no cached PR URLs are present", async () => {
		const issueUrl = "https://github.com/o/r/issues/3";

		writeListJson(tmpDir, "pj1", "todo-by-agent", {
			items: [
				{
					url: issueUrl,
					isPr: false,
					relatedOpenPullRequestUrls: [],
				},
			],
		});

		const issueRepository = mock<IssueRepository>();
		issueRepository.getIssueOrPullRequestBody.mockResolvedValue("");
		issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
		issueRepository.getIssueOrPullRequestState.mockResolvedValue({
			state: "open",
			merged: false,
			isPullRequest: false,
			title: "Issue title",
		});

		const response = buildResponseWriter();
		await handleAirplaneSync(
			response,
			tmpDir,
			() => issueRepository,
			new IssueTitleStateCache(),
			new PullRequestStatusCache(),
		);

		const events = captureEvents(response);
		const doneEvent = events.find(isDoneEvent);
		const itemData = doneEvent?.snapshot.items[issueUrl];
		expect(itemData?.relatedPrs).toEqual([]);
		expect(issueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
		expect(issueRepository.getOpenPullRequestCiStatus).not.toHaveBeenCalled();
	});

	it("emits progress events then a done event containing snapshot data", async () => {
		const issueUrl = "https://github.com/o/r/issues/4";
		writeListJson(tmpDir, "pj1", "todo-by-agent", {
			items: [{ url: issueUrl, isPr: false, relatedOpenPullRequestUrls: [] }],
		});

		const issueRepository = mock<IssueRepository>();
		issueRepository.getIssueOrPullRequestBody.mockResolvedValue("body");
		issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
		issueRepository.getIssueOrPullRequestState.mockResolvedValue({
			state: "open",
			merged: false,
			isPullRequest: false,
			title: "Title",
		});

		const response = buildResponseWriter();
		await handleAirplaneSync(
			response,
			tmpDir,
			() => issueRepository,
			new IssueTitleStateCache(),
			new PullRequestStatusCache(),
		);

		const events = captureEvents(response);
		const progressEvents = events.filter(
			(e) =>
				typeof e === "object" &&
				e !== null &&
				"type" in e &&
				e.type === "progress",
		);
		const doneEvent = events.find(isDoneEvent);

		expect(progressEvents.length).toBeGreaterThanOrEqual(1);
		expect(doneEvent).toBeDefined();
		expect(doneEvent?.snapshot.capturedAt).toBeTruthy();
	});
});
