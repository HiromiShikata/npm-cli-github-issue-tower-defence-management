import { useState, useEffect, useCallback } from 'react';
import { fetchPrList } from '../api/client';
import type { PrListResponse } from '../api/types';

type PrListState = {
  data: PrListResponse | null;
  loading: boolean;
  error: string | null;
  unauthorized: boolean;
};

export const usePrList = (accessKey: string | null): PrListState & { reload: () => void } => {
  const [state, setState] = useState<PrListState>({
    data: null,
    loading: false,
    error: null,
    unauthorized: false,
  });

  const load = useCallback(async () => {
    if (!accessKey) {
      setState({ data: null, loading: false, error: null, unauthorized: true });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null, unauthorized: false }));
    try {
      const data = await fetchPrList(accessKey);
      setState({ data, loading: false, error: null, unauthorized: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('403') || message.includes('HTTP 403')) {
        setState({ data: null, loading: false, error: null, unauthorized: true });
      } else {
        setState({ data: null, loading: false, error: message, unauthorized: false });
      }
    }
  }, [accessKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
};
