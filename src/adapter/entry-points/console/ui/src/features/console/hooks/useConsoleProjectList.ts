import { useEffect, useRef, useState } from 'react';
import { fetchProjectList, type ProjectListResponse } from '../lib/consoleApi';
import { CONSOLE_TAB_REFRESH_INTERVAL_MS } from './useConsoleTabData';

export type ConsoleProjectListState = {
  pjcodes: string[];
  projectUrls: Record<string, string> | null;
  fleetTaskCreateUrl: string | null;
  nameWithOwnerByPjcode: Record<string, string> | null;
  disabledPjcodes: string[];
  isLoading: boolean;
  error: Error | null;
};

type HeldProjectListValues = Omit<
  ConsoleProjectListState,
  'isLoading' | 'error'
>;

const isSameJsonValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const useConsoleProjectList = (
  enabled: boolean,
  isForegroundLoading: boolean,
): ConsoleProjectListState => {
  const [pjcodes, setPjcodes] = useState<string[]>([]);
  const [projectUrls, setProjectUrls] = useState<Record<string, string> | null>(
    null,
  );
  const [fleetTaskCreateUrl, setFleetTaskCreateUrl] = useState<string | null>(
    null,
  );
  const [nameWithOwnerByPjcode, setNameWithOwnerByPjcode] = useState<Record<
    string,
    string
  > | null>(null);
  const [disabledPjcodes, setDisabledPjcodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const heldValuesRef = useRef<HeldProjectListValues>({
    pjcodes,
    projectUrls,
    fleetTaskCreateUrl,
    nameWithOwnerByPjcode,
    disabledPjcodes,
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchProjectList()
      .then((result) => {
        if (!cancelled) {
          heldValuesRef.current = {
            pjcodes: result.pjcodes,
            projectUrls: result.projectUrls,
            fleetTaskCreateUrl: result.fleetTaskCreateUrl,
            nameWithOwnerByPjcode: result.nameWithOwnerByPjcode,
            disabledPjcodes: result.disabledPjcodes,
          };
          setPjcodes(result.pjcodes);
          setProjectUrls(result.projectUrls);
          setFleetTaskCreateUrl(result.fleetTaskCreateUrl);
          setNameWithOwnerByPjcode(result.nameWithOwnerByPjcode);
          setDisabledPjcodes(result.disabledPjcodes);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || isForegroundLoading) {
      return;
    }
    let cancelled = false;

    const applyWhenChanged = (result: ProjectListResponse): void => {
      const held = heldValuesRef.current;
      if (!isSameJsonValue(held.pjcodes, result.pjcodes)) {
        heldValuesRef.current = { ...heldValuesRef.current, pjcodes: result.pjcodes };
        setPjcodes(result.pjcodes);
      }
      if (!isSameJsonValue(held.projectUrls, result.projectUrls)) {
        heldValuesRef.current = {
          ...heldValuesRef.current,
          projectUrls: result.projectUrls,
        };
        setProjectUrls(result.projectUrls);
      }
      if (!isSameJsonValue(held.fleetTaskCreateUrl, result.fleetTaskCreateUrl)) {
        heldValuesRef.current = {
          ...heldValuesRef.current,
          fleetTaskCreateUrl: result.fleetTaskCreateUrl,
        };
        setFleetTaskCreateUrl(result.fleetTaskCreateUrl);
      }
      if (
        !isSameJsonValue(
          held.nameWithOwnerByPjcode,
          result.nameWithOwnerByPjcode,
        )
      ) {
        heldValuesRef.current = {
          ...heldValuesRef.current,
          nameWithOwnerByPjcode: result.nameWithOwnerByPjcode,
        };
        setNameWithOwnerByPjcode(result.nameWithOwnerByPjcode);
      }
      if (!isSameJsonValue(held.disabledPjcodes, result.disabledPjcodes)) {
        heldValuesRef.current = {
          ...heldValuesRef.current,
          disabledPjcodes: result.disabledPjcodes,
        };
        setDisabledPjcodes(result.disabledPjcodes);
      }
    };

    const load = (): void => {
      fetchProjectList()
        .then((result) => {
          if (!cancelled) {
            applyWhenChanged(result);
          }
        })
        .catch(() => {});
    };

    const timer = setInterval(load, CONSOLE_TAB_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, isForegroundLoading]);

  return {
    pjcodes,
    projectUrls,
    fleetTaskCreateUrl,
    nameWithOwnerByPjcode,
    disabledPjcodes,
    isLoading,
    error,
  };
};
