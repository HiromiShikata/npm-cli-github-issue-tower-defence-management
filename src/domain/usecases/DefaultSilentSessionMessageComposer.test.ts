import { DefaultSilentSessionMessageComposer } from './DefaultSilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from './silentSessionReminderSentinel';

describe('DefaultSilentSessionMessageComposer', () => {
  const composer = new DefaultSilentSessionMessageComposer();

  it('embeds the reminder sentinel in the sub-agent section', () => {
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
      finishedResultUnconsumed: false,
    };
    const section = composer.composeSubAgentSection({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('embeds the reminder sentinel in the unconsumed-result section', () => {
    const section = composer.composeSubAgentUnconsumedResultSection([
      {
        label: 'agent-aaabbbbcccc30001',
        silentSeconds: 5220,
        runningSeconds: 5400,
        waitingOnExternalProcess: false,
        finishedResultUnconsumed: true,
      },
    ]);
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
  });

  it('names every finished sub-agent and the whole minutes its result has stayed unconsumed', () => {
    const section = composer.composeSubAgentUnconsumedResultSection([
      {
        label: 'agent-aaabbbbcccc30001',
        silentSeconds: 5220,
        runningSeconds: 5400,
        waitingOnExternalProcess: false,
        finishedResultUnconsumed: true,
      },
      {
        label: 'agent-aaabbbbcccc30002',
        silentSeconds: 359,
        runningSeconds: 900,
        waitingOnExternalProcess: false,
        finishedResultUnconsumed: true,
      },
    ]);
    expect(section).toContain('This is an automated status check.');
    expect(section).toContain(
      'agent-aaabbbbcccc30001: result unconsumed for 87m',
    );
    expect(section).toContain(
      'agent-aaabbbbcccc30002: result unconsumed for 5m',
    );
  });

  it('omits the self-diagnosis guidance from the sub-agent sections', () => {
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
      finishedResultUnconsumed: false,
    };
    const section = composer.composeSubAgentSection({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
    expect(section).not.toContain(
      'This reminder is delivered only to sessions that have no registered unanswered owner-call.',
    );
  });

  it('emits a distinct idle message for a sub-agent that is only output-idle', () => {
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'sub-process-idle',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
          finishedResultUnconsumed: false,
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
          finishedResultUnconsumed: false,
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
          finishedResultUnconsumed: false,
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
          finishedResultUnconsumed: false,
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
          finishedResultUnconsumed: false,
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
      finishedResultUnconsumed: false,
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
          finishedResultUnconsumed: false,
        },
      ],
      longRunningSubAgents: [
        {
          label: 'long-only',
          silentSeconds: 10,
          runningSeconds: 960,
          waitingOnExternalProcess: false,
          finishedResultUnconsumed: false,
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
      finishedResultUnconsumed: false,
    };
    const composedDefaultTexts = [
      composer.composeSubAgentSection({
        idleSubAgents: [subAgent],
        longRunningSubAgents: [subAgent],
      }),
      composer.composeSubAgentUnconsumedResultSection([subAgent]),
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
      finishedResultUnconsumed: false,
    };
    const composedDefaultTexts = [
      composer.composeSubAgentSection({
        idleSubAgents: [subAgent],
        longRunningSubAgents: [subAgent],
      }),
      composer.composeSubAgentUnconsumedResultSection([subAgent]),
    ];
    for (const text of composedDefaultTexts) {
      expect(text).not.toContain('<');
      expect(text).not.toContain('>');
      expect(text).not.toMatch(emojiPattern);
      expect(text).not.toContain('\u{FE0F}');
      expect(text).not.toContain('\u{200D}');
      expect(text).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    }
  });

  it('does not contain any host-specific or internal identifiers', () => {
    const subAgent = {
      label: 'sub-process-1',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
      finishedResultUnconsumed: false,
    };
    const subSection = composer.composeSubAgentSection({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
    const unconsumedResultSection =
      composer.composeSubAgentUnconsumedResultSection([subAgent]);
    const combined = `${subSection}\n${unconsumedResultSection}`.toLowerCase();
    expect(combined).not.toContain('claude');
    expect(combined).not.toContain('take ownership');
    expect(combined).not.toContain('/home/');
    expect(combined).not.toContain('.jsonl');
  });
});
