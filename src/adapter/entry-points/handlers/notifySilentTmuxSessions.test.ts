import { notifySilentTmuxSessions } from './notifySilentTmuxSessions';

describe('notifySilentTmuxSessions', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when the step is not enabled', async () => {
    await notifySilentTmuxSessions({ enabled: false });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('skipped'),
    );
  });

  it('logs that no notifications are sent when enabled', async () => {
    await notifySilentTmuxSessions({ enabled: true });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('no notifications to send'),
    );
  });
});
