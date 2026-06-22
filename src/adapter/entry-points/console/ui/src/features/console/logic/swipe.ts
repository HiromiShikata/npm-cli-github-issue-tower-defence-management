export type ConsoleSwipeDirection = 'next' | 'previous' | null;

export const SWIPE_MIN_DISTANCE = 60;
export const SWIPE_HORIZONTAL_DOMINANCE = 1.5;

export const resolveSwipeDirection = (
  deltaX: number,
  deltaY: number,
): ConsoleSwipeDirection => {
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);
  if (absDeltaX < SWIPE_MIN_DISTANCE) {
    return null;
  }
  if (absDeltaX <= absDeltaY * SWIPE_HORIZONTAL_DOMINANCE) {
    return null;
  }
  return deltaX < 0 ? 'next' : 'previous';
};

export const isVerticallyDominant = (
  deltaX: number,
  deltaY: number,
): boolean => {
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);
  return absDeltaY > absDeltaX * SWIPE_HORIZONTAL_DOMINANCE && absDeltaY > 20;
};
