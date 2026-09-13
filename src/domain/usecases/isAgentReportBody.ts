import { normalizeProjectFieldName } from "../entities/ProjectFieldName";
import { extractFencedJsonBlocks } from "./extractFencedJsonBlocks";
import { normalizeReportBody } from "./normalizeReportBody";

const FENCE_OPENING = /^ {0,3}(`{3,}|~{3,})/;

const isFenceClosingLine = (line: string, marker: string): boolean => {
	const trimmed = line.trim();
	return (
		trimmed.length >= marker.length &&
		[...trimmed].every((character) => character === marker[0])
	);
};

export const stripLeadingFencedBlocks = (body: string): string => {
	const lines = normalizeReportBody(body).split("\n");
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (line.trim() === "") {
			index += 1;
			continue;
		}
		const opening = FENCE_OPENING.exec(line);
		if (!opening) {
			break;
		}
		const marker = opening[1];
		let closingIndex = index + 1;
		while (
			closingIndex < lines.length &&
			!isFenceClosingLine(lines[closingIndex], marker)
		) {
			closingIndex += 1;
		}
		if (closingIndex >= lines.length) {
			return "";
		}
		index = closingIndex + 1;
	}
	return lines.slice(index).join("\n");
};

export const isAgentReportBody = (body: string): boolean =>
	extractFencedJsonBlocks(body, "isAgentReportBody").some(
		(block) =>
			typeof block === "object" && block !== null && !Array.isArray(block),
	);

export const isAgentReportBodyFromAgent = (
	body: string,
	agentName: string,
	agentFieldValue: string | null | undefined,
): boolean =>
	agentFieldValue != null &&
	isAgentReportBody(body) &&
	normalizeProjectFieldName(agentFieldValue) ===
		normalizeProjectFieldName(agentName);
