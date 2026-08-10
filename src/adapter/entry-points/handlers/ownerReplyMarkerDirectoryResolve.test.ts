import { ownerReplyMarkerDirectoryResolve } from './ownerReplyMarkerDirectoryResolve';

describe('ownerReplyMarkerDirectoryResolve', () => {
  const userId = 1000;

  it('returns the directory the configuration supplies', () => {
    expect(
      ownerReplyMarkerDirectoryResolve(
        '/configured/markers',
        {
          TDPM_SILENT_OWNER_REPLY_MARKER_DIRECTORY: '/from/tdpm/environment',
          CLAUDE_STATUSLINE_CALL_DIR: '/from/status/line/environment',
        },
        userId,
      ),
    ).toBe('/configured/markers');
  });

  it('returns the directory the tdpm environment variable supplies when the configuration has none', () => {
    expect(
      ownerReplyMarkerDirectoryResolve(
        null,
        {
          TDPM_SILENT_OWNER_REPLY_MARKER_DIRECTORY: '/from/tdpm/environment',
          CLAUDE_STATUSLINE_CALL_DIR: '/from/status/line/environment',
        },
        userId,
      ),
    ).toBe('/from/tdpm/environment');
  });

  it('returns the directory the status line override supplies, so both sides move together', () => {
    expect(
      ownerReplyMarkerDirectoryResolve(
        null,
        { CLAUDE_STATUSLINE_CALL_DIR: '/from/status/line/environment' },
        userId,
      ),
    ).toBe('/from/status/line/environment');
  });

  it('resolves the directory the status line writes to and ignores a redirected temporary directory', () => {
    expect(
      ownerReplyMarkerDirectoryResolve(
        null,
        { TMPDIR: '/mnt/storage/tmp' },
        userId,
      ),
    ).toBe('/tmp/claude-statusline-call-1000');
  });

  it('returns null when the user id is unknown, because the directory name carries it', () => {
    expect(ownerReplyMarkerDirectoryResolve(null, {}, null)).toBeNull();
  });
});
