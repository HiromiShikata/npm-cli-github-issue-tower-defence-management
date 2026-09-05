export const buildWorkflowIncidentReportUrl = (
	workflowImprovementIssueUrl: string,
	referenceUrl: string,
): string => {
	const body = `Related: ${referenceUrl}`;
	const separator = workflowImprovementIssueUrl.includes("?") ? "&" : "?";
	return `${workflowImprovementIssueUrl}${separator}body=${encodeURIComponent(body)}`;
};
