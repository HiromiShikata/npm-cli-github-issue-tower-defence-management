import { parsePjcodeFromPath } from './useConsolePjcode';

describe('parsePjcodeFromPath', () => {
  it('extracts the pjcode from a projects path', () => {
    expect(parsePjcodeFromPath('/projects/acme')).toBe('acme');
    expect(parsePjcodeFromPath('/projects/acme/prs')).toBe('acme');
    expect(parsePjcodeFromPath('/projects/globex/triage')).toBe('globex');
  });

  it('tolerates a trailing slash', () => {
    expect(parsePjcodeFromPath('/projects/umbrella/')).toBe('umbrella');
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
