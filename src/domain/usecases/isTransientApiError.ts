const HTTP_STATUS_CODE_IN_CONTEXT_PATTERN =
  /(?:^|\bstatus\s+code\s+|\bHTTP\s+)(?:401|403|429|500|502|503|504)\b|\b(?:401|403|429|500|502|503|504)\b\s+(?:Unauthorized|Forbidden|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)|\bAPI:\s*(?:401|403|429|500|502|503|504)\b\s*$/i;

export const isTransientApiError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message;
  return (
    HTTP_STATUS_CODE_IN_CONTEXT_PATTERN.test(msg) ||
    /rate.?limit|RATE_LIMIT/i.test(msg) ||
    /bad credentials/i.test(msg) ||
    error.name === 'TimeoutError' ||
    /request timed out/i.test(msg) ||
    /does not belong to the field/i.test(msg) ||
    /^Something went wrong while executing your query on /i.test(msg)
  );
};
