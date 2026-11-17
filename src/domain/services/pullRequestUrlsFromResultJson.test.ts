import { pullRequestUrlsFromCommentBodies } from './pullRequestUrlsFromResultJson';

const PR_URL = 'https://github.com/example-owner/example-tasks/pull/12';
const OTHER_PR_URL = 'https://github.com/example-owner/other-repo/pull/7';

const fenced = (json: string): string => ['```json', json, '```'].join('\n');

describe('pullRequestUrlsFromCommentBodies', () => {
  test.each([
    {
      case: 'a pullRequestUrl inside the fenced JSON result block is read',
      bodies: [fenced(`{"pullRequestUrl": "${PR_URL}"}`)],
      expected: [PR_URL],
    },
    {
      case: 'a pullRequestUrl inside a jsonl fence is ignored',
      bodies: [`\`\`\`jsonl\n{"pullRequestUrl": "${PR_URL}"}\n\`\`\``],
      expected: [],
    },
    {
      case: 'a pullRequestUrl inside a json5 fence is ignored',
      bodies: [`\`\`\`json5\n{"pullRequestUrl": "${PR_URL}"}\n\`\`\``],
      expected: [],
    },
    {
      case: 'a pullRequestUrl inside a javascript fence is ignored',
      bodies: [`\`\`\`javascript\n{"pullRequestUrl": "${PR_URL}"}\n\`\`\``],
      expected: [],
    },
    {
      case: 'a null pullRequestUrl is ignored',
      bodies: [fenced('{"pullRequestUrl": null}')],
      expected: [],
    },
    {
      case: 'a pullRequestUrl written in prose outside a fenced block is ignored',
      bodies: [`The PR is "pullRequestUrl": "${PR_URL}" in prose.`],
      expected: [],
    },
    {
      case: 'a URL that is an issue rather than a pull request is ignored',
      bodies: [
        fenced(
          '{"pullRequestUrl": "https://github.com/example-owner/example-tasks/issues/3"}',
        ),
      ],
      expected: [],
    },
    {
      case: 'the same URL in several comments is returned once, in first-seen order',
      bodies: [
        fenced(`{"pullRequestUrl": "${PR_URL}"}`),
        fenced(`{"pullRequestUrl": "${OTHER_PR_URL}"}`),
        fenced(`{"pullRequestUrl": "${PR_URL}"}`),
      ],
      expected: [PR_URL, OTHER_PR_URL],
    },
    {
      case: 'a pullRequestUrl inside a fenced block that is not labelled json is ignored',
      bodies: [`\`\`\`text\n{"pullRequestUrl": "${PR_URL}"}\n\`\`\``],
      expected: [],
    },
    {
      case: 'a comment without any fenced block yields nothing',
      bodies: ['From: :robot: developer (model)\nplain text'],
      expected: [],
    },
  ])('$case', ({ bodies, expected }) => {
    expect(pullRequestUrlsFromCommentBodies(bodies)).toEqual(expected);
  });
});
