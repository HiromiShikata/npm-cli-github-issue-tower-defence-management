import * as path from 'path';

// The status line writes each session's rendered reply time to
// `<STATUS_LINE_MARKER_ROOT_DIRECTORY>/claude-statusline-call-<uid>/<sessionId>.reply_ts`, and it
// resolves that root without consulting TMPDIR. The silent-session monitor runs from a daemon whose
// TMPDIR points at a separate volume, so resolving the same directory through the operating
// system temporary directory would send the reader to a path the writer never uses and the marker
// would silently never be found. CLAUDE_STATUSLINE_CALL_DIR is the single override both sides honour.
const STATUS_LINE_MARKER_ROOT_DIRECTORY = '/tmp';
const STATUS_LINE_MARKER_DIRECTORY_NAME_PREFIX = 'claude-statusline-call-';

export const ownerReplyMarkerDirectoryResolve = (
  configuredDirectory: string | null,
  environment: NodeJS.ProcessEnv,
  userId: number | null,
): string | null => {
  if (configuredDirectory !== null) {
    return configuredDirectory;
  }
  const tdpmEnvironmentDirectory =
    environment.TDPM_SILENT_OWNER_REPLY_MARKER_DIRECTORY;
  if (tdpmEnvironmentDirectory !== undefined) {
    return tdpmEnvironmentDirectory;
  }
  const statusLineEnvironmentDirectory = environment.CLAUDE_STATUSLINE_CALL_DIR;
  if (statusLineEnvironmentDirectory !== undefined) {
    return statusLineEnvironmentDirectory;
  }
  if (userId === null) {
    return null;
  }
  return path.join(
    STATUS_LINE_MARKER_ROOT_DIRECTORY,
    `${STATUS_LINE_MARKER_DIRECTORY_NAME_PREFIX}${userId}`,
  );
};
