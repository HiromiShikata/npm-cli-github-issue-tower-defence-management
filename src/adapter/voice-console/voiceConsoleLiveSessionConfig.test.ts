import {
  VOICE_CONSOLE_INSTRUCTIONS,
  VOICE_CONSOLE_TOOL_DEFINITIONS,
  VOICE_CONSOLE_TOOL_NAMES,
} from './voiceConsoleLiveSessionConfig';

const requiredToolNames = [
  'queue_overview',
  'current_task_summary',
  'current_task_detail',
  'read_github_url',
  'read_pull_request',
  'read_repository_file',
  'search_issues',
  'next_task',
  'previous_task',
  'jump_to_task',
  'prepare_ok',
  'prepare_comment_and_move_to_awaiting_workspace',
  'prepare_comment_only',
  'prepare_close',
  'prepare_snooze',
  'prepare_set_status',
  'prepare_move_to_in_tmux_by_human',
  'prepare_pull_request_review',
  'confirm_pending_action',
  'cancel_pending_action',
];

const removedToolNames = [
  'session_reply_send',
  'session_skip',
  'owner_call_repeat',
];

const readToolNames = [
  'queue_overview',
  'current_task_summary',
  'current_task_detail',
  'read_github_url',
  'read_pull_request',
  'read_repository_file',
  'search_issues',
];

const expectedPrepareToolNames = [
  'prepare_ok',
  'prepare_comment_and_move_to_awaiting_workspace',
  'prepare_comment_only',
  'prepare_close',
  'prepare_snooze',
  'prepare_set_status',
  'prepare_move_to_in_tmux_by_human',
  'prepare_pull_request_review',
];

describe('VOICE_CONSOLE_INSTRUCTIONS', () => {
  it('is a non-empty Japanese instruction text containing the wording the assistant must use', () => {
    const cases = [{ word: 'はい' }, { word: '詳しく' }];

    for (const testCase of cases) {
      expect(VOICE_CONSOLE_INSTRUCTIONS.length).toBeGreaterThan(0);
      expect(VOICE_CONSOLE_INSTRUCTIONS).toContain(testCase.word);
    }
  });
});

describe('VOICE_CONSOLE_TOOL_NAMES', () => {
  it('contains every required tool name', () => {
    const cases = requiredToolNames.map((name) => ({ name }));

    for (const testCase of cases) {
      expect(VOICE_CONSOLE_TOOL_NAMES).toContain(testCase.name);
    }
  });

  it('does not contain the tool names removed from the console UI voice flow', () => {
    const cases = removedToolNames.map((name) => ({ name }));

    for (const testCase of cases) {
      expect(VOICE_CONSOLE_TOOL_NAMES).not.toContain(testCase.name);
    }
  });

  it('lists exactly the names of the tool definitions', () => {
    expect(VOICE_CONSOLE_TOOL_NAMES).toEqual(
      VOICE_CONSOLE_TOOL_DEFINITIONS.map((definition) => definition.name),
    );
  });

  it('has the eight prepare_ tools and no prepare_ or confirm_ tool named like a read tool', () => {
    const preparedNames = VOICE_CONSOLE_TOOL_NAMES.filter((name) =>
      name.startsWith('prepare_'),
    );
    expect([...preparedNames].sort()).toEqual(
      [...expectedPrepareToolNames].sort(),
    );

    const cases = VOICE_CONSOLE_TOOL_NAMES.filter(
      (name) => name.startsWith('prepare_') || name.startsWith('confirm_'),
    ).map((name) => ({ name }));
    const readLikePrefixes = ['read_', 'queue_', 'current_', 'search_'];

    for (const testCase of cases) {
      expect(readToolNames).not.toContain(testCase.name);
      for (const prefix of readLikePrefixes) {
        expect(testCase.name.startsWith(prefix)).toBe(false);
      }
    }
  });
});

describe('VOICE_CONSOLE_TOOL_DEFINITIONS', () => {
  it('gives every definition a function type, a name, a description and an object JSON schema', () => {
    const cases = VOICE_CONSOLE_TOOL_DEFINITIONS.map((definition) => ({
      definition,
    }));

    for (const testCase of cases) {
      expect(testCase.definition.type).toBe('function');
      expect(testCase.definition.name.length).toBeGreaterThan(0);
      expect(testCase.definition.description.length).toBeGreaterThan(0);
      expect(testCase.definition.parameters).toMatchObject({ type: 'object' });
    }
  });
});
