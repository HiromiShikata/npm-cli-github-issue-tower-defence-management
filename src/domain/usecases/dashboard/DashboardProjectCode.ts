export const DASHBOARD_DISPLAY_LABEL_LENGTH = 2;

export const toDashboardDisplayLabel = (projectName: string): string => {
  if (projectName.length < DASHBOARD_DISPLAY_LABEL_LENGTH) {
    throw new Error(
      `Dashboard project name is shorter than the ${DASHBOARD_DISPLAY_LABEL_LENGTH}-character display label: ${projectName}`,
    );
  }
  return projectName.slice(0, DASHBOARD_DISPLAY_LABEL_LENGTH);
};

export const assertDashboardDisplayLabelsUnique = (
  projectNames: string[],
): void => {
  const projectNameByDisplayLabel = new Map<string, string>();
  for (const projectName of projectNames) {
    const displayLabel = toDashboardDisplayLabel(projectName);
    const alreadyRegistered =
      projectNameByDisplayLabel.get(displayLabel) ?? null;
    if (alreadyRegistered !== null) {
      throw new Error(
        `Dashboard project names ${alreadyRegistered} and ${projectName} share the display label ${displayLabel}`,
      );
    }
    projectNameByDisplayLabel.set(displayLabel, projectName);
  }
};
