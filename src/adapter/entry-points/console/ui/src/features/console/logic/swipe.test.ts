import {
  isVerticallyDominant,
  resolveSwipeDirection,
  SWIPE_MIN_DISTANCE,
} from './swipe';

describe('resolveSwipeDirection', () => {
  it('reports next for a dominant left swipe', () => {
    expect(resolveSwipeDirection(-120, 10)).toBe('next');
  });

  it('reports previous for a dominant right swipe', () => {
    expect(resolveSwipeDirection(120, 10)).toBe('previous');
  });

  it('ignores a gesture shorter than the minimum distance', () => {
    expect(resolveSwipeDirection(-(SWIPE_MIN_DISTANCE - 1), 0)).toBeNull();
  });

  it('ignores a gesture that is not horizontally dominant', () => {
    expect(resolveSwipeDirection(-80, 70)).toBeNull();
  });
});

describe('isVerticallyDominant', () => {
  it('is true for a clearly vertical drag', () => {
    expect(isVerticallyDominant(10, 80)).toBe(true);
  });

  it('is false for a small or horizontal drag', () => {
    expect(isVerticallyDominant(80, 10)).toBe(false);
    expect(isVerticallyDominant(5, 15)).toBe(false);
  });
});
