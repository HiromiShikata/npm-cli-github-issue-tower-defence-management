import { ConfigurableSilentSessionMessageComposer } from './ConfigurableSilentSessionMessageComposer';
import { SilentSessionMessageComposer } from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createFallback = (): Mocked<SilentSessionMessageComposer> => ({
  composeMainStalledSection: jest.fn().mockReturnValue('FALLBACK_MAIN'),
  composeMainStalledWithStaleOwnerCallSection: jest
    .fn()
    .mockReturnValue('FALLBACK_STALE_OWNER_CALL'),
  composeSubAgentSection: jest.fn().mockReturnValue('FALLBACK_SUB'),
});

const noTemplates = {
  mainStalledMessage: null,
  mainStalledStaleOwnerCallMessage: null,
  subAgentIdleMessageHeader: null,
  subAgentIdleMessageFooter: null,
  subAgentLongRunningMessageHeader: null,
  subAgentLongRunningMessageFooter: null,
};

describe('ConfigurableSilentSessionMessageComposer', () => {
  it('uses the fallback main section when no main template is configured', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      noTemplates,
      fallback,
    );
    expect(composer.composeMainStalledSection(600)).toBe('FALLBACK_MAIN');
    expect(fallback.composeMainStalledSection).toHaveBeenCalledWith(600);
  });

  it('uses the configured main template when provided', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        mainStalledMessage: 'CUSTOM_MAIN',
      },
      fallback,
    );
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('CUSTOM_MAIN');
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    expect(fallback.composeMainStalledSection).not.toHaveBeenCalled();
  });

  it('appends the owner-call format guidance, including the self-contained and no-scroll-back requirements, to the configured main template', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        mainStalledMessage: 'CUSTOM_MAIN',
      },
      fallback,
      '<<OWNER_CALL>>',
    );
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('CUSTOM_MAIN');
    expect(section).toContain(
      'the configured owner-call marker tag "<<OWNER_CALL>>" as a complete matching pair',
    );
    expect(section).toContain('🔴');
    expect(section).toContain(
      'Make the owner-call message fully self-contained: the owner should be able to understand the whole situation — what happened, what you are asking, and any decision needed — from this single latest owner-call message alone, without reading or scrolling back to earlier messages.',
    );
    expect(section).toContain(
      'Please avoid telling the owner to scroll up, go back, or read previous or above messages; if context is needed, restate it inside the owner-call message itself.',
    );
  });

  it('uses the fallback stale-owner-call section when no stale-owner-call template is configured', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      noTemplates,
      fallback,
    );
    expect(
      composer.composeMainStalledWithStaleOwnerCallSection(600, 3600),
    ).toBe('FALLBACK_STALE_OWNER_CALL');
    expect(
      fallback.composeMainStalledWithStaleOwnerCallSection,
    ).toHaveBeenCalledWith(600, 3600);
  });

  it('uses the configured stale-owner-call template when provided', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        mainStalledStaleOwnerCallMessage: 'CUSTOM_STALE_OWNER_CALL',
      },
      fallback,
      '<<OWNER_CALL>>',
    );
    const section = composer.composeMainStalledWithStaleOwnerCallSection(
      600,
      3600,
    );
    expect(section).toContain('CUSTOM_STALE_OWNER_CALL');
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    expect(section).toContain(
      'the configured owner-call marker tag "<<OWNER_CALL>>" as a complete matching pair',
    );
    expect(
      fallback.composeMainStalledWithStaleOwnerCallSection,
    ).not.toHaveBeenCalled();
  });

  it('uses the fallback sub-agent section when no sub-agent template is configured', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      noTemplates,
      fallback,
    );
    const subAgent = {
      label: 'task-a',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    expect(
      composer.composeSubAgentSection({
        idleSubAgents: [subAgent],
        longRunningSubAgents: [subAgent],
      }),
    ).toBe('FALLBACK_SUB');
    expect(fallback.composeSubAgentSection).toHaveBeenCalledWith({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
  });

  it('renders the configured idle header, list, and footer for an idle sub-agent', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        subAgentIdleMessageHeader: 'IDLE_HEADER',
        subAgentIdleMessageFooter: 'IDLE_FOOTER',
      },
      fallback,
    );
    const section = composer.composeSubAgentSection({
      idleSubAgents: [
        {
          label: 'task-a',
          silentSeconds: 360,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ],
      longRunningSubAgents: [],
    });
    expect(section).toContain('IDLE_HEADER');
    expect(section).toContain('task-a');
    expect(section).toContain('no output for 6m');
    expect(section).toContain('IDLE_FOOTER');
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    expect(fallback.composeSubAgentSection).not.toHaveBeenCalled();
  });

  it('renders the configured long-running header, list, and footer for a long-running sub-agent', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        subAgentLongRunningMessageHeader: 'LONG_HEADER',
        subAgentLongRunningMessageFooter: 'LONG_FOOTER',
      },
      fallback,
    );
    const section = composer.composeSubAgentSection({
      idleSubAgents: [],
      longRunningSubAgents: [
        {
          label: 'task-b',
          silentSeconds: 30,
          runningSeconds: 1200,
          waitingOnExternalProcess: false,
        },
      ],
    });
    expect(section).toContain('LONG_HEADER');
    expect(section).toContain('task-b');
    expect(section).toContain('running for 20m');
    expect(section).toContain('LONG_FOOTER');
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    expect(fallback.composeSubAgentSection).not.toHaveBeenCalled();
  });

  it('emits both distinct configured sections for a sub-agent matching both conditions', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        subAgentIdleMessageHeader: 'IDLE_HEADER',
        subAgentLongRunningMessageHeader: 'LONG_HEADER',
      },
      fallback,
    );
    const subAgent = {
      label: 'task-both',
      silentSeconds: 360,
      runningSeconds: 1200,
      waitingOnExternalProcess: false,
    };
    const section = composer.composeSubAgentSection({
      idleSubAgents: [subAgent],
      longRunningSubAgents: [subAgent],
    });
    const [idleSection, longRunningSection] = section
      .replace(`${SILENT_SESSION_REMINDER_SENTINEL} `, '')
      .split('\n\n');
    expect(idleSection).toContain('IDLE_HEADER');
    expect(idleSection).toContain('no output for 6m');
    expect(longRunningSection).toContain('LONG_HEADER');
    expect(longRunningSection).toContain('running for 20m');
  });

  it('renders the built-in idle message via the fallback when only a long-running template is configured', () => {
    const fallback = createFallback();
    fallback.composeSubAgentSection.mockReturnValue('BUILTIN_IDLE');
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        subAgentLongRunningMessageHeader: 'LONG_HEADER',
      },
      fallback,
    );
    const idleSubAgent = {
      label: 'task-idle',
      silentSeconds: 360,
      runningSeconds: 60,
      waitingOnExternalProcess: false,
    };
    const section = composer.composeSubAgentSection({
      idleSubAgents: [idleSubAgent],
      longRunningSubAgents: [],
    });
    expect(section).toContain('BUILTIN_IDLE');
    expect(fallback.composeSubAgentSection).toHaveBeenCalledWith({
      idleSubAgents: [idleSubAgent],
      longRunningSubAgents: [],
    });
  });

  it('does not double-prepend the sentinel when the template already carries it', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        ...noTemplates,
        mainStalledMessage: `${SILENT_SESSION_REMINDER_SENTINEL} CUSTOM_MAIN`,
      },
      fallback,
    );
    const section = composer.composeMainStalledSection(600);
    const sentinelOccurrences =
      section.split(SILENT_SESSION_REMINDER_SENTINEL).length - 1;
    expect(sentinelOccurrences).toBe(1);
    expect(
      section.startsWith(`${SILENT_SESSION_REMINDER_SENTINEL} CUSTOM_MAIN`),
    ).toBe(true);
  });
});
