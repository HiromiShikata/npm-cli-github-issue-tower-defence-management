import { DefaultSilentSessionMessageComposer } from './DefaultSilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from './silentSessionReminderSentinel';

describe('DefaultSilentSessionMessageComposer', () => {
  const composer = new DefaultSilentSessionMessageComposer();

  it('embeds the reminder sentinel in the main-stalled section', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('embeds the reminder sentinel in the owner-re-notification section', () => {
    const section = composer.composeOwnerReNotificationSection(1800);
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('instructs the agent to re-raise its pending call-to-user without treating the reminder as an owner reply', () => {
    const section = composer.composeOwnerReNotificationSection(1800);
    expect(section).toContain('waiting on the owner for 30 minutes');
    expect(section).toContain('NOT the owner replying');
    expect(section).toContain('Re-raise your pending call-to-user');
    expect(section).toContain('you are not stalled or idle');
    expect(section.toLowerCase()).not.toContain('no output for');
  });

  it('embeds the reminder sentinel in the sub-agent section', () => {
    const section = composer.composeSubAgentSection([
      { label: 'sub-process-1', silentSeconds: 360, runningSeconds: 1200 },
    ]);
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('renders the configured main-stalled message with the silent minutes substituted', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('You have produced no output for 10 minutes.');
    expect(section).toContain('Idle waiting wastes this live session');
    expect(section).toContain(
      'Always work proactively and stay ahead of the work',
    );
    expect(section).toContain('never wait passively');
    expect(section).toContain('Self-check now:');
    expect(section).toContain('1.');
    expect(section).toContain('2.');
    expect(section).toContain('3.');
    expect(section).toContain('4.');
    expect(section).toContain(
      'report an estimate of how many minutes you expect to need',
    );
  });

  it('floors the silent seconds to whole minutes', () => {
    const section = composer.composeMainStalledSection(659);
    expect(section).toContain('You have produced no output for 10 minutes.');
  });

  it('lists each sub-agent with its silent and running minutes', () => {
    const section = composer.composeSubAgentSection([
      { label: 'sub-process-1', silentSeconds: 360, runningSeconds: 1200 },
      { label: 'sub-process-2', silentSeconds: 0, runningSeconds: 960 },
    ]);
    expect(section).toContain('sub-process-1');
    expect(section).toContain('silent for 6m');
    expect(section).toContain('running for 20m');
    expect(section).toContain('sub-process-2');
    expect(section).toContain('running for 16m');
  });

  it('does not contain any host-specific or internal identifiers', () => {
    const mainSection = composer.composeMainStalledSection(600);
    const ownerSection = composer.composeOwnerReNotificationSection(1800);
    const subSection = composer.composeSubAgentSection([
      { label: 'sub-process-1', silentSeconds: 360, runningSeconds: 1200 },
    ]);
    const combined =
      `${mainSection}\n${ownerSection}\n${subSection}`.toLowerCase();
    expect(combined).not.toContain('claude');
    expect(combined).not.toContain('take ownership');
    expect(combined).not.toContain('/home/');
    expect(combined).not.toContain('.jsonl');
  });
});
