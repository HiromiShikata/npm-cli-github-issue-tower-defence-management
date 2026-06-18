import { useEffect, useState } from 'react';
import type {
  ConsoleColor,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleTabName,
} from '../types';
import { useConsoleToken } from './useConsoleToken';

const buildListUrl = (tab: ConsoleTabName): string => `./${tab}/list.json`;

const asItems = (payload: Record<string, unknown>): ConsoleListItem[] =>
  Array.isArray(payload.items) ? (payload.items as ConsoleListItem[]) : [];

const asStatusOptions = (
  payload: Record<string, unknown>,
): ConsoleFieldOption[] =>
  Array.isArray(payload.statusOptions)
    ? (payload.statusOptions as ConsoleFieldOption[])
    : [];

const asStoryOptions = (
  payload: Record<string, unknown>,
): ConsoleFieldOption[] =>
  Array.isArray(payload.storyOptions)
    ? (payload.storyOptions as ConsoleFieldOption[])
    : [];

const asStoryColors = (
  payload: Record<string, unknown>,
): Record<string, ConsoleColor> => {
  const raw = payload.storyColors;
  if (raw === null || typeof raw !== 'object') {
    return {};
  }
  const result: Record<string, ConsoleColor> = {};
  for (const [story, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[story] = value as ConsoleColor;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as { color?: unknown }).color === 'string'
    ) {
      result[story] = (value as { color: ConsoleColor }).color;
    }
  }
  return result;
};

export type ConsoleListState = {
  items: ConsoleListItem[];
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  storyColors: Record<string, ConsoleColor>;
  generatedAt: string;
  isLoading: boolean;
  error: string | null;
};

const initialState: ConsoleListState = {
  items: [],
  statusOptions: [],
  storyOptions: [],
  storyColors: {},
  generatedAt: '',
  isLoading: true,
  error: null,
};

export const useConsoleList = (tab: ConsoleTabName): ConsoleListState => {
  const { appendToken } = useConsoleToken();
  const [state, setState] = useState<ConsoleListState>(initialState);

  useEffect(() => {
    let cancelled = false;
    setState({ ...initialState, isLoading: true });

    fetch(appendToken(buildListUrl(tab)))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as Record<string, unknown>;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setState({
          items: asItems(payload),
          statusOptions: asStatusOptions(payload),
          storyOptions: asStoryOptions(payload),
          storyColors: asStoryColors(payload),
          generatedAt:
            typeof payload.generatedAt === 'string' ? payload.generatedAt : '',
          isLoading: false,
          error: null,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        setState({
          ...initialState,
          isLoading: false,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tab, appendToken]);

  return state;
};
