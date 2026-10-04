import { useCallback, useEffect, useRef } from 'react';
import {
  type ConsoleSwipeDirection,
  hasReachedHorizontalScrollBoundary,
  isVerticallyDominant,
  resolveSwipeDirection,
} from '../logic/swipe';

type HorizontalScrollMetrics = {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
};

const findHorizontalScrollMetrics = (
  start: EventTarget | null,
): HorizontalScrollMetrics | null => {
  let node = start instanceof Element ? start : null;
  while (node !== null && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth
    ) {
      return {
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      };
    }
    node = node.parentElement;
  }
  return null;
};

export const useConsoleSwipeNavigation = (
  onSwipe: (direction: ConsoleSwipeDirection) => void,
): ((element: HTMLElement | null) => void) => {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const detachRef = useRef<(() => void) | null>(null);

  const attach = useCallback((element: HTMLElement): (() => void) => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let scrollMetricsAtStart: HorizontalScrollMetrics | null = null;

    const onTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }
      scrollMetricsAtStart = findHorizontalScrollMetrics(event.target);
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const onTouchMove = (event: TouchEvent): void => {
      if (!tracking) {
        return;
      }
      const touch = event.touches[0];
      if (
        isVerticallyDominant(touch.clientX - startX, touch.clientY - startY)
      ) {
        tracking = false;
      }
    };

    const onTouchEnd = (event: TouchEvent): void => {
      if (!tracking) {
        return;
      }
      tracking = false;
      if (event.changedTouches.length !== 1) {
        return;
      }
      const touch = event.changedTouches[0];
      const direction = resolveSwipeDirection(
        touch.clientX - startX,
        touch.clientY - startY,
      );
      if (direction === null) {
        return;
      }
      if (
        scrollMetricsAtStart !== null &&
        !hasReachedHorizontalScrollBoundary(
          direction,
          scrollMetricsAtStart.scrollLeft,
          scrollMetricsAtStart.scrollWidth,
          scrollMetricsAtStart.clientWidth,
        )
      ) {
        return;
      }
      onSwipeRef.current(direction);
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const swipeRef = useCallback(
    (element: HTMLElement | null): void => {
      if (detachRef.current !== null) {
        detachRef.current();
        detachRef.current = null;
      }
      if (element !== null) {
        detachRef.current = attach(element);
      }
    },
    [attach],
  );

  useEffect(() => {
    return () => {
      if (detachRef.current !== null) {
        detachRef.current();
        detachRef.current = null;
      }
    };
  }, []);

  return swipeRef;
};
