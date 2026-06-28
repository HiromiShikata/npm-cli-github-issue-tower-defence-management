import { ConfigurableSilentSessionMessageComposer } from './ConfigurableSilentSessionMessageComposer';
import { SilentSessionMessageComposer } from '../../domain/usecases/adapter-interfaces/SilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../domain/usecases/silentSessionReminderSentinel';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createFallback = (): Mocked<SilentSessionMessageComposer> => ({
  composeMainStalledSection: jest.fn().mockReturnValue('FALLBACK_MAIN'),
  composeOwnerReNotificationSection: jest
    .fn()
    .mockReturnValue('FALLBACK_OWNER'),
  composeSubAgentSection: jest.fn().mockReturnValue('FALLBACK_SUB'),
});

describe('ConfigurableSilentSessionMessageComposer', () => {
  it('uses the fallback main section when no main template is configured', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        mainStalledMessage: null,
        ownerReNotificationMessage: null,
        subAgentMessageHeader: null,
        subAgentMessageFooter: null,
      },
      fallback,
    );
    expect(composer.composeMainStalledSection(600)).toBe('FALLBACK_MAIN');
    expect(fallback.composeMainStalledSection).toHaveBeenCalledWith(600);
  });

  it('uses the configured main template when provided', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        mainStalledMessage: 'CUSTOM_MAIN',
        ownerReNotificationMessage: null,
        subAgentMessageHeader: null,
        subAgentMessageFooter: null,
      },
      fallback,
    );
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('CUSTOM_MAIN');
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    expect(fallback.composeMainStalledSection).not.toHaveBeenCalled();
  });

  it('uses the fallback sub-agent section when neither header nor footer is configured', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        mainStalledMessage: null,
        ownerReNotificationMessage: null,
        subAgentMessageHeader: null,
        subAgentMessageFooter: null,
      },
      fallback,
    );
    expect(
      composer.composeSubAgentSection([
        { label: 'task-a', silentSeconds: 360, runningSeconds: 1200 },
      ]),
    ).toBe('FALLBACK_SUB');
  });

  it('renders the configured sub-agent header, list, and footer', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        mainStalledMessage: null,
        ownerReNotificationMessage: null,
        subAgentMessageHeader: 'HEADER',
        subAgentMessageFooter: 'FOOTER',
      },
      fallback,
    );
    const section = composer.composeSubAgentSection([
      { label: 'task-a', silentSeconds: 360, runningSeconds: 1200 },
    ]);
    expect(section).toContain('HEADER');
    expect(section).toContain('task-a');
    expect(section).toContain('silent for 6m');
    expect(section).toContain('running for 20m');
    expect(section).toContain('FOOTER');
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    expect(fallback.composeSubAgentSection).not.toHaveBeenCalled();
  });

  it('uses the fallback owner-re-notification section when no template is configured', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        mainStalledMessage: null,
        ownerReNotificationMessage: null,
        subAgentMessageHeader: null,
        subAgentMessageFooter: null,
      },
      fallback,
    );
    expect(composer.composeOwnerReNotificationSection(600)).toBe(
      'FALLBACK_OWNER',
    );
    expect(fallback.composeOwnerReNotificationSection).toHaveBeenCalledWith(600);
  });

  it('uses the configured owner-re-notification template when provided', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        mainStalledMessage: null,
        ownerReNotificationMessage: 'CUSTOM_OWNER',
        subAgentMessageHeader: null,
        subAgentMessageFooter: null,
      },
      fallback,
    );
    const section = composer.composeOwnerReNotificationSection(600);
    expect(section).toContain('CUSTOM_OWNER');
    expect(section).toContain(SILENT_SESSION_REMINDER_SENTINEL);
    expect(fallback.composeOwnerReNotificationSection).not.toHaveBeenCalled();
  });

  it('does not double-prepend the sentinel when the template already carries it', () => {
    const fallback = createFallback();
    const composer = new ConfigurableSilentSessionMessageComposer(
      {
        mainStalledMessage: `${SILENT_SESSION_REMINDER_SENTINEL} CUSTOM_MAIN`,
        ownerReNotificationMessage: null,
        subAgentMessageHeader: null,
        subAgentMessageFooter: null,
      },
      fallback,
    );
    const section = composer.composeMainStalledSection(600);
    expect(section).toBe(`${SILENT_SESSION_REMINDER_SENTINEL} CUSTOM_MAIN`);
  });
});
