import React from 'react';
import { useState, useCallback, useRef } from 'react';
import { useAccessKey } from './hooks/useAccessKey';
import { usePrList } from './hooks/usePrList';
import { usePrDetail } from './hooks/usePrDetail';
import { AccessKeyPrompt } from './components/AccessKeyPrompt';
import { ListView } from './components/ListView';
import { DetailView } from './components/DetailView';
import { UndoToast } from './components/UndoToast';
import { submitReview } from './api/client';
import type { PrListItem, ReviewAction, DiffLineComment } from './api/types';

type ToastState = {
  action: ReviewAction;
  prTitle: string;
  prKey: string;
};

type PendingReview = {
  action: ReviewAction;
  repo: string;
  prNumber: number;
  projectItemId: string;
  inlineComments: DiffLineComment[];
};

const buildPrKey = (repo: string, prNumber: number): string => `${repo}/${prNumber}`;

export const App = (): React.JSX.Element => {
  const { accessKey, setAccessKey } = useAccessKey();
  const { data: listData, loading: listLoading, error: listError, unauthorized, reload } = usePrList(accessKey);
  const { state: detailState, load: loadDetail, currentKey: detailKey } = usePrDetail(accessKey);

  const [selectedItem, setSelectedItem] = useState<PrListItem | null>(null);
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const pendingReviewRef = useRef<PendingReview | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelectPr = useCallback(
    (item: PrListItem): void => {
      setSelectedItem(item);
      loadDetail({ repo: item.pr.repo, prNumber: item.pr.number });
    },
    [loadDetail],
  );

  const handleAction = useCallback(
    (action: ReviewAction, inlineComments: DiffLineComment[]): void => {
      if (!selectedItem || !accessKey) return;

      const { repo, number: prNumber, title: prTitle } = selectedItem.pr;
      const { projectItemId } = selectedItem.issue;
      const prKey = buildPrKey(repo, prNumber);

      setDoneSet((prev) => new Set([...prev, prKey]));

      const allItems = listData?.items ?? [];
      const pendingItems = allItems.filter(
        (item) => !doneSet.has(buildPrKey(item.pr.repo, item.pr.number)) && buildPrKey(item.pr.repo, item.pr.number) !== prKey,
      );

      if (pendingItems.length > 0) {
        const nextItem = pendingItems[0];
        setSelectedItem(nextItem);
        loadDetail({ repo: nextItem.pr.repo, prNumber: nextItem.pr.number });
      } else {
        setSelectedItem(null);
      }

      setToast({ action, prTitle, prKey });

      pendingReviewRef.current = { action, repo, prNumber, projectItemId, inlineComments };

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        const pending = pendingReviewRef.current;
        if (pending) {
          pendingReviewRef.current = null;
          submitReview(accessKey, pending.action, pending.repo, pending.prNumber, pending.projectItemId, pending.inlineComments).catch(() => {
            reload();
          });
        }
        setToast(null);
      }, 5000);
    },
    [selectedItem, accessKey, listData, doneSet, loadDetail, reload],
  );

  const handleUndo = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingReviewRef.current = null;

    if (toast) {
      const prKey = toast.prKey;
      setDoneSet((prev) => {
        const next = new Set(prev);
        next.delete(prKey);
        return next;
      });
      const [repo, prNumberStr] = prKey.split('/');
      const prNumber = Number(prNumberStr);
      const item = listData?.items.find((i) => i.pr.repo === repo && i.pr.number === prNumber) ?? null;
      setSelectedItem(item);
      if (item) {
        loadDetail({ repo: item.pr.repo, prNumber: item.pr.number });
      }
    }
    setToast(null);
  }, [toast, listData, loadDetail]);

  const handleToastExpire = useCallback((): void => {
    setToast(null);
  }, []);

  if (unauthorized || !accessKey) {
    return <AccessKeyPrompt onSubmit={setAccessKey} />;
  }

  if (listLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#6b7280' }}>
        Loading...
      </div>
    );
  }

  if (listError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#ef4444' }}>
        Error: {listError}
      </div>
    );
  }

  if (selectedItem && detailKey && detailKey.repo === selectedItem.pr.repo && detailKey.prNumber === selectedItem.pr.number) {
    if (detailState.loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#6b7280' }}>
          Loading PR details...
        </div>
      );
    }
    if (detailState.data) {
      return (
        <>
          <DetailView
            detail={detailState.data}
            repo={selectedItem.pr.repo}
            onAction={handleAction}
            onBack={() => setSelectedItem(null)}
          />
          {toast && (
            <UndoToast
              action={toast.action}
              prTitle={toast.prTitle}
              onUndo={handleUndo}
              onExpire={handleToastExpire}
            />
          )}
        </>
      );
    }
  }

  return (
    <>
      <ListView
        stories={listData?.stories ?? []}
        items={listData?.items ?? []}
        doneSet={doneSet}
        onSelectPr={handleSelectPr}
      />
      {toast && (
        <UndoToast
          action={toast.action}
          prTitle={toast.prTitle}
          onUndo={handleUndo}
          onExpire={handleToastExpire}
        />
      )}
    </>
  );
};
