import { act, renderHook } from '@testing-library/react';
import { useConsoleExplicitProjectSelection } from './useConsoleExplicitProjectSelection';

describe('useConsoleExplicitProjectSelection', () => {
  it('initial explicitlySelectedPjcode is null', () => {
    const { result } = renderHook(() =>
      useConsoleExplicitProjectSelection('acme'),
    );
    expect(result.current.explicitlySelectedPjcode).toBeNull();
  });

  it('calling notifyExplicitSelection sets explicitlySelectedPjcode', () => {
    const { result } = renderHook(() =>
      useConsoleExplicitProjectSelection('acme'),
    );
    act(() => {
      result.current.notifyExplicitSelection('acme');
    });
    expect(result.current.explicitlySelectedPjcode).toBe('acme');
  });

  it('pjcode changing to a different value resets explicitlySelectedPjcode to null', () => {
    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string | null }) =>
        useConsoleExplicitProjectSelection(pjcode),
      { initialProps: { pjcode: 'acme' as string | null } },
    );
    act(() => {
      result.current.notifyExplicitSelection('acme');
    });
    expect(result.current.explicitlySelectedPjcode).toBe('acme');

    rerender({ pjcode: 'beta' });
    expect(result.current.explicitlySelectedPjcode).toBeNull();
  });

  it('pjcode remaining unchanged keeps explicitlySelectedPjcode set', () => {
    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string | null }) =>
        useConsoleExplicitProjectSelection(pjcode),
      { initialProps: { pjcode: 'acme' as string | null } },
    );
    act(() => {
      result.current.notifyExplicitSelection('acme');
    });
    expect(result.current.explicitlySelectedPjcode).toBe('acme');

    rerender({ pjcode: 'acme' });
    expect(result.current.explicitlySelectedPjcode).toBe('acme');
  });

  it('pjcode changing to null resets explicitlySelectedPjcode to null', () => {
    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string | null }) =>
        useConsoleExplicitProjectSelection(pjcode),
      { initialProps: { pjcode: 'acme' as string | null } },
    );
    act(() => {
      result.current.notifyExplicitSelection('acme');
    });
    expect(result.current.explicitlySelectedPjcode).toBe('acme');

    rerender({ pjcode: null });
    expect(result.current.explicitlySelectedPjcode).toBeNull();
  });
});
