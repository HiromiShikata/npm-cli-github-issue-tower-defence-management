import {
  hasReachedHorizontalScrollBoundary,
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

describe('hasReachedHorizontalScrollBoundary', () => {
  const cases: Array<{
    name: string;
    direction: 'next' | 'previous';
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
    expected: boolean;
  }> = [
    {
      name: 'next direction, boundary not yet reached',
      direction: 'next',
      scrollLeft: 0,
      scrollWidth: 500,
      clientWidth: 100,
      expected: false,
    },
    {
      name: 'next direction, boundary reached',
      direction: 'next',
      scrollLeft: 400,
      scrollWidth: 500,
      clientWidth: 100,
      expected: true,
    },
    {
      name: 'previous direction, boundary not yet reached',
      direction: 'previous',
      scrollLeft: 50,
      scrollWidth: 500,
      clientWidth: 100,
      expected: false,
    },
    {
      name: 'previous direction, boundary reached',
      direction: 'previous',
      scrollLeft: 0,
      scrollWidth: 500,
      clientWidth: 100,
      expected: true,
    },
  ];

  it.each(cases)(
    '$name',
    ({ direction, scrollLeft, scrollWidth, clientWidth, expected }) => {
      expect(
        hasReachedHorizontalScrollBoundary(
          direction,
          scrollLeft,
          scrollWidth,
          clientWidth,
        ),
      ).toBe(expected);
    },
  );
});
