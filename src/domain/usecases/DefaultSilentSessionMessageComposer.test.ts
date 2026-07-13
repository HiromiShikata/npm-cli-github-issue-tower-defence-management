import { DefaultSilentSessionMessageComposer } from './DefaultSilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from './silentSessionReminderSentinel';

describe('DefaultSilentSessionMessageComposer', () => {
  const composer = new DefaultSilentSessionMessageComposer();

  it('embeds the reminder sentinel in the main-stalled section', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('embeds the reminder sentinel in the sub-agent section', () => {
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    const section = composer.composeSubAgentSection({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('renders the configured main-stalled message with the silent minutes substituted', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('You have produced no output for 10 minutes.');
    expect(section).toContain('Idle waiting wastes this live session');
    expect(section).toContain(
      'Always work proactively and stay ahead of the work',
    );
    expect(section).toContain('rather than waiting passively');
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
      'The content between the markers needs to begin with the 🔴 emoji immediately, with no space after it.',
    );
    expect(section).toContain(
      'complete matching pair — opening marker, content, then closing marker — on a single line with no newline inside the tag.',
    );
    expect(section).toContain(
      'a malformed tag (a broken or missing closing marker, or a missing leading 🔴) results in only a red indicator with no readable content.',
    );
  });

  it('requires the owner-call message to be fully self-contained and forbids telling the owner to scroll back', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'Make the owner-call message fully self-contained: the owner should be able to understand the whole situation — what happened, what you are asking, and any decision needed — from this single latest owner-call message alone, without reading or scrolling back to earlier messages.',
    );
    expect(section).toContain(
      'Please avoid telling the owner to scroll up, go back, or read previous or above messages; if context is needed, restate it inside the owner-call message itself.',
    );
  });

  it('instructs the agent to fire the owner-call when an owner request has been completed or answered', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'If you have COMPLETED or ANSWERED a request from the owner in this session, please fire the owner-call to report the RESULT to the owner',
    );
    expect(section).toContain(
      "completing or answering an owner's requested action is itself a reason to fire the owner-call",
    );
  });

  it('explains that completing an owner request without an owner-call leaves the owner unnotified', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'Completing or answering an owner request WITHOUT firing the owner-call means the owner is not notified',
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

  it('embeds the reminder sentinel in the stale-owner-call main-stalled section', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('renders the stale-owner-call section with the silent and owner-call-age minutes substituted', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      659,
      3659,
    );
    expect(section).toContain(
      'You have produced no output for 10 minutes, and the owner call you raised 60 minutes ago is still unanswered.',
    );
  });

  it('directs the agent to re-raise its pending ask as a fresh fully self-contained owner call', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain(
      'If you are still blocked on the owner, re-raise your pending ask NOW as a fresh owner call.',
    );
    expect(section).toContain(
      'Make it fully self-contained: restate the whole situation — what happened, what you are asking, and any decision needed — inside the new owner call itself',
    );
  });

  it('directs the agent to continue autonomously when it is no longer blocked', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain(
      'If you are no longer blocked — the answer became unnecessary, you can proceed safely, or the information arrived another way — resume immediately and drive all remaining tasks to completion.',
    );
  });

  it('states that the stale-owner-call reminder itself does not notify the owner', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain(
      'This reminder does not notify the owner; only a fresh owner call from you surfaces this session to the owner.',
    );
  });

  it('interpolates the configured owner-call marker into the stale-owner-call format guidance', () => {
    const markedComposer = new DefaultSilentSessionMessageComposer(
      '<<OWNER_CALL>>',
    );
    const section = markedComposer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain(
      'the configured owner-call marker tag "<<OWNER_CALL>>" as a complete matching pair',
    );
    expect(section).toContain('🔴');
  });

  it('composes the stale-owner-call section distinctly from the plain main-stalled section', () => {
    const plainSection = composer.composeMainStalledSection(600);
    const staleSection = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(staleSection).not.toBe(plainSection);
    expect(plainSection).not.toContain('is still unanswered');
  });

  it('emits a distinct idle message for a sub-agent that is only output-idle', () => {
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'sub-process-idle',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ],
      longRunningSubAgents: [],
    });
    expect(section).toContain('sub-process-idle');
    expect(section).toContain('no output for 6m');
    expect(section).toContain('restart, hand off, or replace it');
    expect(section).toContain('waiting on an external dependency');
    expect(section).not.toContain('infinite loop');
  });

  it('presents the system-detected idle duration as the authoritative signal in the idle message', () => {
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'sub-process-idle',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ],
      longRunningSubAgents: [],
    });
    expect(section).toContain(
      "The system has already detected, from each sub-process's last tool activity, that it has produced no output for about the minutes shown below.",
    );
    expect(section).toContain(
      'Please treat that figure as the authoritative system signal; there is no need to spend effort re-deriving whether the sub-process is alive.',
    );
    expect(section).toContain('no output for 6m');
  });

  it('forbids speculation and dismissal without evidence in the idle message', () => {
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'sub-process-idle',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ],
      longRunningSubAgents: [],
    });
    expect(section).toContain(
      'Around five minutes of silence is a real warning of a possible hang',
    );
    expect(section).toContain(
      'please base your assessment on concrete evidence rather than speculation ("probably still working"), and please keep the warning in view until evidence resolves it.',
    );
  });

  it('requires a concrete cause-check covering recent activity and external-dependency waiting in the idle message', () => {
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'sub-process-idle',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ],
      longRunningSubAgents: [],
    });
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
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'sub-process-idle',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ],
      longRunningSubAgents: [],
    });
    expect(section).toContain(
      'Owner notification is not required, but please output your investigation result in this session so it remains as a log.',
    );
  });

  it('emits a distinct long-running message for a sub-agent that has only run too long', () => {
    const section = composer.composeSubAgentSection({
      idleSubAgents: [],
      longRunningSubAgents: [
        {
          label: 'sub-process-long',
          silentSeconds: 30,
          runningSeconds: 1200,
          waitingOnExternalProcess: false,
        },
      ],
    });
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
    const section = composer.composeSubAgentSection({
      idleSubAgents: [],
      longRunningSubAgents: [
        {
          label: 'sub-process-long',
          silentSeconds: 30,
          runningSeconds: 1200,
          waitingOnExternalProcess: false,
        },
      ],
    });
    expect(section).not.toContain('no output for');
    expect(section).not.toContain('silent for');
  });

  it('emits both distinct messages for a sub-agent matching both conditions, kept separate', () => {
    const subAgent = {
      label: 'sub-process-both',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    const section = composer.composeSubAgentSection({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
    expect(section).toContain('no output for 6m');
    expect(section).toContain('determine the CAUSE by a concrete check');
    expect(section).toContain('running for 20m');
    expect(section).toContain('infinite loop');
    const sentinelOccurrences =
      section.split(SILENT_SESSION_REMINDER_SENTINEL).length - 1;
    expect(sentinelOccurrences).toBe(2);
  });

  it('groups each sub-agent under the condition it matched', () => {
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'idle-only',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ],
      longRunningSubAgents: [
        {
          label: 'long-only',
          silentSeconds: 10,
          runningSeconds: 960,
          waitingOnExternalProcess: false,
        },
      ],
    });
    const [idleSection, longRunningSection] = section.split('\n\n');
    expect(idleSection).toContain('idle-only');
    expect(idleSection).not.toContain('long-only');
    expect(longRunningSection).toContain('long-only');
    expect(longRunningSection).not.toContain('idle-only');
  });

  it('composes default texts free of prohibition-styled vocabulary that trips model safety classifiers', () => {
    const flaggedPatterns = [
      /unacceptable/i,
      /\bnever\b/i,
      /\b[Dd]o NOT\b/,
      /\b[Yy]ou MUST\b/,
    ];
    const markedComposer = new DefaultSilentSessionMessageComposer(
      '<<OWNER_CALL>>',
    );
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    const composedDefaultTexts = [
      composer.composeMainStalledSection(600),
      markedComposer.composeMainStalledSection(600),
      composer.composeMainStalledWithStaleOwnerCallSection(600, 3600),
      markedComposer.composeMainStalledWithStaleOwnerCallSection(600, 3600),
      composer.composeSubAgentSection({
        idleSubAgents: [subAgent],
        longRunningSubAgents: [subAgent],
      }),
    ];
    for (const text of composedDefaultTexts) {
      for (const pattern of flaggedPatterns) {
        expect(text).not.toMatch(pattern);
      }
    }
  });

  it('does not contain any host-specific or internal identifiers', () => {
    const mainSection = composer.composeMainStalledSection(600);
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    const subSection = composer.composeSubAgentSection({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
    const combined = `${mainSection}\n${subSection}`.toLowerCase();
    expect(combined).not.toContain('claude');
    expect(combined).not.toContain('take ownership');
    expect(combined).not.toContain('/home/');
    expect(combined).not.toContain('.jsonl');
  });
});
