import { CONSOLE_ITEM_ICONS, resolveConsoleItemIconKind } from './itemIcons';

describe('resolveConsoleItemIconKind', () => {
  it('resolves a draft pull request to prDraft', () => {
    expect(
      resolveConsoleItemIconKind({
        isPr: true,
        state: 'open',
        merged: false,
        isDraft: true,
        stateReason: '',
      }),
    ).toBe('prDraft');
  });

  it('resolves a merged pull request to prMerged', () => {
    expect(
      resolveConsoleItemIconKind({
        isPr: true,
        state: 'closed',
        merged: true,
        isDraft: false,
        stateReason: '',
      }),
    ).toBe('prMerged');
  });

  it('resolves a closed pull request to prClosed', () => {
    expect(
      resolveConsoleItemIconKind({
        isPr: true,
        state: 'closed',
        merged: false,
        isDraft: false,
        stateReason: '',
      }),
    ).toBe('prClosed');
  });

  it('resolves an open pull request to prOpen', () => {
    expect(
      resolveConsoleItemIconKind({
        isPr: true,
        state: 'open',
        merged: false,
        isDraft: false,
        stateReason: '',
      }),
    ).toBe('prOpen');
  });

  it('resolves a completed closed issue to issueClosed', () => {
    expect(
      resolveConsoleItemIconKind({
        isPr: false,
        state: 'closed',
        merged: false,
        isDraft: false,
        stateReason: 'completed',
      }),
    ).toBe('issueClosed');
  });

  it('resolves a not-planned closed issue to issueClosedNotPlanned', () => {
    expect(
      resolveConsoleItemIconKind({
        isPr: false,
        state: 'closed',
        merged: false,
        isDraft: false,
        stateReason: 'not_planned',
      }),
    ).toBe('issueClosedNotPlanned');
  });

  it('resolves an open issue to issueOpen', () => {
    expect(
      resolveConsoleItemIconKind({
        isPr: false,
        state: 'open',
        merged: false,
        isDraft: false,
        stateReason: '',
      }),
    ).toBe('issueOpen');
  });

  it('uses the documented colors for each kind', () => {
    expect(CONSOLE_ITEM_ICONS.prDraft.color).toBe('#8b949e');
    expect(CONSOLE_ITEM_ICONS.prMerged.color).toBe('#a371f7');
    expect(CONSOLE_ITEM_ICONS.prClosed.color).toBe('#f85149');
    expect(CONSOLE_ITEM_ICONS.prOpen.color).toBe('#3fb950');
    expect(CONSOLE_ITEM_ICONS.issueClosedNotPlanned.color).toBe('#848d97');
    expect(CONSOLE_ITEM_ICONS.issueClosed.color).toBe('#a371f7');
    expect(CONSOLE_ITEM_ICONS.issueOpen.color).toBe('#3fb950');
  });
});
