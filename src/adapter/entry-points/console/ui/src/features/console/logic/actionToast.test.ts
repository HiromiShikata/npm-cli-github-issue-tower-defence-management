import { consoleListItemsFixture } from '../testing/fixtures';
import {
  ACTION_TOAST_DELAY_MS,
  actionAdvances,
  actionToastColor,
  actionToastMessage,
  type ConsoleActionKind,
  formatActionToast,
  itemRepositoryLabel,
  itemToastLabel,
} from './actionToast';

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

describe('ACTION_TOAST_DELAY_MS', () => {
  it('is the five second cancellable window', () => {
    expect(ACTION_TOAST_DELAY_MS).toBe(5000);
  });
});

describe('itemRepositoryLabel', () => {
  type LabelTableCase = {
    kind: 'Issue' | 'PR';
    nameWithOwner: string;
    itemNumber: number;
    isPr: boolean;
    expectedLabel: string;
  };

  const labelTableCases: LabelTableCase[] = [
    {
      kind: 'Issue',
      nameWithOwner: 'HiromiShikata/umino-corporait-operation',
      itemNumber: 32994,
      isPr: false,
      expectedLabel: 'HiromiShikata/umino-corporait-operation#32994',
    },
    {
      kind: 'PR',
      nameWithOwner:
        'HiromiShikata/npm-cli-github-issue-tower-defence-management',
      itemNumber: 3176,
      isPr: true,
      expectedLabel:
        'PR HiromiShikata/npm-cli-github-issue-tower-defence-management#3176',
    },
  ];

  it.each(labelTableCases)(
    'formats a $kind label as $expectedLabel',
    ({ nameWithOwner, itemNumber, isPr, expectedLabel }) => {
      expect(itemRepositoryLabel(nameWithOwner, itemNumber, isPr)).toBe(
        expectedLabel,
      );
    },
  );

  it('produces distinct labels for the same item number across two different repositories', () => {
    const labelInRepoA = itemRepositoryLabel(
      'HiromiShikata/umino-corporait-operation',
      851,
      false,
    );
    const labelInRepoB = itemRepositoryLabel(
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
      851,
      false,
    );
    expect(labelInRepoA).not.toBe(labelInRepoB);
  });
});

describe('itemToastLabel', () => {
  it('prefixes pull requests with PR and the repository name with no space before the item number', () => {
    expect(itemToastLabel(prItem)).toBe(
      `PR ${prItem.nameWithOwner}#${prItem.number}`,
    );
  });

  it('prefixes issues with the repository name and no Issue/PR word', () => {
    expect(itemToastLabel(issueItem)).toBe(
      `${issueItem.nameWithOwner}#${issueItem.number}`,
    );
  });

  it('delegates to itemRepositoryLabel using the item nameWithOwner, number and isPr', () => {
    expect(itemToastLabel(prItem)).toBe(
      itemRepositoryLabel(prItem.nameWithOwner, prItem.number, prItem.isPr),
    );
    expect(itemToastLabel(issueItem)).toBe(
      itemRepositoryLabel(
        issueItem.nameWithOwner,
        issueItem.number,
        issueItem.isPr,
      ),
    );
  });
});

describe('actionToastMessage', () => {
  it('labels review actions', () => {
    expect(
      actionToastMessage(
        { type: 'review', action: 'approve_and_merge' },
        'prs',
      ),
    ).toBe('Approved & Merged');
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

  it('labels the +1 week snooze differently on the manual triage tabs', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1week',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +1w');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +1w skip',
    );
  });

  it('labels the +1 day snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1day',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +1d');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +1d',
    );
  });

  it('labels the +1 hour snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1hour',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Hour +1h');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Hour +1h',
    );
  });

  it('labels the +3 hours snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_3hours',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Hour +3h');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Hour +3h',
    );
  });

  it('labels the +6 hours snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_6hours',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Hour +6h');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Hour +6h',
    );
  });

  it('labels the +2 days snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_2days',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +2d');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +2d',
    );
  });

  it('labels the +3 days snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_3days',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +3d');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +3d',
    );
  });

  it('labels the +5 days snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_5days',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +5d');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +5d',
    );
  });

  it('labels the +1 month snooze the same on every tab', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1month',
    };
    expect(actionToastMessage(kind, 'prs')).toBe('Next Action Date +1mo');
    expect(actionToastMessage(kind, 'todo-by-human')).toBe(
      'Next Action Date +1mo',
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
        { type: 'set_in_tmux_by_human', optionName: 'In Tmux by human' },
        'prs',
      ),
    ).toBe('Added to In Tmux by human');
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
        'todo-by-human',
      ),
    ).toBe('Story → Move to Okinawa');
  });
});

describe('actionToastColor', () => {
  it('colors each action group like the reference', () => {
    expect(
      actionToastColor({ type: 'review', action: 'approve_and_merge' }),
    ).toBe('green');
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
    expect(actionToastColor({ type: 'ok_and_awaiting_workspace' })).toBe(
      'blue',
    );
  });
});

describe('actionToastMessage for ok_and_awaiting_workspace', () => {
  it('returns the composite label', () => {
    expect(
      actionToastMessage({ type: 'ok_and_awaiting_workspace' }, 'prs'),
    ).toBe('ok → Awaiting Workspace');
  });
});

describe('actionToastMessage for ok_and_close', () => {
  it('returns the composite label', () => {
    expect(actionToastMessage({ type: 'ok_and_close' }, 'todo-by-human')).toBe(
      'ok → Closed',
    );
  });
});

describe('actionToastColor for ok_and_close', () => {
  it('returns red', () => {
    expect(actionToastColor({ type: 'ok_and_close' })).toBe('red');
  });
});

describe('actionAdvances', () => {
  it('advances every non-snooze action in every tab', () => {
    expect(
      actionAdvances({ type: 'review', action: 'approve_and_merge' }, 'prs'),
    ).toBe(true);
    expect(actionAdvances({ type: 'set_status', optionName: 'x' }, 'prs')).toBe(
      true,
    );
    expect(actionAdvances({ type: 'ok_and_awaiting_workspace' }, 'prs')).toBe(
      true,
    );
  });

  it('does not advance a snooze except on the manual triage tabs', () => {
    const kind: ConsoleActionKind = {
      type: 'next_action_date',
      action: 'snooze_1week',
    };
    expect(actionAdvances(kind, 'prs')).toBe(false);
    expect(actionAdvances(kind, 'todo-by-human')).toBe(true);
  });
});

describe('formatActionToast', () => {
  it('combines the message and the repository-qualified item label', () => {
    expect(
      formatActionToast(
        { type: 'review', action: 'approve_and_merge' },
        prItem,
        'prs',
      ),
    ).toBe(`Approved & Merged — PR ${prItem.nameWithOwner}#${prItem.number}`);
  });
});
