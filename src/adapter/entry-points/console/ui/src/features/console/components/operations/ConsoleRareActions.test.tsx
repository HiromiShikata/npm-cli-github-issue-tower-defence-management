import { fireEvent, render, waitFor } from "@testing-library/react";
import { ConsoleRareActions } from "./ConsoleRareActions";

describe("ConsoleRareActions", () => {
	it("renders only the toggle button in the collapsed state", () => {
		const { getByTitle, queryByPlaceholderText } = render(
			<ConsoleRareActions onSetDependedIssueUrl={async () => {}} />,
		);
		expect(getByTitle("Rare actions")).toBeInTheDocument();
		expect(queryByPlaceholderText("Depended issue URL")).toBeNull();
	});

	it("reveals the URL input and Set Depended Issue button after the toggle is clicked", () => {
		const { getByTitle, getByPlaceholderText, getByText } = render(
			<ConsoleRareActions onSetDependedIssueUrl={async () => {}} />,
		);
		fireEvent.click(getByTitle("Rare actions"));
		expect(getByPlaceholderText("Depended issue URL")).toBeInTheDocument();
		expect(getByText("Set Depended Issue")).toBeInTheDocument();
	});

	it("collapses back when the toggle is clicked a second time", () => {
		const { getByTitle, queryByPlaceholderText } = render(
			<ConsoleRareActions onSetDependedIssueUrl={async () => {}} />,
		);
		fireEvent.click(getByTitle("Rare actions"));
		fireEvent.click(getByTitle("Rare actions"));
		expect(queryByPlaceholderText("Depended issue URL")).toBeNull();
	});

	it("keeps Set Depended Issue disabled when input is empty", () => {
		const { getByTitle, getByText } = render(
			<ConsoleRareActions onSetDependedIssueUrl={async () => {}} />,
		);
		fireEvent.click(getByTitle("Rare actions"));
		expect(getByText("Set Depended Issue")).toBeDisabled();
	});

	it("enables Set Depended Issue when a URL is entered", () => {
		const { getByTitle, getByPlaceholderText, getByText } = render(
			<ConsoleRareActions onSetDependedIssueUrl={async () => {}} />,
		);
		fireEvent.click(getByTitle("Rare actions"));
		fireEvent.change(getByPlaceholderText("Depended issue URL"), {
			target: { value: "https://github.com/owner/repo/issues/1" },
		});
		expect(getByText("Set Depended Issue")).not.toBeDisabled();
	});

	it("calls onSetDependedIssueUrl with the trimmed URL and collapses on success", async () => {
		const onSetDependedIssueUrl = jest.fn().mockResolvedValue(undefined);
		const {
			getByTitle,
			getByPlaceholderText,
			getByText,
			queryByPlaceholderText,
		} = render(
			<ConsoleRareActions onSetDependedIssueUrl={onSetDependedIssueUrl} />,
		);
		fireEvent.click(getByTitle("Rare actions"));
		fireEvent.change(getByPlaceholderText("Depended issue URL"), {
			target: { value: "  https://github.com/owner/repo/issues/42  " },
		});
		fireEvent.click(getByText("Set Depended Issue"));
		await waitFor(() =>
			expect(queryByPlaceholderText("Depended issue URL")).toBeNull(),
		);
		expect(onSetDependedIssueUrl).toHaveBeenCalledWith(
			"https://github.com/owner/repo/issues/42",
		);
	});

	it("shows an error message and stays expanded when the call fails", async () => {
		const onSetDependedIssueUrl = jest
			.fn()
			.mockRejectedValue(new Error("network error"));
		const { getByTitle, getByPlaceholderText, getByText } = render(
			<ConsoleRareActions onSetDependedIssueUrl={onSetDependedIssueUrl} />,
		);
		fireEvent.click(getByTitle("Rare actions"));
		fireEvent.change(getByPlaceholderText("Depended issue URL"), {
			target: { value: "https://github.com/owner/repo/issues/1" },
		});
		fireEvent.click(getByText("Set Depended Issue"));
		await waitFor(() => expect(getByText("network error")).toBeInTheDocument());
		expect(getByPlaceholderText("Depended issue URL")).toBeInTheDocument();
	});

	it("does not show the URL input or button when onSetDependedIssueUrl is null", () => {
		const { getByTitle, queryByPlaceholderText, queryByText } = render(
			<ConsoleRareActions onSetDependedIssueUrl={null} />,
		);
		fireEvent.click(getByTitle("Rare actions"));
		expect(queryByPlaceholderText("Depended issue URL")).toBeNull();
		expect(queryByText("Set Depended Issue")).toBeNull();
	});
});
