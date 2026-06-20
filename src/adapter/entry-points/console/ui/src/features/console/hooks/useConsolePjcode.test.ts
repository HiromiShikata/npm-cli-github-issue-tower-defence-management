import { parsePjcodeFromPath } from './useConsolePjcode';

describe('parsePjcodeFromPath', () => {
  it('extracts the pjcode from a projects path', () => {
    expect(parsePjcodeFromPath('/projects/umino')).toBe('umino');
    expect(parsePjcodeFromPath('/projects/umino/prs')).toBe('umino');
    expect(parsePjcodeFromPath('/projects/xmile/triage')).toBe('xmile');
  });

  it('tolerates a trailing slash', () => {
    expect(parsePjcodeFromPath('/projects/utage3/')).toBe('utage3');
  });

  it('returns null when the path is not under projects', () => {
    expect(parsePjcodeFromPath('/')).toBeNull();
    expect(parsePjcodeFromPath('/index.html')).toBeNull();
    expect(parsePjcodeFromPath('/assets/app.js')).toBeNull();
  });

  it('returns null when no pjcode segment follows projects', () => {
    expect(parsePjcodeFromPath('/projects')).toBeNull();
    expect(parsePjcodeFromPath('/projects/')).toBeNull();
  });
});
