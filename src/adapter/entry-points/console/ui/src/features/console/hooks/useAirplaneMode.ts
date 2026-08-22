import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AirplaneSnapshot,
  clearAirplaneSnapshot,
  loadAirplaneSnapshot,
  parseAirplaneSnapshot,
  readAirplaneModeFlag,
  storeAirplaneSnapshot,
  writeAirplaneModeFlag,
} from '../lib/airplaneSnapshot';

export type AirplaneModeStatus = 'off' | 'syncing' | 'on' | 'error';

export type AirplaneSyncProgress = {
  fetched: number;
  total: number;
};

export type AirplaneModeState = {
  status: AirplaneModeStatus;
  progress: AirplaneSyncProgress | null;
  snapshot: AirplaneSnapshot | null;
  failures: string[];
  startSync: () => void;
  turnOff: () => void;
};

const AIRPLANE_SYNC_PATH = '/api/airplanesync';

const parseSyncEvent = (
  raw: string,
): { type: string; [key: string]: unknown } | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'type' in parsed &&
      typeof (parsed as { type: unknown }).type === 'string'
    ) {
      return parsed as { type: string; [key: string]: unknown };
    }
    return null;
  } catch {
    return null;
  }
};

export const useAirplaneMode = (): AirplaneModeState => {
  const [status, setStatus] = useState<AirplaneModeStatus>('off');
  const [progress, setProgress] = useState<AirplaneSyncProgress | null>(null);
  const [snapshot, setSnapshot] = useState<AirplaneSnapshot | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!readAirplaneModeFlag()) {
      return;
    }
    let cancelled = false;
    loadAirplaneSnapshot()
      .then((stored) => {
        if (cancelled || stored === null) {
          return;
        }
        setSnapshot(stored);
        setStatus('on');
      })
      .catch(() => {
        writeAirplaneModeFlag(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSync = useCallback((): void => {
    if (abortControllerRef.current !== null) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('syncing');
    setProgress({ fetched: 0, total: 0 });
    setFailures([]);

    fetch(AIRPLANE_SYNC_PATH, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || response.body === null) {
          setStatus('error');
          setFailures([`HTTP ${response.status}`]);
          return;
        }

        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();

        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += value;
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            if (!block.startsWith('data: ')) {
              continue;
            }
            const event = parseSyncEvent(block.slice('data: '.length));
            if (event === null) {
              continue;
            }
            if (event.type === 'progress') {
              setProgress({
                fetched: typeof event.fetched === 'number' ? event.fetched : 0,
                total: typeof event.total === 'number' ? event.total : 0,
              });
            } else if (event.type === 'done') {
              const parsed = parseAirplaneSnapshot(event.snapshot);
              if (parsed === null) {
                setStatus('error');
                setFailures(['Failed to parse snapshot']);
                return;
              }
              if (parsed.failures.length > 0) {
                setFailures(parsed.failures);
                setStatus('error');
                return;
              }
              await storeAirplaneSnapshot(parsed);
              writeAirplaneModeFlag(true);
              setSnapshot(parsed);
              setStatus('on');
              setFailures([]);
            }
          }
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setStatus('error');
        setFailures([error instanceof Error ? error.message : String(error)]);
      });
  }, []);

  const turnOff = useCallback((): void => {
    if (abortControllerRef.current !== null) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('off');
    setSnapshot(null);
    setProgress(null);
    setFailures([]);
    writeAirplaneModeFlag(false);
    clearAirplaneSnapshot().catch(() => {});
  }, []);

  return { status, progress, snapshot, failures, startSync, turnOff };
};
