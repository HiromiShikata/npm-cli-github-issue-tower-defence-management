import { act, renderHook, waitFor } from '@testing-library/react';
import * as consoleApi from '../lib/consoleApi';
import { useConsoleProjectSettings } from './useConsoleProjectSettings';

jest.mock('../lib/consoleApi', () => ({
  fetchProjectReadmeConfig: jest.fn(),
  postProjectMaxPreparingUpdate: jest.fn(),
}));

const fetchMock = consoleApi.fetchProjectReadmeConfig as jest.MockedFunction<
  typeof consoleApi.fetchProjectReadmeConfig
>;
const postMock =
  consoleApi.postProjectMaxPreparingUpdate as jest.MockedFunction<
    typeof consoleApi.postProjectMaxPreparingUpdate
  >;

beforeEach(() => {
  window.history.replaceState({}, '', '/projects/acme/prs');
  fetchMock.mockResolvedValue({ maximumPreparingIssuesCount: 3 });
  postMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('useConsoleProjectSettings', () => {
  it('starts closed with empty state', () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.inputValue).toBe('');
  });

  it('open sets isOpen true and pushes #settings to the URL', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    expect(window.location.hash).toBe('#settings');
  });

  it('open fetches config and populates inputValue', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    await waitFor(() => expect(result.current.inputValue).toBe('3'));
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('acme');
  });

  it('open does nothing when pjcode is null', () => {
    const { result } = renderHook(() => useConsoleProjectSettings(null));
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(false);
    expect(window.location.hash).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('open sets error when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'));
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    await waitFor(() => expect(result.current.error).toBe('network failure'));
    expect(result.current.isLoading).toBe(false);
  });

  it('open populates empty string when maximumPreparingIssuesCount is null', async () => {
    fetchMock.mockResolvedValue({ maximumPreparingIssuesCount: null });
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.inputValue).toBe('');
  });

  it('close sets isOpen false, clears error, and restores the URL', async () => {
    fetchMock.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    await waitFor(() => expect(result.current.error).toBe('fail'));
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('close restores the hash that was set before open was called', async () => {
    window.history.replaceState({}, '', '/projects/acme/prs#item/PVTI_123');
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    expect(window.location.hash).toBe('#settings');
    act(() => {
      result.current.close();
    });
    expect(window.location.hash).toBe('#item/PVTI_123');
  });

  it('changeInput updates inputValue', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.changeInput('7');
    });
    expect(result.current.inputValue).toBe('7');
  });

  it('save calls postProjectMaxPreparingUpdate, restores URL, and closes modal on success', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.save(5);
    });
    expect(postMock).toHaveBeenCalledWith({
      pjcode: 'acme',
      maximumPreparingIssuesCount: 5,
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(window.location.hash).toBe('');
  });

  it('save does nothing when pjcode is null', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings(null));
    await act(async () => {
      await result.current.save(5);
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('save sets error when post fails', async () => {
    postMock.mockRejectedValue(new Error('save failed'));
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.save(5);
    });
    expect(result.current.error).toBe('save failed');
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isOpen).toBe(true);
  });

  it('Escape key triggers close when modal is open', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('Escape key is ignored when modal is closed', () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('initializes as open when the URL hash is #settings on mount', async () => {
    window.history.replaceState({}, '', '/projects/acme/prs#settings');
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    expect(result.current.isOpen).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith('acme');
  });

  it('closes via popstate when hash changes away from #settings', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      window.history.replaceState({}, '', '/projects/acme/prs');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('opens via hashchange when hash changes to #settings', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    expect(result.current.isOpen).toBe(false);
    act(() => {
      window.history.replaceState({}, '', '/projects/acme/prs#settings');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.isOpen).toBe(true);
  });
});
