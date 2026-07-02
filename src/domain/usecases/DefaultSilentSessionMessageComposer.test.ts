import { DefaultSilentSessionMessageComposer } from './DefaultSilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from './silentSessionReminderSentinel';

const THRESHOLDS = {
  subAgentSilentThresholdSeconds: 300,
  subAgentRunningThresholdSeconds: 900,
};

describe('DefaultSilentSessionMessageComposer', () => {
  const composer = new DefaultSilentSessionMessageComposer();

  it('embeds the reminder sentinel in the main-stalled section', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('embeds the reminder sentinel in the sub-agent section', () => {
    const section = composer.composeSubAgentSection(
      [{ label: 'sub-process-1', silentSeconds: 360, runningSeconds: 1200 }],
      THRESHOLDS,
    );
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

  it('emits a distinct idle message for a sub-agent that is only output-idle', () => {
    const section = composer.composeSubAgentSection(
      [{ label: 'sub-process-idle', silentSeconds: 360, runningSeconds: 60 }],
      THRESHOLDS,
    );
    expect(section).toContain('sub-process-idle');
    expect(section).toContain('no output for 6m');
    expect(section).toContain('restart, hand off, or replace it');
    expect(section).toContain('waiting on an external dependency');
    expect(section).not.toContain('infinite loop');
  });

  it('presents the system-detected idle duration as the authoritative signal in the idle message', () => {
    const section = composer.composeSubAgentSection(
      [{ label: 'sub-process-idle', silentSeconds: 360, runningSeconds: 60 }],
      THRESHOLDS,
    );
    expect(section).toContain(
      "The system has already detected, from each sub-process's last tool activity, that it has produced no output for about the minutes shown below.",
    );
    expect(section).toContain(
      'Treat that figure as the authoritative system signal; do NOT spend effort re-deriving whether the sub-process is alive.',
    );
    expect(section).toContain('no output for 6m');
  });

  it('forbids speculation and dismissal without evidence in the idle message', () => {
    const section = composer.composeSubAgentSection(
      [{ label: 'sub-process-idle', silentSeconds: 360, runningSeconds: 60 }],
      THRESHOLDS,
    );
    expect(section).toContain(
      'Around five minutes of silence is a real warning of a possible hang',
    );
    expect(section).toContain(
      'do NOT speak from speculation ("probably still working") and do NOT dismiss it without evidence.',
    );
  });

  it('requires a concrete cause-check covering recent activity and external-dependency waiting in the idle message', () => {
    const section = composer.composeSubAgentSection(
      [{ label: 'sub-process-idle', silentSeconds: 360, runningSeconds: 60 }],
      THRESHOLDS,
    );
    expect(section).toContain('determine the CAUSE by a concrete check');
    expect(section).toContain(
      'a very recent push or commit, or output from any nested sub-processes this sub-process itself started',
    );
    expect(section).toContain(
      'legitimately blocked waiting on an external dependency',
    );
    expect(section).toContain(
      'confirm it by investigation before concluding — do not assume',
    );
    expect(section).toContain(
      'if it is legitimately waiting, state that conclusion together with the concrete evidence you found',
    );
  });

  it('requires logging the investigation result even though owner notification is not required', () => {
    const section = composer.composeSubAgentSection(
      [{ label: 'sub-process-idle', silentSeconds: 360, runningSeconds: 60 }],
      THRESHOLDS,
    );
    expect(section).toContain(
      'Owner notification is not required, but you MUST output your investigation result in this session so it remains as a log.',
    );
  });

  it('emits a distinct long-running message for a sub-agent that has only run too long', () => {
    const section = composer.composeSubAgentSection(
      [
        {
          label: 'sub-process-long',
          silentSeconds: 30,
          runningSeconds: 1200,
        },
      ],
      THRESHOLDS,
    );
    expect(section).toContain('sub-process-long');
    expect(section).toContain('running for 20m');
    expect(section).toContain('infinite loop');
    expect(section).toContain('too large');
    expect(section).toContain('not making forward progress');
    expect(section).toContain(
      'do not dismiss it merely because it produced output recently',
    );
    expect(section).toContain(
      'break the task down, restart, hand off, or replace',
    );
  });

  it('does not foreground the short idle time in the long-running message', () => {
    const section = composer.composeSubAgentSection(
      [
        {
          label: 'sub-process-long',
          silentSeconds: 30,
          runningSeconds: 1200,
        },
      ],
      THRESHOLDS,
    );
    expect(section).not.toContain('no output for');
    expect(section).not.toContain('silent for');
  });

  it('emits both distinct messages for a sub-agent matching both conditions, kept separate', () => {
    const section = composer.composeSubAgentSection(
      [{ label: 'sub-process-both', silentSeconds: 360, runningSeconds: 1200 }],
      THRESHOLDS,
    );
    expect(section).toContain('no output for 6m');
    expect(section).toContain('determine the CAUSE by a concrete check');
    expect(section).toContain('running for 20m');
    expect(section).toContain('infinite loop');
    const sentinelOccurrences =
      section.split(SILENT_SESSION_REMINDER_SENTINEL).length - 1;
    expect(sentinelOccurrences).toBe(2);
  });

  it('groups each sub-agent under the condition it matched', () => {
    const section = composer.composeSubAgentSection(
      [
        { label: 'idle-only', silentSeconds: 360, runningSeconds: 60 },
        { label: 'long-only', silentSeconds: 10, runningSeconds: 960 },
      ],
      THRESHOLDS,
    );
    const [idleSection, longRunningSection] = section.split('\n\n');
    expect(idleSection).toContain('idle-only');
    expect(idleSection).not.toContain('long-only');
    expect(longRunningSection).toContain('long-only');
    expect(longRunningSection).not.toContain('idle-only');
  });

  it('does not contain any host-specific or internal identifiers', () => {
    const mainSection = composer.composeMainStalledSection(600);
    const subSection = composer.composeSubAgentSection(
      [{ label: 'sub-process-1', silentSeconds: 360, runningSeconds: 1200 }],
      THRESHOLDS,
    );
    const combined = `${mainSection}\n${subSection}`.toLowerCase();
    expect(combined).not.toContain('claude');
    expect(combined).not.toContain('take ownership');
    expect(combined).not.toContain('/home/');
    expect(combined).not.toContain('.jsonl');
  });
});
