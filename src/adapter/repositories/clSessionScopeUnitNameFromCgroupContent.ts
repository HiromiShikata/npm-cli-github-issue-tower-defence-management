const CL_SESSION_SCOPE_UNIT_PATTERN = /cl-[A-Za-z0-9._-]+\.scope/;

export const clSessionScopeUnitNameFromCgroupContent = (
  cgroupContent: string,
): string | null => {
  const match = cgroupContent.match(CL_SESSION_SCOPE_UNIT_PATTERN);
  return match ? match[0] : null;
};
