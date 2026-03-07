import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { Project, StoryOption } from '../entities/Project';
import { Issue } from '../entities/Issue';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';

describe('ConvertCheckboxToIssueInStoryIssueUseCase', () => {
  jest.setTimeout(5 * 60 * 1000);
  const mockIssueRepository = mock<IssueRepository>();

  describe('run', () => {
    const basicStory = {
      name: 'Story Field',
      databaseId: 1,
      fieldId: 'storyFieldId',
      stories: [
        { ...mock<StoryOption>(), id: 'story1', name: 'Story 1' },
        { ...mock<StoryOption>(), id: 'story2', name: 'Story 2' },
        { ...mock<StoryOption>(), id: 'regular3', name: 'regular / Story 3' },
      ],
      workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
    };
    const basicProject: Project = {
      ...mock<Project>(),
      story: basicStory,
    };

    const basicStoryIssue1 = {
      ...mock<Issue>(),
      title: 'Story 1',
      number: 123,
      body: `- [ ] Task 1
- [ ] Task 2`,
      url: 'https://github.com/org/repo/issues/123',
      org: 'org',
      repo: 'repo',
    };

    const basicStoryIssue2 = {
      ...mock<Issue>(),
      title: 'Story 2',
      number: 456,
      body: `- [ ] Task 3
- [ ] Task 4`,
      url: 'https://github.com/org/repo/issues/456',
      org: 'org',
      repo: 'repo',
    };

    const basicStoryObject1: StoryObject = {
      story: { ...mock<StoryOption>(), id: 'story1', name: 'Story 1' },
      storyIssue: basicStoryIssue1,
      issues: [],
    };
    const basicStoryObject2: StoryObject = {
      story: { ...mock<StoryOption>(), id: 'story2', name: 'Story 2' },
      storyIssue: basicStoryIssue2,
      issues: [],
    };

    const basicStoryObjectMap: StoryObjectMap = new Map([
      ['Story 1', basicStoryObject1],
      ['Story 2', basicStoryObject2],
    ]);

    const regularStoryProject = {
      ...basicProject,
      story: {
        name: 'Story Field',
        fieldId: 'storyFieldId',
        databaseId: 1,
        stories: [
          { ...mock<StoryOption>(), id: 'regular1', name: 'regular / Story 1' },
        ],
        workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
      },
    };

    const regularStoryObjectMap = new Map([
      [
        'regular / Story 1',
        {
          story: {
            ...mock<StoryOption>(),
            id: 'regular1',
            name: 'regular / Story 1',
          },
          storyIssue: basicStoryIssue1,
          issues: [],
        },
      ],
    ]);

    const testCases: {
      name: string;
      input: {
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        urlOfStoryView: string;
        disabledStatus: string;
        storyObjectMap: StoryObjectMap;
      };
      expectedThrowError?: Error;
      expectedCreateNewIssueCalls: [
        string,
        string,
        string,
        string,
        string[],
        string[],
      ][];
      expectedUpdateIssueCalls: [Issue][];
      expectedUpdateStoryCalls: [Project, Issue, string][];
      expectedGetIssueByUrlCalls: [string][];
    }[] = [
      {
        name: 'should not process when story is not set',
        input: {
          project: { ...basicProject, story: null },
          issues: [basicStoryIssue1],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: basicStoryObjectMap,
        },
        expectedCreateNewIssueCalls: [],
        expectedUpdateIssueCalls: [],
        expectedUpdateStoryCalls: [],
        expectedGetIssueByUrlCalls: [],
      },
      {
        name: 'should not process when cache is used',
        input: {
          project: basicProject,
          issues: [basicStoryIssue1],
          cacheUsed: true,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: basicStoryObjectMap,
        },
        expectedCreateNewIssueCalls: [],
        expectedUpdateIssueCalls: [],
        expectedUpdateStoryCalls: [],
        expectedGetIssueByUrlCalls: [],
      },
      {
        name: 'should skip regular stories',
        input: {
          project: regularStoryProject,
          issues: [basicStoryIssue1],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: regularStoryObjectMap,
        },
        expectedCreateNewIssueCalls: [],
        expectedUpdateIssueCalls: [],
        expectedUpdateStoryCalls: [],
        expectedGetIssueByUrlCalls: [],
      },
      {
        name: 'should throw error when story issue not found',
        input: {
          project: basicProject,
          issues: [],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: basicStoryObjectMap,
        },
        expectedThrowError: new Error('Story issue not found: Story 1'),
        expectedCreateNewIssueCalls: [],
        expectedUpdateIssueCalls: [],
        expectedUpdateStoryCalls: [],
        expectedGetIssueByUrlCalls: [],
      },

      {
        name: 'should skip closed story issues or disabled status',
        input: {
          project: basicProject,
          issues: [
            {
              ...basicStoryIssue1,
              state: 'CLOSED',
              isClosed: true,
            },
            {
              ...basicStoryIssue2,
              status: 'Disabled',
            },
          ],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Disabled',
          storyObjectMap: basicStoryObjectMap,
        },
        expectedCreateNewIssueCalls: [],
        expectedUpdateIssueCalls: [],
        expectedUpdateStoryCalls: [],
        expectedGetIssueByUrlCalls: [],
      },
      {
        name: 'should add story view link and create new issues for checkboxes',
        input: {
          project: basicProject,
          issues: [basicStoryIssue1, basicStoryIssue2],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: basicStoryObjectMap,
        },
        expectedCreateNewIssueCalls: [
          [
            'org',
            'repo',
            'Task 1',
            '- Parent issue: https://github.com/org/repo/issues/123',
            [],
            [],
          ],
          [
            'org',
            'repo',
            'Task 2',
            '- Parent issue: https://github.com/org/repo/issues/123',
            [],
            [],
          ],
          [
            'org',
            'repo',
            'Task 3',
            '- Parent issue: https://github.com/org/repo/issues/456',
            [],
            [],
          ],
          [
            'org',
            'repo',
            'Task 4',
            '- Parent issue: https://github.com/org/repo/issues/456',
            [],
            [],
          ],
        ],
        expectedUpdateIssueCalls: [
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] Task 1
- [ ] Task 2`,
            },
          ],
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] https://github.com/org/repo/issues/1
- [ ] Task 2`,
            },
          ],
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] https://github.com/org/repo/issues/1
- [ ] https://github.com/org/repo/issues/2`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] Task 3
- [ ] Task 4`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] https://github.com/org/repo/issues/3
- [ ] Task 4`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] https://github.com/org/repo/issues/3
- [ ] https://github.com/org/repo/issues/4`,
            },
          ],
        ],
        expectedUpdateStoryCalls: [
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/1',
            },
            'story1',
          ],
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/2',
            },
            'story1',
          ],
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/3',
            },
            'story2',
          ],
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/4',
            },
            'story2',
          ],
        ],
        expectedGetIssueByUrlCalls: [
          ['https://github.com/org/repo/issues/1'],
          ['https://github.com/org/repo/issues/2'],
          ['https://github.com/org/repo/issues/3'],
          ['https://github.com/org/repo/issues/4'],
        ],
      },
      {
        name: 'should not add story view link when it already exists',
        input: {
          project: {
            ...basicProject,
            story: {
              ...basicStory,
              stories: [
                { ...mock<StoryOption>(), id: 'story1', name: 'Story 1' },
              ],
            },
          },
          issues: [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] Task 1`,
            },
          ],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: new Map([['Story 1', basicStoryObject1]]),
        },
        expectedCreateNewIssueCalls: [
          [
            'org',
            'repo',
            'Task 1',
            '- Parent issue: https://github.com/org/repo/issues/123',
            [],
            [],
          ],
        ],
        expectedUpdateIssueCalls: [
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] https://github.com/org/repo/issues/1`,
            },
          ],
        ],
        expectedUpdateStoryCalls: [
          [
            {
              ...basicProject,
              story: {
                ...basicStory,
                stories: [
                  { ...mock<StoryOption>(), id: 'story1', name: 'Story 1' },
                ],
              },
            },
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/1',
            },
            'story1',
          ],
        ],
        expectedGetIssueByUrlCalls: [['https://github.com/org/repo/issues/1']],
      },
      {
        name: 'should add story view link even when no checkboxes exist',
        input: {
          project: {
            ...basicProject,
            story: {
              ...basicStory,
              stories: [
                { ...mock<StoryOption>(), id: 'story1', name: 'Story 1' },
              ],
            },
          },
          issues: [
            {
              ...basicStoryIssue1,
              body: 'Some description without checkboxes',
            },
          ],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: new Map([
            [
              'Story 1',
              {
                ...basicStoryObject1,
                storyIssue: {
                  ...basicStoryIssue1,
                  body: 'Some description without checkboxes',
                },
              },
            ],
          ]),
        },
        expectedCreateNewIssueCalls: [],
        expectedUpdateIssueCalls: [
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

Some description without checkboxes`,
            },
          ],
        ],
        expectedUpdateStoryCalls: [],
        expectedGetIssueByUrlCalls: [],
      },
      {
        name: 'should create new issues with replaced STORYNAME for checkboxes and update story issue',
        input: {
          project: basicProject,
          issues: [
            {
              ...basicStoryIssue1,
              body: `- [ ] Task 1
- [ ] Task 2 for \`STORYNAME\``,
            },
            basicStoryIssue2,
          ],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: basicStoryObjectMap,
        },
        expectedCreateNewIssueCalls: [
          [
            'org',
            'repo',
            'Task 1',
            '- Parent issue: https://github.com/org/repo/issues/123',
            [],
            [],
          ],
          [
            'org',
            'repo',
            'Task 2 for `Story 1 #123`',
            '- Parent issue: https://github.com/org/repo/issues/123',
            [],
            [],
          ],
          [
            'org',
            'repo',
            'Task 3',
            '- Parent issue: https://github.com/org/repo/issues/456',
            [],
            [],
          ],
          [
            'org',
            'repo',
            'Task 4',
            '- Parent issue: https://github.com/org/repo/issues/456',
            [],
            [],
          ],
        ],
        expectedUpdateIssueCalls: [
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] Task 1
- [ ] Task 2 for \`STORYNAME\``,
            },
          ],
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] https://github.com/org/repo/issues/1
- [ ] Task 2 for \`STORYNAME\``,
            },
          ],
          [
            {
              ...basicStoryIssue1,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] https://github.com/org/repo/issues/1
- [ ] https://github.com/org/repo/issues/2`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] Task 3
- [ ] Task 4`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] https://github.com/org/repo/issues/3
- [ ] Task 4`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] https://github.com/org/repo/issues/3
- [ ] https://github.com/org/repo/issues/4`,
            },
          ],
        ],
        expectedUpdateStoryCalls: [
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/1',
            },
            'story1',
          ],
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/2',
            },
            'story1',
          ],
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/3',
            },
            'story2',
          ],
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/org/repo/issues/4',
            },
            'story2',
          ],
        ],
        expectedGetIssueByUrlCalls: [
          ['https://github.com/org/repo/issues/1'],
          ['https://github.com/org/repo/issues/2'],
          ['https://github.com/org/repo/issues/3'],
          ['https://github.com/org/repo/issues/4'],
        ],
      },
      {
        name: 'should create new issues in same repo as parent story issue when different stories have different repos',
        input: {
          project: basicProject,
          issues: [
            {
              ...basicStoryIssue1,
              org: 'orgA',
              repo: 'repoA',
              body: `- [ ] Task 1`,
            },
            {
              ...basicStoryIssue2,
              org: 'orgB',
              repo: 'repoB',
              body: `- [ ] Task 2`,
            },
          ],
          cacheUsed: false,
          urlOfStoryView: 'https://example.com',
          disabledStatus: 'Closed',
          storyObjectMap: new Map([
            [
              'Story 1',
              {
                story: {
                  ...mock<StoryOption>(),
                  id: 'story1',
                  name: 'Story 1',
                },
                storyIssue: {
                  ...basicStoryIssue1,
                  org: 'orgA',
                  repo: 'repoA',
                  body: `- [ ] Task 1`,
                },
                issues: [],
              },
            ],
            [
              'Story 2',
              {
                story: {
                  ...mock<StoryOption>(),
                  id: 'story2',
                  name: 'Story 2',
                },
                storyIssue: {
                  ...basicStoryIssue2,
                  org: 'orgB',
                  repo: 'repoB',
                  body: `- [ ] Task 2`,
                },
                issues: [],
              },
            ],
          ]),
        },
        expectedCreateNewIssueCalls: [
          [
            'orgA',
            'repoA',
            'Task 1',
            '- Parent issue: https://github.com/org/repo/issues/123',
            [],
            [],
          ],
          [
            'orgB',
            'repoB',
            'Task 2',
            '- Parent issue: https://github.com/org/repo/issues/456',
            [],
            [],
          ],
        ],
        expectedUpdateIssueCalls: [
          [
            {
              ...basicStoryIssue1,
              org: 'orgA',
              repo: 'repoA',
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] Task 1`,
            },
          ],
          [
            {
              ...basicStoryIssue1,
              org: 'orgA',
              repo: 'repoA',
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%201

- [ ] https://github.com/orgA/repoA/issues/1`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              org: 'orgB',
              repo: 'repoB',
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] Task 2`,
            },
          ],
          [
            {
              ...basicStoryIssue2,
              org: 'orgB',
              repo: 'repoB',
              body: `https://example.com?sliceBy%5Bvalue%5D=Story%202

- [ ] https://github.com/orgB/repoB/issues/2`,
            },
          ],
        ],
        expectedUpdateStoryCalls: [
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/orgA/repoA/issues/1',
            },
            'story1',
          ],
          [
            basicProject,
            {
              ...mock<Issue>(),
              url: 'https://github.com/orgB/repoB/issues/2',
            },
            'story2',
          ],
        ],
        expectedGetIssueByUrlCalls: [
          ['https://github.com/orgA/repoA/issues/1'],
          ['https://github.com/orgB/repoB/issues/2'],
        ],
      },
    ];

    testCases.forEach(
      ({
        name,
        input,
        expectedThrowError,
        expectedCreateNewIssueCalls,
        expectedUpdateIssueCalls,
        expectedUpdateStoryCalls,
        expectedGetIssueByUrlCalls,
      }) => {
        it(name, async () => {
          jest.clearAllMocks();

          let issueCounter = 1;
          mockIssueRepository.createNewIssue.mockImplementation(
            async () => issueCounter++,
          );
          mockIssueRepository.getIssueByUrl.mockImplementation(async (url) => ({
            ...mock<Issue>(),
            url,
          }));

          const useCase = new ConvertCheckboxToIssueInStoryIssueUseCase(
            mockIssueRepository,
          );
          try {
            await useCase.run(input);
          } catch (e) {
            if (expectedThrowError === undefined) {
              throw e;
            }
            if (e === null || typeof e !== 'object' || !('message' in e)) {
              expect(e).toEqual(expectedThrowError);
            }
          }

          expect(mockIssueRepository.createNewIssue.mock.calls).toEqual(
            expectedCreateNewIssueCalls,
          );
          expect(mockIssueRepository.updateIssue.mock.calls).toEqual(
            expectedUpdateIssueCalls,
          );
          expect(mockIssueRepository.updateStory.mock.calls).toEqual(
            expectedUpdateStoryCalls,
          );
          expect(mockIssueRepository.getIssueByUrl.mock.calls).toEqual(
            expectedGetIssueByUrlCalls,
          );
        });
      },
    );
  });

  describe('buildStoryViewLink', () => {
    const testCases: {
      name: string;
      urlOfStoryView: string;
      storyName: string;
      expected: string;
    }[] = [
      {
        name: 'should build story view link with encoded story name',
        urlOfStoryView: 'https://github.com/users/TestUser/projects/1/views/1',
        storyName: 'Story 1',
        expected:
          'https://github.com/users/TestUser/projects/1/views/1?sliceBy%5Bvalue%5D=Story%201',
      },
      {
        name: 'should handle story name with special characters',
        urlOfStoryView: 'https://github.com/users/TestUser/projects/1/views/1',
        storyName: 'planning business trip for next spring',
        expected:
          'https://github.com/users/TestUser/projects/1/views/1?sliceBy%5Bvalue%5D=planning%20business%20trip%20for%20next%20spring',
      },
      {
        name: 'should handle story name with hash',
        urlOfStoryView: 'https://github.com/users/TestUser/projects/1/views/1',
        storyName: 'Story #1',
        expected:
          'https://github.com/users/TestUser/projects/1/views/1?sliceBy%5Bvalue%5D=Story%20%231',
      },
    ];

    testCases.forEach(({ name, urlOfStoryView, storyName, expected }) => {
      it(name, () => {
        const useCase = new ConvertCheckboxToIssueInStoryIssueUseCase(
          mockIssueRepository,
        );
        const result = useCase.buildStoryViewLink(urlOfStoryView, storyName);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('findCheckboxTextsNotCreatedIssue', () => {
    const testCases: {
      name: string;
      input: string;
      expected: string[];
    }[] = [
      {
        name: 'should find checkbox texts not created as issues',
        input: `- [ ] Task 1
- [ ] Task 2
- [x] Task 3
- [ ] #5
- [ ] #6 
- [ ] https://github.com/org/repo/issues/1
- [ ] https://github.com/org/repo/issues/7 `,
        expected: ['Task 1', 'Task 2'],
      },
      {
        name: 'should return empty array when no checkboxes found',
        input: 'No checkboxes here',
        expected: [],
      },
      {
        name: 'should return empty array when all checkboxes are issues',
        input: `- [ ] https://github.com/org/repo/issues/1
- [ ] https://github.com/org/repo/issues/2`,
        expected: [],
      },
      {
        name: 'should ignore empty checkboxes',
        input: `- [ ] Task 1
- [ ] 
- [ ] Task 2
- [ ]`,
        expected: ['Task 1', 'Task 2'],
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const useCase = new ConvertCheckboxToIssueInStoryIssueUseCase(
          mockIssueRepository,
        );
        const result = useCase.findCheckboxTextsNotCreatedIssue(input);
        expect(result).toEqual(expected);
      });
    });
  });
});
