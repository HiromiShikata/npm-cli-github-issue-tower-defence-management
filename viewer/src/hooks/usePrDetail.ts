import { useState, useCallback } from 'react';
import { fetchPrDetail } from '../api/client';
import type { PrDetailResponse } from '../api/types';

type PrDetailState = {
  data: PrDetailResponse | null;
  loading: boolean;
  error: string | null;
};

type PrDetailKey = { repo: string; prNumber: number };

export const usePrDetail = (accessKey: string | null): {
  state: PrDetailState;
  load: (key: PrDetailKey) => void;
  currentKey: PrDetailKey | null;
} => {
  const [state, setState] = useState<PrDetailState>({
    data: null,
    loading: false,
    error: null,
  });
  const [currentKey, setCurrentKey] = useState<PrDetailKey | null>(null);

  const load = useCallback(
    (key: PrDetailKey) => {
      if (!accessKey) return;
      setCurrentKey(key);
      setState({ data: null, loading: true, error: null });
      fetchPrDetail(accessKey, key.repo, key.prNumber)
        .then((data) => {
          setState({ data, loading: false, error: null });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          setState({ data: null, loading: false, error: message });
        });
    },
    [accessKey],
  );

  return { state, load, currentKey };
};
