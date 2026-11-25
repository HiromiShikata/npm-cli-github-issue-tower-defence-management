import {
  VOICE_CONSOLE_BACKEND_INSTRUCTIONS,
  VOICE_CONSOLE_LIVE_INSTRUCTIONS,
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
  'prepare_create_task',
  'confirm_pending_action',
  'cancel_pending_action',
  'repeat_current_task',
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
  'prepare_create_task',
];

describe('VOICE_CONSOLE_BACKEND_INSTRUCTIONS', () => {
  it('tells the backend to use prepare_create_task for the owner trigger phrases', () => {
    const cases = [
      { word: 'prepare_create_task' },
      { word: 'タスクを作って' },
      { word: 'タスク追加' },
      { word: '起票' },
    ];

    for (const testCase of cases) {
      expect({
        word: testCase.word,
        mentioned: VOICE_CONSOLE_BACKEND_INSTRUCTIONS.includes(testCase.word),
      }).toEqual({ word: testCase.word, mentioned: true });
    }
  });

  it('states that writes go only through prepare_ and then confirm_pending_action, with cancel_pending_action for a refusal', () => {
    const prepareIndex = VOICE_CONSOLE_BACKEND_INSTRUCTIONS.indexOf('prepare_');
    const confirmIndex = VOICE_CONSOLE_BACKEND_INSTRUCTIONS.indexOf(
      'confirm_pending_action',
    );

    expect({
      hasCancel: VOICE_CONSOLE_BACKEND_INSTRUCTIONS.includes(
        'cancel_pending_action',
      ),
      prepareBeforeConfirm: prepareIndex >= 0 && prepareIndex < confirmIndex,
    }).toEqual({ hasCancel: true, prepareBeforeConfirm: true });
  });

  it('mentions the read-back and the はい rule that gates every write', () => {
    const cases = [{ word: 'readBack' }, { word: 'はい' }];

    for (const testCase of cases) {
      expect({
        word: testCase.word,
        mentioned: VOICE_CONSOLE_BACKEND_INSTRUCTIONS.includes(testCase.word),
      }).toEqual({ word: testCase.word, mentioned: true });
    }
  });

  it('names the read tools for task and URL questions', () => {
    const cases = [
      { word: 'current_task_detail' },
      { word: 'read_github_url' },
      { word: 'read_pull_request' },
      { word: 'read_repository_file' },
      { word: 'search_issues' },
    ];

    for (const testCase of cases) {
      expect({
        word: testCase.word,
        mentioned: VOICE_CONSOLE_BACKEND_INSTRUCTIONS.includes(testCase.word),
      }).toEqual({ word: testCase.word, mentioned: true });
    }
  });
});

describe('VOICE_CONSOLE_LIVE_INSTRUCTIONS', () => {
  it('is a non-empty voice-role text that tells GPT-Live to speak at the fastest clear pace', () => {
    expect({
      nonEmpty: VOICE_CONSOLE_LIVE_INSTRUCTIONS.length > 0,
      mentionsFastestPace:
        VOICE_CONSOLE_LIVE_INSTRUCTIONS.includes('最も速いペース'),
    }).toEqual({ nonEmpty: true, mentionsFastestPace: true });
  });

  it('tells GPT-Live to speak the backend results faithfully and to read decisions with their options in full', () => {
    const cases = [{ word: '結果' }, { word: '判断' }, { word: '選択肢' }];

    for (const testCase of cases) {
      expect({
        word: testCase.word,
        mentioned: VOICE_CONSOLE_LIVE_INSTRUCTIONS.includes(testCase.word),
      }).toEqual({ word: testCase.word, mentioned: true });
    }
  });

  it('names none of the voice tools, because tool selection belongs to the backend', () => {
    const named = VOICE_CONSOLE_TOOL_NAMES.filter((name) =>
      VOICE_CONSOLE_LIVE_INSTRUCTIONS.includes(name),
    );

    expect(named).toEqual([]);
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

  it('has the prepare_ tools including prepare_create_task and no prepare_ or confirm_ tool named like a read tool', () => {
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

describe('prepare_create_task definition', () => {
  it('declares a required title and the optional body, project_pjcode, repository and story arguments with no other properties', () => {
    const definition = VOICE_CONSOLE_TOOL_DEFINITIONS.find(
      (candidate) => candidate.name === 'prepare_create_task',
    );

    expect({
      found: definition !== undefined,
      required: definition?.parameters.required,
      additionalProperties: definition?.parameters.additionalProperties,
      propertyNames: Object.keys(
        definition?.parameters.properties ?? {},
      ).sort(),
    }).toEqual({
      found: true,
      required: ['title'],
      additionalProperties: false,
      propertyNames: ['body', 'project_pjcode', 'repository', 'story', 'title'],
    });
  });
});

describe('voice console live session wording', () => {
  it('names the queue tabs with the owner terms in the instructions and tool descriptions', () => {
    const spokenText = [
      VOICE_CONSOLE_LIVE_INSTRUCTIONS,
      VOICE_CONSOLE_BACKEND_INSTRUCTIONS,
      JSON.stringify(VOICE_CONSOLE_TOOL_DEFINITIONS),
    ].join('\n');

    expect({
      hasAwaitingOwner: spokenText.includes('Awaiting Owner'),
      hasTodoByHuman: spokenText.includes('Todo by human'),
      hasInternalPrsName: /prs/i.test(spokenText),
      hasInternalTabValue: spokenText.includes('todo-by-human'),
    }).toEqual({
      hasAwaitingOwner: true,
      hasTodoByHuman: true,
      hasInternalPrsName: false,
      hasInternalTabValue: false,
    });
  });
});

describe('VOICE_CONSOLE_TOOL_NAMES exact list', () => {
  it('is exactly the voice tool names that the backend is given', () => {
    expect([...VOICE_CONSOLE_TOOL_NAMES].sort()).toEqual(
      [...requiredToolNames].sort(),
    );
  });

  it('matches the names of VOICE_CONSOLE_TOOL_DEFINITIONS one to one', () => {
    expect(VOICE_CONSOLE_TOOL_NAMES).toEqual(
      VOICE_CONSOLE_TOOL_DEFINITIONS.map((definition) => definition.name),
    );
  });
});
