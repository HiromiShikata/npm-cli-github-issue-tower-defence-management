import { type RefObject, useEffect, useRef } from 'react';
import {
  type ConsoleSwipeDirection,
  isVerticallyDominant,
  resolveSwipeDirection,
} from '../logic/swipe';

const isHorizontallyScrollable = (start: EventTarget | null): boolean => {
  let node = start instanceof Element ? start : null;
  while (node !== null && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
};

export const useConsoleSwipeNavigation = (
  ref: RefObject<HTMLElement | null>,
  onSwipe: (direction: ConsoleSwipeDirection) => void,
): void => {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }
      if (isHorizontallyScrollable(event.target)) {
        tracking = false;
        return;
      }
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
      if (direction !== null) {
        onSwipeRef.current(direction);
      }
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref]);
};
