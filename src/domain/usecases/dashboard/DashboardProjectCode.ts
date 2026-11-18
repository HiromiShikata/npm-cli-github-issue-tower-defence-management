export const DASHBOARD_DISPLAY_LABEL_LENGTH = 2;

export const toDashboardDisplayLabel = (projectName: string): string => {
  if (projectName.length < DASHBOARD_DISPLAY_LABEL_LENGTH) {
    throw new Error(
      `Dashboard project name is shorter than the ${DASHBOARD_DISPLAY_LABEL_LENGTH}-character display label: ${projectName}`,
    );
  }
  return projectName.slice(0, DASHBOARD_DISPLAY_LABEL_LENGTH);
};

const commonPrefixLength = (first: string, second: string): number => {
  let length = 0;
  while (
    length < first.length &&
    length < second.length &&
    first[length] === second[length]
  ) {
    length++;
  }
  return length;
};

const chooseDashboardDisplayLabel = (
  projectName: string,
  labeledProjectNames: string[],
  usedLabels: Set<string>,
): string | null => {
  const leadingLabel = toDashboardDisplayLabel(projectName);
  if (!usedLabels.has(leadingLabel)) {
    return leadingLabel;
  }
  const longestSharedPrefix = Math.max(
    0,
    ...labeledProjectNames.map((labeledName) =>
      commonPrefixLength(projectName, labeledName),
    ),
  );
  const divergingCharacter = projectName.charAt(longestSharedPrefix);
  const divergingLabel = `${projectName.charAt(0)}${divergingCharacter}`;
  if (divergingCharacter !== '' && !usedLabels.has(divergingLabel)) {
    return divergingLabel;
  }
  for (let index = 1; index < projectName.length; index++) {
    const candidateLabel = `${projectName.charAt(0)}${projectName.charAt(index)}`;
    if (!usedLabels.has(candidateLabel)) {
      return candidateLabel;
    }
  }
  return null;
};

export const assignDashboardDisplayLabels = (
  projectNames: string[],
): Map<string, string> => {
  const displayLabelByProjectName = new Map<string, string>();
  const usedLabels = new Set<string>();
  for (const projectName of projectNames) {
    if (displayLabelByProjectName.has(projectName)) {
      throw new Error(
        `Dashboard project name ${projectName} is listed more than once`,
      );
    }
    const displayLabel = chooseDashboardDisplayLabel(
      projectName,
      Array.from(displayLabelByProjectName.keys()),
      usedLabels,
    );
    if (displayLabel === null) {
      throw new Error(
        `Dashboard project name ${projectName} cannot be given a distinct ${DASHBOARD_DISPLAY_LABEL_LENGTH}-character display label`,
      );
    }
    displayLabelByProjectName.set(projectName, displayLabel);
    usedLabels.add(displayLabel);
  }
  return displayLabelByProjectName;
};
