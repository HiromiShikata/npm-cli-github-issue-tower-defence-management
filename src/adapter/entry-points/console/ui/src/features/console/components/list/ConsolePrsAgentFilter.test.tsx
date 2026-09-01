import { fireEvent, render } from "@testing-library/react";
import { consoleAgentOptionsFixture } from "../../testing/fixtures";
import { ConsolePrsAgentFilter } from "./ConsolePrsAgentFilter";

describe("ConsolePrsAgentFilter", () => {
	it("renders a select with All agents and each agent option", () => {
		const { getByRole, getAllByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				selectedAgent={null}
				onAgentChange={() => {}}
			/>,
		);
		const select = getByRole("combobox", { name: "Filter by agent" });
		expect(select).toBeInTheDocument();
		const options = getAllByRole("option");
		expect(options[0]).toHaveTextContent("All agents");
		expect(options[0]).toHaveValue("");
		expect(options.length).toBe(consoleAgentOptionsFixture.length + 1);
	});

	it("shows the selected agent as the current value", () => {
		const { getByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				selectedAgent="developer"
				onAgentChange={() => {}}
			/>,
		);
		const select = getByRole("combobox", { name: "Filter by agent" });
		expect((select as HTMLSelectElement).value).toBe("developer");
	});

	it("calls onAgentChange with the selected agent name when an agent is chosen", () => {
		const onAgentChange = jest.fn();
		const { getByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				selectedAgent={null}
				onAgentChange={onAgentChange}
			/>,
		);
		fireEvent.change(getByRole("combobox", { name: "Filter by agent" }), {
			target: { value: "developer" },
		});
		expect(onAgentChange).toHaveBeenCalledWith("developer");
	});

	it("calls onAgentChange with null when All agents is selected", () => {
		const onAgentChange = jest.fn();
		const { getByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				selectedAgent="developer"
				onAgentChange={onAgentChange}
			/>,
		);
		fireEvent.change(getByRole("combobox", { name: "Filter by agent" }), {
			target: { value: "" },
		});
		expect(onAgentChange).toHaveBeenCalledWith(null);
	});

	it("renders nothing when agentOptions is empty", () => {
		const { container } = render(
			<ConsolePrsAgentFilter
				agentOptions={[]}
				selectedAgent={null}
				onAgentChange={() => {}}
			/>,
		);
		expect(container.firstChild).toBeNull();
	});
});
