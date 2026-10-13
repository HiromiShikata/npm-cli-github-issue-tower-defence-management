import { extractNextStepAgentFromComments } from './extractNextStepAgentFromComments';

const trustEveryAuthor = (): boolean => true;
const trustBotOnly = (author: string): boolean => author === 'bot';

const reportFromAgentWithNextStepAgent = (
  postingAgent: string,
  nextStepAgent: string,
): string =>
  `From: :robot: ${postingAgent} (model)\n\`\`\`json\n{"nextStepAgent": "${nextStepAgent}"}\n\`\`\``;

const reportFromAgentWithoutNextStepAgent = (postingAgent: string): string =>
  `From: :robot: ${postingAgent} (model)\n\`\`\`json\n{"nextStep": null}\n\`\`\``;

type Case = {
  description: string;
  comments: { author: string; content: string }[];
  isTrustedAuthor: (author: string) => boolean;
  agentFieldValue: string | null;
  expected: string | null;
};

const cases: Case[] = [
  {
    description: 'null for no comments at all',
    comments: [],
    isTrustedAuthor: trustEveryAuthor,
    agentFieldValue: null,
    expected: null,
  },
  {
    description: 'the next step agent from the only qualifying report',
    comments: [
      {
        author: 'bot',
        content: reportFromAgentWithNextStepAgent('developer', 'pr-reviewer'),
      },
    ],
    isTrustedAuthor: trustEveryAuthor,
    agentFieldValue: null,
    expected: 'pr-reviewer',
  },
  {
    description:
      'null when the only qualifying report carries no nextStepAgent key',
    comments: [
      {
        author: 'bot',
        content: reportFromAgentWithoutNextStepAgent('developer'),
      },
    ],
    isTrustedAuthor: trustEveryAuthor,
    agentFieldValue: null,
    expected: null,
  },
  {
    description:
      "null when agentFieldValue does not match the only report's self-declared posting agent",
    comments: [
      {
        author: 'bot',
        content: reportFromAgentWithNextStepAgent('developer', 'pr-reviewer'),
      },
    ],
    isTrustedAuthor: trustEveryAuthor,
    agentFieldValue: 'pr-reviewer',
    expected: null,
  },
  {
    description:
      "the next step agent when agentFieldValue matches the only report's self-declared posting agent",
    comments: [
      {
        author: 'bot',
        content: reportFromAgentWithNextStepAgent('developer', 'pr-reviewer'),
      },
    ],
    isTrustedAuthor: trustEveryAuthor,
    agentFieldValue: 'developer',
    expected: 'pr-reviewer',
  },
  {
    description:
      'null when the only matching comment is posted by an untrusted author',
    comments: [
      {
        author: 'stranger',
        content: reportFromAgentWithNextStepAgent('developer', 'pr-reviewer'),
      },
    ],
    isTrustedAuthor: trustBotOnly,
    agentFieldValue: null,
    expected: null,
  },
  {
    description:
      "the earlier qualifying report's next step agent when the later comment carries no qualifying report",
    comments: [
      {
        author: 'bot',
        content: reportFromAgentWithNextStepAgent('developer', 'pr-reviewer'),
      },
      {
        author: 'bot',
        content:
          'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE\nReturned once.',
      },
    ],
    isTrustedAuthor: trustEveryAuthor,
    agentFieldValue: null,
    expected: 'pr-reviewer',
  },
];

describe('extractNextStepAgentFromComments', () => {
  it.each(cases)(
    'returns $description',
    ({ comments, isTrustedAuthor, agentFieldValue, expected }) => {
      expect(
        extractNextStepAgentFromComments(
          comments,
          isTrustedAuthor,
          agentFieldValue,
        ),
      ).toBe(expected);
    },
  );
});
