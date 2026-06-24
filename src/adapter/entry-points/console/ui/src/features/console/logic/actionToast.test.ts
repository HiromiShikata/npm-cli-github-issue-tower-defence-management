import { consoleListItemsFixture } from '../testing/fixtures';
import {
  ACTION_TOAST_DELAY_MS,
  actionAdvances,
  actionToastColor,
  actionToastMessage,
  type ConsoleActionKind,
  formatActionToast,
  itemToastLabel,
} from './actionToast';

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

describe('ACTION_TOAST_DELAY_MS', () => {
  it('is the five second cancellable window', () => {
    expect(ACTION_TOAST_DELAY_MS).toBe(5000);
  });
});

describe('itemToastLabel', () => {
  it('prefixes pull requests with PR #', () => {
    expect(itemToastLabel(prItem)).toBe(`PR #${prItem.number}`);
  });

  it('prefixes issues with #', () => {
    expect(itemToastLabel(issueItem)).toBe(`#${issueItem.number}`);
  });
});

describe('actionToastMessage', () => {
  it('labels review actions', () => {
    expect(
      actionToastMessage({ type: 'review', action: 'approve' }, 'prs'),
    ).toBe('Approved');
    expect(
      actionToastMessage({ type: 'review', action: 'request_changes' }, 'prs'),
    ).toBe('Rejected');
    expect(
      actionToastMessage({ type: 'review', action: 'totally_wrong' }, 'prs'),
    ).toBe('Marked totally wrong');
    expect(
      actionToastMessage({ type: 'review', action: 'unnecessary' }, 'prs'),
    ).toBe('Marked unnecessary');
  });

  it('labels the +1 week snooze differently on the todo-by-human tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1week',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +1 week');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +1 week and skip',
    );
  });

  it('labels the +1 day snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1day',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +1 day');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +1 day',
    );
  });

  it('labels close actions', () => {
    expect(actionToastMessage({ type: 'close', action: 'close' }, 'prs')).toBe(
      'Closed',
    );
    expect(
      actionToastMessage({ type: 'close', action: 'close_not_planned' }, 'prs'),
    ).toBe('Closed as not planned');
  });

  it('labels the in-tmux-by-human action', () => {
    expect(
      actionToastMessage(
        { type: 'set_in_tmux_by_human', optionName: 'In Tmux live session' },
        'prs',
      ),
    ).toBe('Added to In Tmux live session');
  });

  it('labels field updates with the chosen option name', () => {
    expect(
      actionToastMessage(
        { type: 'set_status', optionName: 'Awaiting Workspace' },
        'prs',
      ),
    ).toBe('Status → Awaiting Workspace');
    expect(
      actionToastMessage(
        { type: 'set_story', optionName: 'Move to Okinawa' },
        'triage',
      ),
    ).toBe('Story → Move to Okinawa');
  });
});

describe('actionToastColor', () => {
  it('colors each action group like the reference', () => {
    expect(actionToastColor({ type: 'review', action: 'approve' })).toBe(
      'green',
    );
    expect(
      actionToastColor({ type: 'review', action: 'request_changes' }),
    ).toBe('amber');
    expect(actionToastColor({ type: 'review', action: 'totally_wrong' })).toBe(
      'red',
    );
    expect(actionToastColor({ type: 'review', action: 'unnecessary' })).toBe(
      'gray',
    );
    expect(
      actionToastColor({ type: 'set_status', optionName: 'Todo by human' }),
    ).toBe('blue');
    expect(
      actionToastColor({ type: 'next_action_date', action: 'snooze_1day' }),
    ).toBe('amber');
    expect(actionToastColor({ type: 'close', action: 'close' })).toBe('red');
  });
});

describe('actionAdvances', () => {
  it('advances every non-snooze action in every tab', () => {
    expect(actionAdvances({ type: 'review', action: 'approve' }, 'prs')).toBe(
      true,
    );
    expect(actionAdvances({ type: 'set_status', optionName: 'x' }, 'prs')).toBe(
      true,
    );
  });

  it('does not advance a snooze except on the todo-by-human tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1week',
    };
    expect(actionAdvances(kind, 'prs')).toBe(false);
    expect(actionAdvances(kind, 'todo-by-human')).toBe(true);
  });
});

describe('formatActionToast', () => {
  it('combines the message and the item label', () => {
    expect(
      formatActionToast({ type: 'review', action: 'approve' }, prItem, 'prs'),
    ).toBe(`Approved — PR #${prItem.number}`);
  });
});
