import { useCallback } from 'react';
import type {
  ConsoleCloseEvent,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleReviewEvent,
  ConsoleReviewTarget,
  ConsoleSnoozeEvent,
  ConsoleTabName,
} from '../types';
import type { ConsoleApiClient } from './consoleApiClient';

const NON_ADVANCING_EVENTS = new Set<ConsoleSnoozeEvent>([
  'snooze_1day',
  'snooze_1week',
]);

export const eventAdvances = (
  tab: ConsoleTabName,
  event: ConsoleSnoozeEvent,
): boolean => tab === 'todo-by-human' || !NON_ADVANCING_EVENTS.has(event);

export type ConsoleOperationCallbacks = {
  onReview: (event: ConsoleReviewEvent) => Promise<void>;
  onSnooze: (event: ConsoleSnoozeEvent) => Promise<void>;
  onSetStory: (option: ConsoleFieldOption) => Promise<void>;
  onSetStatus: (option: ConsoleFieldOption) => Promise<void>;
  onSetInTmux: (option: ConsoleFieldOption) => Promise<void>;
  onClose: (event: ConsoleCloseEvent) => Promise<void>;
};

export type ConsoleOperationDependencies = {
  client: ConsoleApiClient;
  tab: ConsoleTabName;
  item: ConsoleListItem;
  reviewTarget: ConsoleReviewTarget | null;
  onProcessed: (item: ConsoleListItem) => void;
  onAdvance: () => void;
};

export const useConsoleOperation = ({
  client,
  tab,
  item,
  reviewTarget,
  onProcessed,
  onAdvance,
}: ConsoleOperationDependencies): ConsoleOperationCallbacks => {
  const onReview = useCallback(
    async (event: ConsoleReviewEvent) => {
      const target =
        reviewTarget ??
        (item.isPr ? { repo: item.repo, number: item.number } : null);
      if (target === null) {
        throw new Error('No linked open pull request to review for this item');
      }
      await client.postReview(target, event);
      onProcessed(item);
      onAdvance();
    },
    [client, item, reviewTarget, onProcessed, onAdvance],
  );

  const onSnooze = useCallback(
    async (event: ConsoleSnoozeEvent) => {
      await client.postTriage(
        item.projectItemId,
        item.repo,
        item.number,
        event,
        null,
      );
      if (eventAdvances(tab, event)) {
        onProcessed(item);
        onAdvance();
      }
    },
    [client, item, tab, onProcessed, onAdvance],
  );

  const onSetStory = useCallback(
    async (option: ConsoleFieldOption) => {
      await client.postTriage(
        item.projectItemId,
        item.repo,
        item.number,
        'set_story',
        option.id,
      );
      onProcessed(item);
      onAdvance();
    },
    [client, item, onProcessed, onAdvance],
  );

  const onSetStatus = useCallback(
    async (option: ConsoleFieldOption) => {
      await client.postTriage(
        item.projectItemId,
        item.repo,
        item.number,
        'set_status',
        option.id,
      );
      onProcessed(item);
      onAdvance();
    },
    [client, item, onProcessed, onAdvance],
  );

  const onSetInTmux = useCallback(async () => {
    await client.postInTmux(
      item.projectItemId,
      item.url,
      item.title,
      item.story,
    );
    onProcessed(item);
    onAdvance();
  }, [client, item, onProcessed, onAdvance]);

  const onClose = useCallback(
    async (event: ConsoleCloseEvent) => {
      await client.postTriage(
        item.projectItemId,
        item.repo,
        item.number,
        event,
        null,
      );
      onProcessed(item);
      onAdvance();
    },
    [client, item, onProcessed, onAdvance],
  );

  return {
    onReview,
    onSnooze,
    onSetStory,
    onSetStatus,
    onSetInTmux,
    onClose,
  };
};
