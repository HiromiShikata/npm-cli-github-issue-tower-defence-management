import { DefaultSilentSessionMessageComposer } from './DefaultSilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from './silentSessionReminderSentinel';

describe('DefaultSilentSessionMessageComposer', () => {
  const composer = new DefaultSilentSessionMessageComposer();

  it('embeds the reminder sentinel in the main-stalled section', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
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

  it('instructs the required owner-call notification format with the leading red circle and single-line complete tag', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('🔴');
    expect(section).toContain(
      'The content between the markers MUST begin with the 🔴 emoji immediately, with no space after it.',
    );
    expect(section).toContain(
      'complete matching pair — opening marker, content, then closing marker — on a single line with no newline inside the tag.',
    );
    expect(section).toContain(
      'a malformed tag (a broken or missing closing marker, or a missing leading 🔴) results in only a red indicator with no readable content.',
    );
  });

  it('instructs the agent to fire the owner-call when an owner request has been completed or answered', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'If you have COMPLETED or ANSWERED a request from the owner in this session, you MUST fire the owner-call to report the RESULT to the owner',
    );
    expect(section).toContain(
      "completing or answering an owner's requested action is itself a reason to fire the owner-call",
    );
  });

  it('explains that completing an owner request without an owner-call leaves the owner unnotified', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'Completing or answering an owner request WITHOUT firing the owner-call means the owner is NEVER notified',
    );
    expect(section).toContain(
      "the owner's app only surfaces this session when the owner-call fires",
    );
  });

  it('states the causal link that the reminder keeps arriving because no owner-call was fired', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'If this self-check reminder keeps arriving, it is likely because an owner request was completed or answered without firing the owner-call; fire the owner-call now to report the result to the owner.',
    );
  });

  it('interpolates the configured owner-call marker into the format guidance when provided', () => {
    const markedComposer = new DefaultSilentSessionMessageComposer(
      '<<OWNER_CALL>>',
    );
    const section = markedComposer.composeMainStalledSection(600);
    expect(section).toContain(
      'the configured owner-call marker tag "<<OWNER_CALL>>" as a complete matching pair',
    );
    expect(section).toContain('🔴');
  });

  it('falls back to generic owner-call format guidance when no marker is configured', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'Emit the owner-call as the configured owner-call marker tag as a complete matching pair',
    );
    expect(section).not.toContain('""');
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
    const subSection = composer.composeSubAgentSection([
      { label: 'sub-process-1', silentSeconds: 360, runningSeconds: 1200 },
    ]);
    const combined = `${mainSection}\n${subSection}`.toLowerCase();
    expect(combined).not.toContain('claude');
    expect(combined).not.toContain('take ownership');
    expect(combined).not.toContain('/home/');
    expect(combined).not.toContain('.jsonl');
  });
});
