import { render, screen } from '@testing-library/react';
import { ConsoleItemIcon, resolveConsoleItemIconKind } from './ConsoleItemIcon';

describe('resolveConsoleItemIconKind', () => {
  it('resolves an open issue', () => {
    expect(resolveConsoleItemIconKind(false, 'open', false, false, '')).toBe(
      'issueOpen',
    );
  });

  it('resolves a completed closed issue', () => {
    expect(
      resolveConsoleItemIconKind(false, 'closed', false, false, 'completed'),
    ).toBe('issueClosed');
  });

  it('resolves a not-planned closed issue', () => {
    expect(
      resolveConsoleItemIconKind(false, 'closed', false, false, 'not_planned'),
    ).toBe('issueClosedNotPlanned');
  });

  it('resolves a draft pull request before merged or closed', () => {
    expect(resolveConsoleItemIconKind(true, 'open', true, true, '')).toBe(
      'prDraft',
    );
  });

  it('resolves a merged pull request', () => {
    expect(resolveConsoleItemIconKind(true, 'closed', true, false, '')).toBe(
      'prMerged',
    );
  });

  it('resolves a closed pull request', () => {
    expect(resolveConsoleItemIconKind(true, 'closed', false, false, '')).toBe(
      'prClosed',
    );
  });

  it('resolves an open pull request', () => {
    expect(resolveConsoleItemIconKind(true, 'open', false, false, '')).toBe(
      'prOpen',
    );
  });
});

describe('ConsoleItemIcon', () => {
  it('renders an svg labeled by its resolved kind', () => {
    render(<ConsoleItemIcon isPr={false} state="open" />);
    expect(screen.getByLabelText('issueOpen')).toBeInTheDocument();
  });
});
