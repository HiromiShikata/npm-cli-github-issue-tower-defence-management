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

  it('renders the main-stalled message as a neutral automated status notice with the silent minutes substituted', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('This is an automated status check.');
    expect(section).toContain('No output has been observed for 10 minutes.');
    expect(section).toContain(
      'If you are waiting on an external process, no action is needed — please log one line explaining the wait.',
    );
    expect(section).toContain('Otherwise please continue with the next step');
    expect(section).toContain('1.');
    expect(section).toContain('2.');
    expect(section).toContain('3.');
    expect(section).toContain('4.');
  });

  it('states each of the four checkpoints exactly once', () => {
    const section = composer.composeMainStalledSection(600);
    const occurrences = (needle: string): number =>
      section.split(needle).length - 1;
    expect(occurrences('Keep the session task list current')).toBe(1);
    expect(occurrences('Run independent pieces of work in parallel')).toBe(1);
    expect(
      occurrences(
        'Keep a monitor in place that notices when a sub-agent has produced no output for about 5 minutes.',
      ),
    ).toBe(1);
    expect(occurrences('share it through a new owner-call')).toBe(1);
  });

  it('requests a remaining-minutes estimate in the next output', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'an estimate of the remaining minutes to finish all tasks',
    );
  });

  it('floors the silent seconds to whole minutes', () => {
    const section = composer.composeMainStalledSection(659);
    expect(section).toContain('No output has been observed for 10 minutes.');
  });

  it('states the owner-call format guidance exactly once, deferring to the session-documented format', () => {
    const section = composer.composeMainStalledSection(600);
    const formatOccurrences =
      section.split('in the format documented for this session').length - 1;
    expect(formatOccurrences).toBe(1);
    expect(section).toContain('written to be self-contained');
    expect(section).toContain(
      'so the owner can understand the situation from that single message',
    );
  });

  it('explains that the owner is notified only when an owner-call is raised', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain(
      'the owner is notified only when a new owner-call is raised',
    );
  });

  it('contains no marker-tag example, tag name, or angle bracket in the format guidance', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).not.toContain('marker tag');
    expect(section).not.toContain('opening and closing pair');
    expect(section).not.toContain('<');
    expect(section).not.toContain('>');
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
      'No output has been observed for 10 minutes, and the owner call raised 60 minutes ago has not yet been acknowledged by the owner.',
    );
  });

  it('instructs unconditionally to re-raise the content as a fresh self-contained owner call', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain(
      'Please re-raise its content as a fresh, self-contained owner call.',
    );
  });

  it('frames every unanswered owner call kind as awaiting acknowledgment', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain('acknowledg');
    expect(section).toContain(
      'a completion report, a question, or a decision request',
    );
    expect(section).toContain("still awaiting the owner's acknowledgment");
  });

  it('contains no not-blocked escape phrasing and no conditional re-raise phrasing', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).not.toContain('no longer blocked');
    expect(section).not.toContain('continue with the next step');
    expect(section).not.toContain('If you are still waiting');
    expect(section).not.toContain('If you are');
  });

  it('requests a remaining-minutes estimate in the stale-owner-call section', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain(
      'an estimate of the remaining minutes to finish all tasks',
    );
  });

  it('states the owner-call format guidance exactly once in the stale-owner-call section', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    const formatOccurrences =
      section.split('in the format documented for this session').length - 1;
    expect(formatOccurrences).toBe(1);
  });

  it('contains no marker-tag example, tag name, or angle bracket in the stale-owner-call section', () => {
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).not.toContain('marker tag');
    expect(section).not.toContain('opening and closing pair');
    expect(section).not.toContain('<');
    expect(section).not.toContain('>');
  });

  it('composes the stale-owner-call section distinctly from the plain main-stalled section', () => {
    const plainSection = composer.composeMainStalledSection(600);
    const staleSection = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(staleSection).not.toBe(plainSection);
    expect(plainSection).not.toContain('has not yet been acknowledged');
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
    expect(section).toContain('please restart it, hand it off, or replace it');
    expect(section).toContain('waiting on an external dependency');
    expect(section).not.toContain('running longer than a task usually takes');
  });

  it('frames the idle message as an automated status check with the system-measured duration', () => {
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
    expect(section).toContain('This is an automated status check.');
    expect(section).toContain(
      'produced no output for about the minutes shown, measured from their last tool activity',
    );
    expect(section).toContain('no output for 6m');
  });

  it('tells the agent that logging one line suffices for a legitimate external wait in the idle message', () => {
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
      'a continuous-integration run, an external API, or another process',
    );
    expect(section).toContain(
      'no action is needed — please log one line noting the wait',
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
    expect(section).toContain('running longer than a task usually takes');
    expect(section).toContain(
      'breaking the task down, restarting it, handing it off, or replacing it',
    );
    expect(section).toContain(
      'If it is progressing normally, no action is needed.',
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
    expect(section).toContain('running for 20m');
    expect(section).toContain('running longer than a task usually takes');
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

  it('composes default texts free of pressure- and prohibition-styled vocabulary that trips model safety classifiers', () => {
    const flaggedPatterns = [
      /unacceptable/i,
      /\bnever\b/i,
      /\b[Dd]o NOT\b/,
      /\b[Yy]ou MUST\b/,
      /\bwastes?\b/i,
      /silently stalls/i,
      /\bstall(s|ed|ing)?\b/i,
      /raise one now/i,
      /fire the owner-call now/i,
      /do not wait passively/i,
      /is prohibited/i,
    ];
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    const composedDefaultTexts = [
      composer.composeMainStalledSection(600),
      composer.composeMainStalledWithStaleOwnerCallSection(600, 3600),
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

  it('composes default texts free of angle-bracket tag examples and emoji characters', () => {
    const emojiPattern =
      /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    const composedDefaultTexts = [
      composer.composeMainStalledSection(600),
      composer.composeMainStalledWithStaleOwnerCallSection(600, 3600),
      composer.composeSubAgentSection({
        idleSubAgents: [subAgent],
        longRunningSubAgents: [subAgent],
      }),
    ];
    for (const text of composedDefaultTexts) {
      expect(text).not.toContain('<');
      expect(text).not.toContain('>');
      expect(text).not.toMatch(emojiPattern);
      expect(text).not.toContain('\u{FE0F}');
      expect(text).not.toContain('\u{200D}');
      // The bracketed reminder sentinel remains allowed.
      expect(text).toContain(SILENT_SESSION_REMINDER_SENTINEL);
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
