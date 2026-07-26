export const clSessionScopeUnitName = (sessionName: string): string => {
  const safe = sessionName.replace(/[^a-zA-Z0-9]/g, '-');
  const raw = `cl-${safe}`;
  return `${raw.replace(/[^a-zA-Z0-9._-]/g, '-')}.scope`;
};
