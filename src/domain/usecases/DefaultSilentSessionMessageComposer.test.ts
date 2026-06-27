import { DefaultSilentSessionMessageComposer } from './DefaultSilentSessionMessageComposer';

describe('DefaultSilentSessionMessageComposer', () => {
  const composer = new DefaultSilentSessionMessageComposer();

  it('composes a main stalled section with the three general self-check points', () => {
    const section = composer.composeMainStalledSection(600);
    expect(section).toContain('1.');
    expect(section).toContain('2.');
    expect(section).toContain('10m');
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
    expect(combined).not.toContain('call-to-user');
  });
});
