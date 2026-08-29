import { renderHook, waitFor } from '@testing-library/react';
import { useConsoleFeaturesConfig } from './useConsoleFeaturesConfig';

describe('useConsoleFeaturesConfig', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns airplaneMode false while loading (initial state)', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useConsoleFeaturesConfig());
    expect(result.current.airplaneMode).toBe(false);
  });

  it('returns airplaneMode true when /api/features responds { airplaneMode: true }', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ airplaneMode: true }),
    });
    const { result } = renderHook(() => useConsoleFeaturesConfig());
    await waitFor(() => expect(result.current.airplaneMode).toBe(true));
  });

  it('returns airplaneMode false when /api/features responds { airplaneMode: false }', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ airplaneMode: false }),
    });
    const { result } = renderHook(() => useConsoleFeaturesConfig());
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current.airplaneMode).toBe(false);
  });

  it('returns airplaneMode false on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const consoleSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const { result } = renderHook(() => useConsoleFeaturesConfig());
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    expect(result.current.airplaneMode).toBe(false);
  });

  it('returns airplaneMode false when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ airplaneMode: true }),
    });
    const { result } = renderHook(() => useConsoleFeaturesConfig());
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current.airplaneMode).toBe(false);
  });
});
