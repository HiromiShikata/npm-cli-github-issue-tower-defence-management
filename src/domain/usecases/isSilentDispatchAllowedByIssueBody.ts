export const TDPM_SILENT_DISPATCH_ALLOWED_MARKER =
  '<!-- TDPM_SILENT_DISPATCH_ALLOWED -->';

export const isSilentDispatchAllowedByIssueBody = (
  body: string | null | undefined,
): boolean => {
  if (body === null || body === undefined) {
    return false;
  }
  return body.includes(TDPM_SILENT_DISPATCH_ALLOWED_MARKER);
};
