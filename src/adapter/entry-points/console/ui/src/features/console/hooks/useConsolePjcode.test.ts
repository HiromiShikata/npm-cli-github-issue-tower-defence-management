import { act, renderHook } from '@testing-library/react';
import { parsePjcodeFromPath, useConsolePjcode } from './useConsolePjcode';

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

describe('useConsolePjcode', () => {
  it('reads the pjcode from the initial URL', () => {
    window.history.replaceState({}, '', '/projects/acme/prs');
    const { result } = renderHook(() => useConsolePjcode());
    expect(result.current).toBe('acme');
  });

  it('updates the pjcode when navigated to another project via popstate', () => {
    window.history.replaceState({}, '', '/projects/acme/prs');
    const { result } = renderHook(() => useConsolePjcode());
    expect(result.current).toBe('acme');

    act(() => {
      window.history.pushState({}, '', '/projects/beta');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current).toBe('beta');
  });

  it('updates to null when navigating away from a project URL', () => {
    window.history.replaceState({}, '', '/projects/acme/prs');
    const { result } = renderHook(() => useConsolePjcode());

    act(() => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current).toBeNull();
  });
});
