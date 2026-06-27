export const DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME: Record<string, string> = {
  umino: 'um',
  xmile: 'xm',
  xcare: 'xc',
  utage3: 'ut',
};

export const DASHBOARD_PROJECT_NAMES: string[] = Object.keys(
  DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME,
);

export const toDashboardDisplayLabel = (projectName: string): string => {
  const label = DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME[projectName];
  if (label === undefined) {
    throw new Error(
      `Unknown dashboard project name: ${projectName}. Add it to DASHBOARD_DISPLAY_LABEL_BY_PROJECT_NAME.`,
    );
  }
  return label;
};
