import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useConsoleSwipeNavigation } from './useConsoleSwipeNavigation';

const touchEvent = (
  type: string,
  point: { clientX: number; clientY: number },
  property: 'touches' | 'changedTouches',
): TouchEvent => {
  const event = new Event(type, { bubbles: true }) as TouchEvent;
  Object.defineProperty(event, property, {
    value: [point],
    configurable: true,
  });
  return event;
};

const swipe = (
  element: HTMLElement,
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number },
): void => {
  element.dispatchEvent(touchEvent('touchstart', from, 'touches'));
  element.dispatchEvent(touchEvent('touchmove', to, 'touches'));
  element.dispatchEvent(touchEvent('touchend', to, 'changedTouches'));
};

describe('useConsoleSwipeNavigation', () => {
  it('reports next for a dominant left swipe', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const ref = createRef<HTMLElement>();
    ref.current = element;
    const onSwipe = jest.fn();
    renderHook(() => useConsoleSwipeNavigation(ref, onSwipe));
    swipe(
      element,
      { clientX: 200, clientY: 100 },
      { clientX: 60, clientY: 110 },
    );
    expect(onSwipe).toHaveBeenCalledWith('next');
    document.body.removeChild(element);
  });

  it('reports previous for a dominant right swipe', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const ref = createRef<HTMLElement>();
    ref.current = element;
    const onSwipe = jest.fn();
    renderHook(() => useConsoleSwipeNavigation(ref, onSwipe));
    swipe(
      element,
      { clientX: 60, clientY: 100 },
      { clientX: 200, clientY: 110 },
    );
    expect(onSwipe).toHaveBeenCalledWith('previous');
    document.body.removeChild(element);
  });

  it('ignores a mostly vertical drag', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const ref = createRef<HTMLElement>();
    ref.current = element;
    const onSwipe = jest.fn();
    renderHook(() => useConsoleSwipeNavigation(ref, onSwipe));
    swipe(
      element,
      { clientX: 100, clientY: 50 },
      { clientX: 110, clientY: 200 },
    );
    expect(onSwipe).not.toHaveBeenCalled();
    document.body.removeChild(element);
  });

  it('does not navigate when the gesture starts in a horizontally scrollable element', () => {
    const element = document.createElement('div');
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollWidth', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(scroller, 'clientWidth', {
      value: 100,
      configurable: true,
    });
    scroller.style.overflowX = 'auto';
    element.appendChild(scroller);
    document.body.appendChild(element);
    const ref = createRef<HTMLElement>();
    ref.current = element;
    const onSwipe = jest.fn();
    renderHook(() => useConsoleSwipeNavigation(ref, onSwipe));
    scroller.dispatchEvent(
      touchEvent('touchstart', { clientX: 200, clientY: 100 }, 'touches'),
    );
    scroller.dispatchEvent(
      touchEvent('touchend', { clientX: 60, clientY: 100 }, 'changedTouches'),
    );
    expect(onSwipe).not.toHaveBeenCalled();
    document.body.removeChild(element);
  });
});
