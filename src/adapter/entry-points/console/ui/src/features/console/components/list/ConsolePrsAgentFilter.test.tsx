import { fireEvent, render } from "@testing-library/react";
import { consoleAgentOptionsFixture } from "../../testing/fixtures";
import { ConsolePrsAgentFilter } from "./ConsolePrsAgentFilter";

const allAgentCounts: Record<string, number> = Object.fromEntries(
	consoleAgentOptionsFixture.map((o) => [o.name, 1]),
);

describe("ConsolePrsAgentFilter", () => {
	it("renders a select with All agents and only options that have tasks", () => {
		const agentCounts = { developer: 3, "pr-reviewer": 1 };
		const { getByRole, getAllByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				agentCounts={agentCounts}
				selectedAgent={null}
				onAgentChange={() => {}}
			/>,
		);
		const select = getByRole("combobox", { name: "Filter by agent" });
		expect(select).toBeInTheDocument();
		const options = getAllByRole("option");
		expect(options[0]).toHaveTextContent("All agents");
		expect(options[0]).toHaveValue("");
		expect(options.length).toBe(3);
	});

	it("shows the count in each option label", () => {
		const agentCounts = { developer: 5, triager: 2 };
		const { getAllByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				agentCounts={agentCounts}
				selectedAgent={null}
				onAgentChange={() => {}}
			/>,
		);
		const options = getAllByRole("option");
		const developerOption = options.find(
			(o) => o.getAttribute("value") === "developer",
		);
		const triagerOption = options.find(
			(o) => o.getAttribute("value") === "triager",
		);
		expect(developerOption).toHaveTextContent("developer (5)");
		expect(triagerOption).toHaveTextContent("triager (2)");
	});

	it("hides agents with zero tasks from the options list", () => {
		const agentCounts = { developer: 2 };
		const { queryByRole, getAllByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				agentCounts={agentCounts}
				selectedAgent={null}
				onAgentChange={() => {}}
			/>,
		);
		expect(
			queryByRole("combobox", { name: "Filter by agent" }),
		).toBeInTheDocument();
		const options = getAllByRole("option");
		expect(options.length).toBe(2);
		expect(options[1]).toHaveValue("developer");
	});

	it("shows the selected agent as the current value", () => {
		const { getByRole } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				agentCounts={allAgentCounts}
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
				agentCounts={allAgentCounts}
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
				agentCounts={allAgentCounts}
				selectedAgent="developer"
				onAgentChange={onAgentChange}
			/>,
		);
		fireEvent.change(getByRole("combobox", { name: "Filter by agent" }), {
			target: { value: "" },
		});
		expect(onAgentChange).toHaveBeenCalledWith(null);
	});

	it("renders nothing when all agents have zero tasks", () => {
		const { container } = render(
			<ConsolePrsAgentFilter
				agentOptions={consoleAgentOptionsFixture}
				agentCounts={{}}
				selectedAgent={null}
				onAgentChange={() => {}}
			/>,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing when agentOptions is empty", () => {
		const { container } = render(
			<ConsolePrsAgentFilter
				agentOptions={[]}
				agentCounts={{}}
				selectedAgent={null}
				onAgentChange={() => {}}
			/>,
		);
		expect(container.firstChild).toBeNull();
	});
});
