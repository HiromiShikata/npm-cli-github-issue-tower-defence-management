import { fireEvent, render, screen } from "@testing-library/react";
import { ConsoleProjectSettingsModalScreen } from "./ConsoleProjectSettingsModalScreen";

const baseProps = {
	pjcodes: ["acme", "beta"],
	inputValues: { acme: "5", beta: "3" },
	onChangeInput: jest.fn(),
	isLoading: false,
	isSaving: false,
	error: null,
	onSave: jest.fn(),
	onClose: jest.fn(),
};

describe("ConsoleProjectSettingsModalScreen", () => {
	it("shows all projects with their current max values", () => {
		render(<ConsoleProjectSettingsModalScreen {...baseProps} />);
		const acmeInput = screen.getByLabelText(
			"Maximum preparing issues count for acme",
		);
		const betaInput = screen.getByLabelText(
			"Maximum preparing issues count for beta",
		);
		expect((acmeInput as HTMLInputElement).value).toBe("5");
		expect((betaInput as HTMLInputElement).value).toBe("3");
	});

	it("shows an empty input when no value is set for a project", () => {
		render(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				inputValues={{ acme: "", beta: "" }}
			/>,
		);
		const acmeInput = screen.getByLabelText(
			"Maximum preparing issues count for acme",
		);
		expect((acmeInput as HTMLInputElement).value).toBe("");
	});

	it("calls onChangeInput with the pjcode and new string value when the user types", () => {
		const onChangeInput = jest.fn();
		render(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				onChangeInput={onChangeInput}
			/>,
		);
		const acmeInput = screen.getByLabelText(
			"Maximum preparing issues count for acme",
		);
		fireEvent.change(acmeInput, { target: { value: "10" } });
		expect(onChangeInput).toHaveBeenCalledWith("acme", "10");
	});

	it("calls onSave when Save is clicked", () => {
		const onSave = jest.fn();
		render(
			<ConsoleProjectSettingsModalScreen {...baseProps} onSave={onSave} />,
		);
		fireEvent.click(screen.getByLabelText("Save max settings"));
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it("disables Save when all values are empty", () => {
		render(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				inputValues={{ acme: "", beta: "" }}
			/>,
		);
		expect(screen.getByLabelText("Save max settings")).toBeDisabled();
	});

	it("enables Save when at least one project has a valid value", () => {
		render(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				inputValues={{ acme: "5", beta: "" }}
			/>,
		);
		expect(screen.getByLabelText("Save max settings")).not.toBeDisabled();
	});

	it("enables Save when a project has value 0 (to disable auto-preparation)", () => {
		render(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				inputValues={{ acme: "0", beta: "" }}
			/>,
		);
		expect(screen.getByLabelText("Save max settings")).not.toBeDisabled();
	});

	it("disables Save when isSaving is true", () => {
		render(
			<ConsoleProjectSettingsModalScreen {...baseProps} isSaving={true} />,
		);
		expect(screen.getByLabelText("Save max settings")).toBeDisabled();
	});

	it("shows a loading state when isLoading is true", () => {
		render(
			<ConsoleProjectSettingsModalScreen {...baseProps} isLoading={true} />,
		);
		expect(screen.getByText("Loading…")).toBeInTheDocument();
		expect(
			screen.queryByLabelText("Maximum preparing issues count for acme"),
		).toBeNull();
	});

	it("shows an error message when error is set", () => {
		render(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				error="Something went wrong"
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
	});

	it("calls onClose when the close button is clicked", () => {
		const onClose = jest.fn();
		render(
			<ConsoleProjectSettingsModalScreen {...baseProps} onClose={onClose} />,
		);
		fireEvent.click(screen.getByLabelText("Close max settings"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("shows updated input value on rerender", () => {
		const { rerender } = render(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				inputValues={{ acme: "3", beta: "3" }}
			/>,
		);
		let acmeInput = screen.getByLabelText(
			"Maximum preparing issues count for acme",
		);
		expect((acmeInput as HTMLInputElement).value).toBe("3");
		rerender(
			<ConsoleProjectSettingsModalScreen
				{...baseProps}
				inputValues={{ acme: "9", beta: "3" }}
			/>,
		);
		acmeInput = screen.getByLabelText(
			"Maximum preparing issues count for acme",
		);
		expect((acmeInput as HTMLInputElement).value).toBe("9");
	});

	it("labels the dialog as Max settings", () => {
		render(<ConsoleProjectSettingsModalScreen {...baseProps} />);
		expect(screen.getByRole("dialog")).toHaveAttribute(
			"aria-label",
			"Max settings",
		);
	});
});
