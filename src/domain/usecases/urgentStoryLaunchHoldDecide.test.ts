import {
  urgentStoryLaunchHoldDecide,
  UrgentStoryLaunchHoldBoardIssue,
  UrgentStoryLaunchHoldBoardProject,
  UrgentStoryLaunchHoldBoardState,
  UrgentStoryLaunchHoldDecideInput,
  UrgentStoryLaunchHoldDecision,
} from './urgentStoryLaunchHoldDecide';

const URGENT_STORY_NAME = 'urgent / production incident';
const SECOND_URGENT_STORY_NAME = 'urgent / customer escalation';
const REGULAR_STORY_NAME = 'regular / maintenance';
const MANAGER = 'manager-user';
const CALLER_ISSUE_URL = 'https://github.com/caller-org/caller-repo/issues/10';
const CALLER_PROJECT_URL = 'https://github.com/users/caller-org/projects/1';
const OTHER_PROJECT_URL = 'https://github.com/orgs/other-org/projects/2';
const THIRD_PROJECT_URL = 'https://github.com/orgs/third-org/projects/3';
const UNMATCHED_PROJECT_URL =
  'https://github.com/users/unknown-org/projects/99';
const UNRELATED_ISSUE_URL = 'https://github.com/unrelated-org/repo/issues/7';
const NOW = new Date('2026-10-01T03:00:00Z');

const callerProjectIssueUrl = (issueNumber: number): string =>
  `https://github.com/caller-org/caller-repo/issues/${issueNumber}`;
const otherProjectIssueUrl = (issueNumber: number): string =>
  `https://github.com/other-org/other-repo/issues/${issueNumber}`;
const thirdProjectIssueUrl = (issueNumber: number): string =>
  `https://github.com/third-org/third-repo/issues/${issueNumber}`;
const nullUrlProjectIssueUrl = (issueNumber: number): string =>
  `https://github.com/null-url-org/repo/issues/${issueNumber}`;

const boardIssueCreate = (
  overrides: Partial<UrgentStoryLaunchHoldBoardIssue> &
    Pick<UrgentStoryLaunchHoldBoardIssue, 'url'>,
): UrgentStoryLaunchHoldBoardIssue => ({
  story: URGENT_STORY_NAME,
  status: 'Awaiting Workspace',
  isClosed: false,
  dependedIssueUrls: [],
  nextActionDate: null,
  nextActionHour: null,
  assignees: [MANAGER],
  ...overrides,
});

const callerIssueCreate = (
  overrides: Partial<UrgentStoryLaunchHoldBoardIssue> = {},
): UrgentStoryLaunchHoldBoardIssue =>
  boardIssueCreate({
    url: CALLER_ISSUE_URL,
    story: REGULAR_STORY_NAME,
    ...overrides,
  });

const preparationIssueCreate = (
  url: string,
  overrides: Partial<UrgentStoryLaunchHoldBoardIssue> = {},
): UrgentStoryLaunchHoldBoardIssue =>
  boardIssueCreate({
    url,
    story: REGULAR_STORY_NAME,
    status: 'Preparation',
    ...overrides,
  });

const boardProjectCreate = (
  projectUrl: string | null,
  issues: UrgentStoryLaunchHoldBoardIssue[],
  readmeMaximumPreparingIssuesCount: number | null = null,
): UrgentStoryLaunchHoldBoardProject => ({
  projectUrl,
  issues,
  readmeMaximumPreparingIssuesCount,
});

const callerProject = (
  callerIssue: UrgentStoryLaunchHoldBoardIssue = callerIssueCreate(),
): UrgentStoryLaunchHoldBoardProject =>
  boardProjectCreate(CALLER_PROJECT_URL, [callerIssue]);

const decideInputCreate = ({
  boardState,
  ...overrides
}: Partial<Omit<UrgentStoryLaunchHoldDecideInput, 'boardState'>> & {
  boardState: Partial<UrgentStoryLaunchHoldBoardState> &
    Pick<UrgentStoryLaunchHoldBoardState, 'projects'>;
}): UrgentStoryLaunchHoldDecideInput => ({
  urgentStoryNames: [URGENT_STORY_NAME, SECOND_URGENT_STORY_NAME],
  callerIssueUrl: CALLER_ISSUE_URL,
  configuredProjectUrl: CALLER_PROJECT_URL,
  manager: MANAGER,
  freeSlotCount: 0,
  now: NOW,
  ...overrides,
  boardState: {
    runningIssueUrls: [],
    heldProjectUrls: [],
    timedOutIssueUrls: [],
    ...boardState,
  },
});

const holdWithRegularCaller = (
  waitingUrgentIssueUrls: string[],
  freeSlotCount = 0,
): UrgentStoryLaunchHoldDecision => ({
  kind: 'hold',
  callerProjectUrl: CALLER_PROJECT_URL,
  callerStory: REGULAR_STORY_NAME,
  freeSlotCount,
  waitingUrgentIssueUrls,
});

const noUrgentTaskWaitingWithRegularCaller: UrgentStoryLaunchHoldDecision = {
  kind: 'noUrgentTaskWaiting',
  callerProjectUrl: CALLER_PROJECT_URL,
  callerStory: REGULAR_STORY_NAME,
};

const singleCandidateInput = (
  candidateOverrides: Partial<UrgentStoryLaunchHoldBoardIssue>,
  inputOverrides: Partial<
    Omit<UrgentStoryLaunchHoldDecideInput, 'boardState'>
  > &
    Partial<Omit<UrgentStoryLaunchHoldBoardState, 'projects'>> = {},
): UrgentStoryLaunchHoldDecideInput => {
  const { runningIssueUrls, heldProjectUrls, timedOutIssueUrls, ...rest } =
    inputOverrides;
  return decideInputCreate({
    ...rest,
    boardState: {
      projects: [
        callerProject(),
        boardProjectCreate(OTHER_PROJECT_URL, [
          boardIssueCreate({
            url: otherProjectIssueUrl(1),
            ...candidateOverrides,
          }),
        ]),
      ],
      runningIssueUrls: runningIssueUrls ?? [],
      heldProjectUrls: heldProjectUrls ?? [],
      timedOutIssueUrls: timedOutIssueUrls ?? [],
    },
  });
};

const twoWaitingTasksInput = (
  freeSlotCount: number | null,
): UrgentStoryLaunchHoldDecideInput =>
  decideInputCreate({
    freeSlotCount,
    boardState: {
      projects: [
        callerProject(),
        boardProjectCreate(OTHER_PROJECT_URL, [
          boardIssueCreate({ url: otherProjectIssueUrl(1) }),
          boardIssueCreate({ url: otherProjectIssueUrl(2) }),
        ]),
      ],
    },
  });

const dependingTaskInput = (
  dependingTaskOverrides: Partial<UrgentStoryLaunchHoldBoardIssue>,
): UrgentStoryLaunchHoldDecideInput =>
  decideInputCreate({
    boardState: {
      projects: [
        callerProject(),
        boardProjectCreate(OTHER_PROJECT_URL, [
          boardIssueCreate({
            url: otherProjectIssueUrl(5),
            dependedIssueUrls: [CALLER_ISSUE_URL],
            ...dependingTaskOverrides,
          }),
        ]),
        boardProjectCreate(THIRD_PROJECT_URL, [
          boardIssueCreate({ url: thirdProjectIssueUrl(1) }),
        ]),
      ],
    },
  });

const callerResolutionBoardProjects = (
  callerIssueProjectUrl: string | null,
): UrgentStoryLaunchHoldBoardProject[] => [
  boardProjectCreate(CALLER_PROJECT_URL, [
    boardIssueCreate({ url: callerProjectIssueUrl(1) }),
    ...(callerIssueProjectUrl === CALLER_PROJECT_URL
      ? [callerIssueCreate()]
      : []),
  ]),
  boardProjectCreate(OTHER_PROJECT_URL, [
    boardIssueCreate({ url: otherProjectIssueUrl(1) }),
    ...(callerIssueProjectUrl === OTHER_PROJECT_URL
      ? [callerIssueCreate()]
      : []),
  ]),
];

describe('urgentStoryLaunchHoldDecide', () => {
  it.each<{
    label: string;
    input: UrgentStoryLaunchHoldDecideInput;
    expectedDecision: UrgentStoryLaunchHoldDecision;
  }>([
    {
      label:
        'returns callerStoryIsUrgent when the caller story is urgent even with urgent tasks waiting and no free slot',
      input: decideInputCreate({
        freeSlotCount: 0,
        boardState: {
          projects: [
            callerProject(callerIssueCreate({ story: URGENT_STORY_NAME })),
            boardProjectCreate(OTHER_PROJECT_URL, [
              boardIssueCreate({ url: otherProjectIssueUrl(1) }),
              boardIssueCreate({ url: otherProjectIssueUrl(2) }),
            ]),
          ],
        },
      }),
      expectedDecision: {
        kind: 'callerStoryIsUrgent',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: URGENT_STORY_NAME,
      },
    },
    {
      label:
        'returns callerStoryIsUrgent when the caller story equals the second configured urgent story name',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(
              callerIssueCreate({ story: SECOND_URGENT_STORY_NAME }),
            ),
            boardProjectCreate(OTHER_PROJECT_URL, [
              boardIssueCreate({ url: otherProjectIssueUrl(1) }),
            ]),
          ],
        },
      }),
      expectedDecision: {
        kind: 'callerStoryIsUrgent',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: SECOND_URGENT_STORY_NAME,
      },
    },
    {
      label:
        'returns callerStoryIsUrgent ahead of an urgent task that depends on the caller',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(callerIssueCreate({ story: URGENT_STORY_NAME })),
            boardProjectCreate(OTHER_PROJECT_URL, [
              boardIssueCreate({
                url: otherProjectIssueUrl(5),
                dependedIssueUrls: [CALLER_ISSUE_URL],
              }),
            ]),
          ],
        },
      }),
      expectedDecision: {
        kind: 'callerStoryIsUrgent',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: URGENT_STORY_NAME,
      },
    },
    {
      label:
        'does not treat a caller story that only begins with an urgent story name as urgent',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(
              callerIssueCreate({
                story: `${URGENT_STORY_NAME} follow-up`,
              }),
            ),
            boardProjectCreate(OTHER_PROJECT_URL, [
              boardIssueCreate({ url: otherProjectIssueUrl(1) }),
            ]),
          ],
        },
      }),
      expectedDecision: {
        kind: 'hold',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: `${URGENT_STORY_NAME} follow-up`,
        freeSlotCount: 0,
        waitingUrgentIssueUrls: [otherProjectIssueUrl(1)],
      },
    },
    {
      label:
        'returns urgentTaskDependsOnCaller with the depending issue when an urgent task of another project in Awaiting Workspace depends on the caller',
      input: dependingTaskInput({}),
      expectedDecision: {
        kind: 'urgentTaskDependsOnCaller',
        dependingUrgentIssueUrl: otherProjectIssueUrl(5),
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
      },
    },
    {
      label:
        'returns urgentTaskDependsOnCaller when the depending urgent task lists the caller among several depended issues',
      input: dependingTaskInput({
        dependedIssueUrls: [UNRELATED_ISSUE_URL, CALLER_ISSUE_URL],
      }),
      expectedDecision: {
        kind: 'urgentTaskDependsOnCaller',
        dependingUrgentIssueUrl: otherProjectIssueUrl(5),
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
      },
    },
    {
      label:
        'returns urgentTaskDependsOnCaller when the depending urgent task belongs to the caller project',
      input: decideInputCreate({
        boardState: {
          projects: [
            boardProjectCreate(CALLER_PROJECT_URL, [
              callerIssueCreate(),
              boardIssueCreate({
                url: callerProjectIssueUrl(11),
                dependedIssueUrls: [CALLER_ISSUE_URL],
              }),
            ]),
            boardProjectCreate(OTHER_PROJECT_URL, [
              boardIssueCreate({ url: otherProjectIssueUrl(1) }),
            ]),
          ],
        },
      }),
      expectedDecision: {
        kind: 'urgentTaskDependsOnCaller',
        dependingUrgentIssueUrl: callerProjectIssueUrl(11),
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
      },
    },
    {
      label:
        'does not return urgentTaskDependsOnCaller when the depending urgent task is closed',
      input: dependingTaskInput({ isClosed: true }),
      expectedDecision: holdWithRegularCaller([thirdProjectIssueUrl(1)]),
    },
    {
      label:
        'does not return urgentTaskDependsOnCaller when the depending urgent task is not in Awaiting Workspace',
      input: dependingTaskInput({ status: 'Preparation' }),
      expectedDecision: holdWithRegularCaller([thirdProjectIssueUrl(1)]),
    },
    {
      label:
        'does not return urgentTaskDependsOnCaller when the depending task story is not urgent',
      input: dependingTaskInput({ story: REGULAR_STORY_NAME }),
      expectedDecision: holdWithRegularCaller([thirdProjectIssueUrl(1)]),
    },
    {
      label:
        'does not return urgentTaskDependsOnCaller when the urgent task depends only on a different issue',
      input: dependingTaskInput({ dependedIssueUrls: [UNRELATED_ISSUE_URL] }),
      expectedDecision: holdWithRegularCaller([thirdProjectIssueUrl(1)]),
    },
    {
      label:
        'counts an urgent task of another project in Awaiting Workspace that meets every condition as waiting',
      input: singleCandidateInput({}),
      expectedDecision: holdWithRegularCaller([otherProjectIssueUrl(1)]),
    },
    {
      label: 'does not count an urgent task of the caller project as waiting',
      input: decideInputCreate({
        boardState: {
          projects: [
            boardProjectCreate(CALLER_PROJECT_URL, [
              callerIssueCreate(),
              boardIssueCreate({ url: callerProjectIssueUrl(11) }),
            ]),
            boardProjectCreate(OTHER_PROJECT_URL, []),
          ],
        },
      }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'does not count an urgent task of a project that has a live holding record',
      input: singleCandidateInput({}, { heldProjectUrls: [OTHER_PROJECT_URL] }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label: 'does not count an urgent task that is not in Awaiting Workspace',
      input: singleCandidateInput({ status: 'Preparation' }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label: 'does not count a closed urgent task',
      input: singleCandidateInput({ isClosed: true }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label: 'does not count a task whose story is not urgent',
      input: singleCandidateInput({ story: REGULAR_STORY_NAME }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label: 'does not count a task without a story',
      input: singleCandidateInput({ story: null }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label: 'does not count an urgent task that depends on another issue',
      input: singleCandidateInput({ dependedIssueUrls: [UNRELATED_ISSUE_URL] }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label: 'does not count an urgent task whose next action date is tomorrow',
      input: singleCandidateInput({
        nextActionDate: new Date('2026-10-02T00:00:00Z'),
      }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'does not count an urgent task whose next action hour has not been reached',
      input: singleCandidateInput({ nextActionHour: 5 }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'counts an urgent task whose next action date is today and whose next action hour has passed',
      input: singleCandidateInput({
        nextActionDate: new Date('2026-10-01T00:00:00Z'),
        nextActionHour: 2,
      }),
      expectedDecision: holdWithRegularCaller([otherProjectIssueUrl(1)]),
    },
    {
      label: 'does not count an urgent task not assigned to the manager',
      input: singleCandidateInput({ assignees: ['someone-else'] }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'counts an urgent task assigned to anyone when the manager is null',
      input: singleCandidateInput(
        { assignees: ['someone-else'] },
        { manager: null },
      ),
      expectedDecision: holdWithRegularCaller([otherProjectIssueUrl(1)]),
    },
    {
      label: 'does not count an urgent task whose worker is already running',
      input: singleCandidateInput(
        {},
        { runningIssueUrls: [otherProjectIssueUrl(1)] },
      ),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label: 'does not count an urgent task recorded as timed out',
      input: singleCandidateInput(
        {},
        { timedOutIssueUrls: [otherProjectIssueUrl(1)] },
      ),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'counts no urgent task of a project whose non-closed Preparation issues already reach its README maximum',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(
              OTHER_PROJECT_URL,
              [
                preparationIssueCreate(otherProjectIssueUrl(50)),
                preparationIssueCreate(otherProjectIssueUrl(51)),
                boardIssueCreate({ url: otherProjectIssueUrl(1) }),
              ],
              2,
            ),
          ],
        },
      }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'counts no urgent task of a project whose non-closed Preparation issues exceed its README maximum',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(
              OTHER_PROJECT_URL,
              [
                preparationIssueCreate(otherProjectIssueUrl(50)),
                preparationIssueCreate(otherProjectIssueUrl(51)),
                preparationIssueCreate(otherProjectIssueUrl(52)),
                boardIssueCreate({ url: otherProjectIssueUrl(1) }),
              ],
              1,
            ),
          ],
        },
      }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'keeps the first README maximum minus non-closed Preparation count urgent tasks of a project',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(
              OTHER_PROJECT_URL,
              [
                boardIssueCreate({ url: otherProjectIssueUrl(1) }),
                preparationIssueCreate(otherProjectIssueUrl(50)),
                boardIssueCreate({ url: otherProjectIssueUrl(2) }),
                boardIssueCreate({ url: otherProjectIssueUrl(3) }),
              ],
              3,
            ),
          ],
        },
      }),
      expectedDecision: holdWithRegularCaller([
        otherProjectIssueUrl(1),
        otherProjectIssueUrl(2),
      ]),
    },
    {
      label:
        'does not count a closed Preparation issue against the README maximum',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(
              OTHER_PROJECT_URL,
              [
                preparationIssueCreate(otherProjectIssueUrl(50)),
                preparationIssueCreate(otherProjectIssueUrl(51), {
                  isClosed: true,
                }),
                boardIssueCreate({ url: otherProjectIssueUrl(1) }),
                boardIssueCreate({ url: otherProjectIssueUrl(2) }),
              ],
              2,
            ),
          ],
        },
      }),
      expectedDecision: holdWithRegularCaller([otherProjectIssueUrl(1)]),
    },
    {
      label: 'keeps every urgent task of a project whose README has no maximum',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(
              OTHER_PROJECT_URL,
              [
                preparationIssueCreate(otherProjectIssueUrl(50)),
                preparationIssueCreate(otherProjectIssueUrl(51)),
                boardIssueCreate({ url: otherProjectIssueUrl(1) }),
                boardIssueCreate({ url: otherProjectIssueUrl(2) }),
                boardIssueCreate({ url: otherProjectIssueUrl(3) }),
              ],
              null,
            ),
          ],
        },
      }),
      expectedDecision: holdWithRegularCaller([
        otherProjectIssueUrl(1),
        otherProjectIssueUrl(2),
        otherProjectIssueUrl(3),
      ]),
    },
    {
      label:
        'applies the README maximum to the urgent tasks left after the other exclusions',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(
              OTHER_PROJECT_URL,
              [
                boardIssueCreate({ url: otherProjectIssueUrl(1) }),
                boardIssueCreate({ url: otherProjectIssueUrl(2) }),
              ],
              1,
            ),
          ],
          runningIssueUrls: [otherProjectIssueUrl(1)],
        },
      }),
      expectedDecision: holdWithRegularCaller([otherProjectIssueUrl(2)]),
    },
    {
      label: 'applies the README maximum of each project separately',
      input: decideInputCreate({
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(
              OTHER_PROJECT_URL,
              [
                boardIssueCreate({ url: otherProjectIssueUrl(1) }),
                boardIssueCreate({ url: otherProjectIssueUrl(2) }),
              ],
              1,
            ),
            boardProjectCreate(
              THIRD_PROJECT_URL,
              [
                boardIssueCreate({ url: thirdProjectIssueUrl(1) }),
                boardIssueCreate({ url: thirdProjectIssueUrl(2) }),
              ],
              null,
            ),
          ],
        },
      }),
      expectedDecision: holdWithRegularCaller([
        otherProjectIssueUrl(1),
        thirdProjectIssueUrl(1),
        thirdProjectIssueUrl(2),
      ]),
    },
    {
      label:
        'returns noUrgentTaskWaiting when nothing is waiting and no slot is free',
      input: decideInputCreate({
        freeSlotCount: 0,
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(OTHER_PROJECT_URL, []),
          ],
        },
      }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'returns noUrgentTaskWaiting when nothing is waiting and the free slot count is unknown',
      input: decideInputCreate({
        freeSlotCount: null,
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(OTHER_PROJECT_URL, []),
          ],
        },
      }),
      expectedDecision: noUrgentTaskWaitingWithRegularCaller,
    },
    {
      label:
        'returns freeSlotCountUnknown when urgent tasks wait and the free slot count is null',
      input: twoWaitingTasksInput(null),
      expectedDecision: {
        kind: 'freeSlotCountUnknown',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
      },
    },
    {
      label:
        'returns freeSlotCountUnknown when urgent tasks wait and the free slot count is not a number',
      input: twoWaitingTasksInput(Number.NaN),
      expectedDecision: {
        kind: 'freeSlotCountUnknown',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
      },
    },
    {
      label:
        'returns freeSlotCountUnknown when urgent tasks wait and the free slot count is infinite',
      input: twoWaitingTasksInput(Number.POSITIVE_INFINITY),
      expectedDecision: {
        kind: 'freeSlotCountUnknown',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
      },
    },
    {
      label:
        'returns freeSlotsExceedWaitingUrgentTasks when the free slots outnumber the waiting urgent tasks',
      input: twoWaitingTasksInput(3),
      expectedDecision: {
        kind: 'freeSlotsExceedWaitingUrgentTasks',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
        freeSlotCount: 3,
        waitingUrgentIssueUrls: [
          otherProjectIssueUrl(1),
          otherProjectIssueUrl(2),
        ],
      },
    },
    {
      label: 'returns hold when the free slots equal the waiting urgent tasks',
      input: twoWaitingTasksInput(2),
      expectedDecision: holdWithRegularCaller(
        [otherProjectIssueUrl(1), otherProjectIssueUrl(2)],
        2,
      ),
    },
    {
      label:
        'returns hold when the free slots are fewer than the waiting urgent tasks',
      input: twoWaitingTasksInput(1),
      expectedDecision: holdWithRegularCaller(
        [otherProjectIssueUrl(1), otherProjectIssueUrl(2)],
        1,
      ),
    },
    {
      label:
        'takes the project whose URL equals the configured project URL as the caller project even when the caller issue is cached in another project',
      input: decideInputCreate({
        configuredProjectUrl: CALLER_PROJECT_URL,
        boardState: {
          projects: callerResolutionBoardProjects(OTHER_PROJECT_URL),
        },
      }),
      expectedDecision: {
        kind: 'hold',
        callerProjectUrl: CALLER_PROJECT_URL,
        callerStory: null,
        freeSlotCount: 0,
        waitingUrgentIssueUrls: [otherProjectIssueUrl(1)],
      },
    },
    {
      label:
        'takes the project containing the caller issue as the caller project when no project URL equals the configured project URL',
      input: decideInputCreate({
        configuredProjectUrl: UNMATCHED_PROJECT_URL,
        boardState: {
          projects: callerResolutionBoardProjects(OTHER_PROJECT_URL),
        },
      }),
      expectedDecision: {
        kind: 'hold',
        callerProjectUrl: OTHER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
        freeSlotCount: 0,
        waitingUrgentIssueUrls: [callerProjectIssueUrl(1)],
      },
    },
    {
      label:
        'takes the project containing the caller issue as the caller project when no project URL is configured',
      input: decideInputCreate({
        configuredProjectUrl: null,
        boardState: {
          projects: callerResolutionBoardProjects(OTHER_PROJECT_URL),
        },
      }),
      expectedDecision: {
        kind: 'hold',
        callerProjectUrl: OTHER_PROJECT_URL,
        callerStory: REGULAR_STORY_NAME,
        freeSlotCount: 0,
        waitingUrgentIssueUrls: [callerProjectIssueUrl(1)],
      },
    },
    {
      label:
        'excludes no project as the caller project when neither the configured project URL nor the caller issue is found',
      input: decideInputCreate({
        configuredProjectUrl: UNMATCHED_PROJECT_URL,
        boardState: {
          projects: callerResolutionBoardProjects(null),
        },
      }),
      expectedDecision: {
        kind: 'hold',
        callerProjectUrl: null,
        callerStory: null,
        freeSlotCount: 0,
        waitingUrgentIssueUrls: [
          callerProjectIssueUrl(1),
          otherProjectIssueUrl(1),
        ],
      },
    },
    {
      label:
        'excludes the urgent tasks of a project without a URL when there is no caller project, because its URL equals the null caller project URL',
      input: decideInputCreate({
        configuredProjectUrl: UNMATCHED_PROJECT_URL,
        boardState: {
          projects: [
            boardProjectCreate(OTHER_PROJECT_URL, [
              boardIssueCreate({ url: otherProjectIssueUrl(1) }),
            ]),
            boardProjectCreate(null, [
              boardIssueCreate({ url: nullUrlProjectIssueUrl(1) }),
            ]),
          ],
        },
      }),
      expectedDecision: {
        kind: 'hold',
        callerProjectUrl: null,
        callerStory: null,
        freeSlotCount: 0,
        waitingUrgentIssueUrls: [otherProjectIssueUrl(1)],
      },
    },
    {
      label:
        'counts the urgent tasks of a project without a URL when the caller project has a URL',
      input: decideInputCreate({
        configuredProjectUrl: CALLER_PROJECT_URL,
        boardState: {
          projects: [
            callerProject(),
            boardProjectCreate(OTHER_PROJECT_URL, [
              boardIssueCreate({ url: otherProjectIssueUrl(1) }),
            ]),
            boardProjectCreate(null, [
              boardIssueCreate({ url: nullUrlProjectIssueUrl(1) }),
            ]),
          ],
        },
      }),
      expectedDecision: holdWithRegularCaller([
        otherProjectIssueUrl(1),
        nullUrlProjectIssueUrl(1),
      ]),
    },
    {
      label:
        'takes the first project without a URL as the caller project when no project URL is configured, ahead of the project containing the caller issue',
      input: decideInputCreate({
        configuredProjectUrl: null,
        boardState: {
          projects: [
            boardProjectCreate(null, [
              boardIssueCreate({ url: nullUrlProjectIssueUrl(1) }),
            ]),
            ...callerResolutionBoardProjects(CALLER_PROJECT_URL),
          ],
        },
      }),
      expectedDecision: {
        kind: 'hold',
        callerProjectUrl: null,
        callerStory: null,
        freeSlotCount: 0,
        waitingUrgentIssueUrls: [
          callerProjectIssueUrl(1),
          otherProjectIssueUrl(1),
        ],
      },
    },
  ])('$label', ({ input, expectedDecision }) => {
    expect(urgentStoryLaunchHoldDecide(input)).toEqual(expectedDecision);
  });
});
