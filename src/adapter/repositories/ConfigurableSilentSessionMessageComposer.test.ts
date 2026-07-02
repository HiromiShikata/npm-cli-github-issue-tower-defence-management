import { ConfigurableSilentSessionMessageComposer } from './ConfigurableSilentSessionMessageComposer';
import { SilentSessionMessageComposer } from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const THRESHOLDS = {
  subAgentSilentThresholdSeconds: 300,
  subAgentRunningThresholdSeconds: 900,
};

const createFallback = (): Mocked<SilentSessionMessageComposer> => ({
  composeMainStalledSection: jest.fn().mockReturnValue('FALLBACK_MAIN'),
  composeSubAgentSection: jest.fn().mockReturnValue('FALLBACK_SUB'),
});

const noTemplates = {
  mainStalledMessage: null,
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

  it('uses the fallback sub-agent section when no sub-agent template is configured', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      noTemplates,
      fallback,
    );
    expect(
      composer.composeSubAgentSection(
        [{ label: 'task-a', silentSeconds: 360, runningSeconds: 1200 }],
        THRESHOLDS,
      ),
    ).toBe('FALLBACK_SUB');
    expect(fallback.composeSubAgentSection).toHaveBeenCalledWith(
      [{ label: 'task-a', silentSeconds: 360, runningSeconds: 1200 }],
      THRESHOLDS,
    );
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
    const section = composer.composeSubAgentSection(
      [{ label: 'task-a', silentSeconds: 360, runningSeconds: 60 }],
      THRESHOLDS,
    );
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
    const section = composer.composeSubAgentSection(
      [{ label: 'task-b', silentSeconds: 30, runningSeconds: 1200 }],
      THRESHOLDS,
    );
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
    const section = composer.composeSubAgentSection(
      [{ label: 'task-both', silentSeconds: 360, runningSeconds: 1200 }],
      THRESHOLDS,
    );
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
    const section = composer.composeSubAgentSection(
      [{ label: 'task-idle', silentSeconds: 360, runningSeconds: 60 }],
      THRESHOLDS,
    );
    expect(section).toContain('BUILTIN_IDLE');
    expect(fallback.composeSubAgentSection).toHaveBeenCalledWith(
      [{ label: 'task-idle', silentSeconds: 360, runningSeconds: 60 }],
      {
        subAgentSilentThresholdSeconds:
          THRESHOLDS.subAgentSilentThresholdSeconds,
        subAgentRunningThresholdSeconds: Number.POSITIVE_INFINITY,
      },
    );
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
    expect(section).toBe(`${SILENT_SESSION_REMINDER_SENTINEL} CUSTOM_MAIN`);
  });
});
