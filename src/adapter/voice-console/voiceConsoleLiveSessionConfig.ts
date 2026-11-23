export type VoiceConsoleToolParameters = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export type VoiceConsoleToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: VoiceConsoleToolParameters;
};

const NO_PARAMETERS: VoiceConsoleToolParameters = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const PAGE_PROPERTY = {
  type: 'integer',
  description:
    'Page number, starting at 1. Omit it to read page 1. Long text is split into pages of 3000 characters.',
};

const STRING_PROPERTY = (description: string): Record<string, unknown> => ({
  type: 'string',
  description,
});

const CLOSE_REASONS = ['completed', 'not_planned'];
const CLOSE_COMMENT_KINDS = ['none', 'ok', 'text'];
const SNOOZE_PRESETS = [
  '1h',
  '3h',
  '6h',
  '1d',
  '2d',
  '3d',
  '5d',
  '1w',
  '1month',
];
const PULL_REQUEST_REVIEW_ACTIONS = [
  'approve_and_merge',
  'request_changes',
  'unnecessary',
  'totally_wrong',
];

export const VOICE_CONSOLE_INSTRUCTIONS = [
  'あなたはオーナーの音声アシスタントです。オーナーは作業中の GitHub の Issue と Pull Request を、キューの先頭から順に声で確認します。',
  '最初の挨拶では queue_overview を呼び、未処理の todo-by-human と prs の件数を伝えてください。',
  '各タスクでは、current_task_summary を呼び、タイトルと最新の報告の要約を読み上げてください。',
  'オーナーが「もう一度」と言ったら repeat_current_task を呼び、同じタスクの最新の報告の要約を最初のページから読み直してください。位置は動かしません。',
  '最新の報告の要約を読むときは、要約に含まれる判断（オーナーに決めてもらう質問）を、その選択肢（選択肢）とあわせて必ず読み上げてください。判断や選択肢を省略したり、要約に丸めたりしてはいけません。',
  'オーナーが「詳しく」と言ったら current_task_detail を呼び、本文とコメントを、ページごとに続けて読んでください。ページが残っている場合は page を増やして読み続けてください。',
  'タスクや GitHub の URL に関する質問には、必ず読み取りツール（current_task_detail、read_github_url、read_pull_request、read_repository_file、search_issues）を呼んで答えてください。推測で答えてはいけません。',
  '書き込みは必ず二段階で行います。prepare_ で始まるツールを呼んだら、返された readBack の内容をオーナーに読み上げ、オーナーが「はい」と答えた後にだけ confirm_pending_action を呼んでください。オーナーが「はい」以外を答えたら cancel_pending_action を呼んでください。',
  'コメントの本文は、オーナーが口述した文章を一字一句そのまま使ってください。言い換えたり要約したりしてはいけません。',
  '移動は next_task（次のタスク）、previous_task（前のタスク）、jump_to_task（番号指定）で行います。end_of_queue や start_of_queue が返ったら、その旨をオーナーに伝えてください。',
  'ツールがエラーを返したら、そのエラーの内容をオーナーに伝えてください。エラーを隠したり、成功したと言ったりしてはいけません。',
].join('\n');

export const VOICE_CONSOLE_TOOL_DEFINITIONS: VoiceConsoleToolDefinition[] = [
  {
    type: 'function',
    name: 'queue_overview',
    description:
      'Reload the queue from the console data and return the counts of todo-by-human items, prs items and the total, the projects, and the current task position.',
    parameters: NO_PARAMETERS,
  },
  {
    type: 'function',
    name: 'current_task_summary',
    description:
      'Return the latest robot report summary of the current task, read from the task issue comments. Paginated.',
    parameters: {
      type: 'object',
      properties: { page: PAGE_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'repeat_current_task',
    description:
      'Repeat the latest robot report summary of the current task from page 1, the same output as current_task_summary. Does not move the queue position.',
    parameters: {
      type: 'object',
      properties: { page: PAGE_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'current_task_detail',
    description:
      'Return the full text of the current task: title, status, story, labels, dependencies, the issue body and all comments. Paginated.',
    parameters: {
      type: 'object',
      properties: { page: PAGE_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'read_github_url',
    description:
      'Return the body and all comments of a GitHub issue or pull request URL. Paginated.',
    parameters: {
      type: 'object',
      properties: {
        url: STRING_PROPERTY('GitHub issue or pull request URL.'),
        page: PAGE_PROPERTY,
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'read_pull_request',
    description:
      'Return a pull request summary: state, branches, the changed files, the commits and the CI status. Omit url to use the current task when it is a pull request. Paginated.',
    parameters: {
      type: 'object',
      properties: {
        url: STRING_PROPERTY('GitHub pull request URL. Optional.'),
        page: PAGE_PROPERTY,
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'read_repository_file',
    description:
      'Return the text of a file from a GitHub blob URL, for example https://github.com/owner/repo/blob/main/path. Paginated.',
    parameters: {
      type: 'object',
      properties: {
        url: STRING_PROPERTY('GitHub blob URL of the file.'),
        page: PAGE_PROPERTY,
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'search_issues',
    description:
      'Search GitHub issues and pull requests with a GitHub search query. A query without a user, org or repo qualifier is limited to the owner account. Paginated.',
    parameters: {
      type: 'object',
      properties: {
        query: STRING_PROPERTY('GitHub issue search query.'),
        page: PAGE_PROPERTY,
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'next_task',
    description: 'Move to the next task in the queue and return it.',
    parameters: NO_PARAMETERS,
  },
  {
    type: 'function',
    name: 'previous_task',
    description: 'Move to the previous task in the queue and return it.',
    parameters: NO_PARAMETERS,
  },
  {
    type: 'function',
    name: 'jump_to_task',
    description:
      'Move to the task at a 1-based position in the queue and return it.',
    parameters: {
      type: 'object',
      properties: {
        position: { type: 'integer', description: '1-based queue position.' },
      },
      required: ['position'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_ok',
    description:
      'Prepare, without executing, setting the current task to Awaiting Workspace with the comment ok. Requires confirm_pending_action after the owner says yes.',
    parameters: NO_PARAMETERS,
  },
  {
    type: 'function',
    name: 'prepare_comment_and_move_to_awaiting_workspace',
    description:
      'Prepare, without executing, posting the dictated comment on the current task and moving it to Awaiting Workspace. Requires confirm_pending_action after the owner says yes.',
    parameters: {
      type: 'object',
      properties: {
        comment_text: STRING_PROPERTY('Comment text, exactly as dictated.'),
      },
      required: ['comment_text'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_comment_only',
    description:
      'Prepare, without executing, posting the dictated comment on the current task and keeping its status. Requires confirm_pending_action after the owner says yes.',
    parameters: {
      type: 'object',
      properties: {
        comment_text: STRING_PROPERTY('Comment text, exactly as dictated.'),
      },
      required: ['comment_text'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_close',
    description:
      'Prepare, without executing, closing the current task as completed or not_planned, with an optional comment. Requires confirm_pending_action after the owner says yes.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: CLOSE_REASONS,
          description: 'completed or not_planned.',
        },
        comment_kind: {
          type: 'string',
          enum: CLOSE_COMMENT_KINDS,
          description:
            'none for no comment, ok for the comment ok, text for the comment_text.',
        },
        comment_text: STRING_PROPERTY(
          'Comment text, required when comment_kind is text.',
        ),
      },
      required: ['reason', 'comment_kind'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_snooze',
    description:
      'Prepare, without executing, snoozing the current task for a preset duration. Requires confirm_pending_action after the owner says yes.',
    parameters: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          enum: SNOOZE_PRESETS,
          description:
            'Snooze duration: 1h, 3h, 6h, 1d, 2d, 3d, 5d, 1w or 1month.',
        },
      },
      required: ['preset'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_set_status',
    description:
      'Prepare, without executing, moving the current task to a status option of its project. Requires confirm_pending_action after the owner says yes.',
    parameters: {
      type: 'object',
      properties: {
        status_name: STRING_PROPERTY(
          'Exact name of a status option of the project.',
        ),
      },
      required: ['status_name'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_move_to_in_tmux_by_human',
    description:
      'Prepare, without executing, moving the current task to In tmux by human. Requires confirm_pending_action after the owner says yes.',
    parameters: NO_PARAMETERS,
  },
  {
    type: 'function',
    name: 'prepare_pull_request_review',
    description:
      'Prepare, without executing, a review action on the current pull request or the pull request related to the current issue: approve_and_merge, request_changes (needs comment_text), unnecessary or totally_wrong. Requires confirm_pending_action after the owner says yes.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: PULL_REQUEST_REVIEW_ACTIONS,
          description: 'The review action.',
        },
        comment_text: STRING_PROPERTY(
          'Comment text, exactly as dictated. Required for request_changes.',
        ),
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'confirm_pending_action',
    description:
      'Execute the prepared action with this action_id, only after the owner replied yes (はい). Returns an error when there is no matching prepared action.',
    parameters: {
      type: 'object',
      properties: {
        action_id: STRING_PROPERTY(
          'The actionId returned by the prepare tool.',
        ),
        owner_reply: STRING_PROPERTY('The owner reply, verbatim.'),
      },
      required: ['action_id', 'owner_reply'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'cancel_pending_action',
    description:
      'Discard the prepared action without executing it, for example when the owner does not confirm.',
    parameters: NO_PARAMETERS,
  },
];

export const VOICE_CONSOLE_TOOL_NAMES: string[] =
  VOICE_CONSOLE_TOOL_DEFINITIONS.map((definition) => definition.name);
