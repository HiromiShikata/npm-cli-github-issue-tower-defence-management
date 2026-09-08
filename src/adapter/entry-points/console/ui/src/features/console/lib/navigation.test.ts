import { navigatePush, navigateReplaceState } from './navigation';

describe('navigatePush', () => {
  it('uses history.pushState instead of location.assign', () => {
    const pushState = jest.spyOn(window.history, 'pushState');
    navigatePush('/projects/acme');
    expect(pushState).toHaveBeenCalledWith({}, '', '/projects/acme');
    pushState.mockRestore();
  });

  it('dispatches a popstate event after updating the URL', () => {
    const received: Event[] = [];
    const listener = (e: Event): void => {
      received.push(e);
    };
    window.addEventListener('popstate', listener);
    navigatePush('/projects/acme');
    window.removeEventListener('popstate', listener);
    expect(received).toHaveLength(1);
  });
});

describe('navigateReplaceState', () => {
  it('uses history.replaceState instead of location.replace', () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    navigateReplaceState('/projects/acme');
    expect(replaceState).toHaveBeenCalledWith({}, '', '/projects/acme');
    replaceState.mockRestore();
  });

  it('dispatches a popstate event after updating the URL', () => {
    const received: Event[] = [];
    const listener = (e: Event): void => {
      received.push(e);
    };
    window.addEventListener('popstate', listener);
    navigateReplaceState('/projects/acme');
    window.removeEventListener('popstate', listener);
    expect(received).toHaveLength(1);
  });
});
