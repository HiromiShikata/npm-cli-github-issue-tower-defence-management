import {
  IN_TMUX_BY_HUMAN_NAME,
  isTodoByHumanTab,
  STATUS_BUTTON_NAMES,
  TOTALLY_WRONG_COMMENT_BODY,
  UNNECESSARY_COMMENT_BODY,
} from './operations';

describe('operation constants', () => {
  it('defines the totally wrong comment body', () => {
    expect(TOTALLY_WRONG_COMMENT_BODY).toBe('totally wrong');
  });

  it('defines the unnecessary comment body', () => {
    expect(UNNECESSARY_COMMENT_BODY).toBe('This pull request is unnecessary.');
  });

  it('lists the status buttons left to right', () => {
    expect(STATUS_BUTTON_NAMES).toEqual([
      'In Tmux by agent',
      'In Tmux live session',
      'Todo by human',
      'Awaiting Workspace',
    ]);
  });

  it('names the in-tmux-by-human status', () => {
    expect(IN_TMUX_BY_HUMAN_NAME).toBe('In Tmux live session');
  });
});

describe('isTodoByHumanTab', () => {
  it('is true only for the todo-by-human tab', () => {
    expect(isTodoByHumanTab('todo-by-human')).toBe(true);
    expect(isTodoByHumanTab('prs')).toBe(false);
  });
});
