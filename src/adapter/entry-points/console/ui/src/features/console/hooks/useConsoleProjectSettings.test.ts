import { act, renderHook } from '@testing-library/react';
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

  it('open sets isOpen true, fetches config, and populates inputValue', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    await act(async () => {
      await result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.inputValue).toBe('3');
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('acme');
  });

  it('open does nothing when pjcode is null', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings(null));
    await act(async () => {
      await result.current.open();
    });
    expect(result.current.isOpen).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('open sets error when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'));
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    await act(async () => {
      await result.current.open();
    });
    expect(result.current.error).toBe('network failure');
    expect(result.current.isLoading).toBe(false);
  });

  it('open populates empty string when maximumPreparingIssuesCount is null', async () => {
    fetchMock.mockResolvedValue({ maximumPreparingIssuesCount: null });
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    await act(async () => {
      await result.current.open();
    });
    expect(result.current.inputValue).toBe('');
  });

  it('close sets isOpen false and clears error', async () => {
    fetchMock.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    await act(async () => {
      await result.current.open();
    });
    expect(result.current.error).toBe('fail');
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('changeInput updates inputValue', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    await act(async () => {
      await result.current.open();
    });
    act(() => {
      result.current.changeInput('7');
    });
    expect(result.current.inputValue).toBe('7');
  });

  it('save calls postProjectMaxPreparingUpdate and closes modal on success', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    await act(async () => {
      await result.current.open();
    });
    await act(async () => {
      await result.current.save(5);
    });
    expect(postMock).toHaveBeenCalledWith({
      pjcode: 'acme',
      maximumPreparingIssuesCount: 5,
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isSaving).toBe(false);
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
    await act(async () => {
      await result.current.open();
    });
    await act(async () => {
      await result.current.save(5);
    });
    expect(result.current.error).toBe('save failed');
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isOpen).toBe(true);
  });

  it('Escape key triggers close when modal is open', async () => {
    const { result } = renderHook(() => useConsoleProjectSettings('acme'));
    await act(async () => {
      await result.current.open();
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
});
