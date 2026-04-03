import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';

describe('ClearDependedIssueURLUseCase', () => {
  jest.setTimeout(30 * 1000);
  const mockIssueRepository = mock<IssueRepository>();
  describe('run', () => {
    const basicProject = {
      ...mock<Project>(),
      dependedIssueUrlSeparatedByComma: {
        name: 'Depended Issue URL Separated By Comma',
        fieldId: 'fieldId',
      },
    };
    const basicIssueOne = {
      ...mock<Issue>(),
      url: 'url1',
      dependedIssueUrls: [],
      isClosed: true,
    };
    const basicIssueTwo = {
      ...mock<Issue>(),
      url: 'url2',
      dependedIssueUrls: ['url1'],
      isClosed: false,
    };
    const basicIssueThree = {
      ...mock<Issue>(),
      url: 'url3',
      dependedIssueUrls: ['url1', 'url2'],
      isClosed: false,
    };
    const testCases: {
      name: string;
      input: {
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
      };
      expectedIssueRepositoryClearProjectFieldCalls: [Project, string, Issue][];
      expectedIssueRepositoryUpdateTextFieldCalls: [
        Project,
        string,
        Issue,
        string,
      ][];
      expectedIssueRepositoryCreateCommentCalls: [Issue, string][];
    }[] = [
      {
        name: 'should not call clearProjectField and createComment when dependedIssueUrlSeparatedByComma is not set',
        input: {
          project: {
            ...basicProject,
            dependedIssueUrlSeparatedByComma: null,
          },
          issues: [basicIssueOne, basicIssueTwo, basicIssueThree],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [],
      },
      {
        name: 'should not call clearProjectField and createComment when dependedIssueUrls is empty',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            {
              ...basicIssueTwo,
              dependedIssueUrls: [],
            },
            {
              ...basicIssueThree,
              dependedIssueUrls: [],
            },
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [],
      },
      {
        name: 'should not clear dependency when dependedIssue is not in project',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            {
              ...basicIssueTwo,
              dependedIssueUrls: ['url4'],
            },
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url5', 'url6'],
            },
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [],
      },
      {
        name: 'should not call clearProjectField and createComment when dependedIssue is not closed',
        input: {
          project: basicProject,
          issues: [
            {
              ...basicIssueOne,
              isClosed: false,
            },
            basicIssueTwo,
            basicIssueThree,
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [],
      },
      {
        name: 'should keep not-in-project dependency and clear only closed in-project dependency',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url1', 'url4'],
            },
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [],
        expectedIssueRepositoryUpdateTextFieldCalls: [
          [
            basicProject,
            'fieldId',
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url1', 'url4'],
            },
            'url4',
          ],
        ],
        expectedIssueRepositoryCreateCommentCalls: [
          [
            { ...basicIssueThree, dependedIssueUrls: ['url1', 'url4'] },
            'Closed depended issues:\n- url1',
          ],
        ],
      },
      {
        name: 'should call clearProjectField and createComment when dependedIssue is closed',
        input: {
          project: basicProject,
          issues: [basicIssueOne, basicIssueTwo, basicIssueThree],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [
          [basicProject, 'fieldId', basicIssueTwo],
        ],
        expectedIssueRepositoryUpdateTextFieldCalls: [
          [basicProject, 'fieldId', basicIssueThree, 'url2'],
        ],
        expectedIssueRepositoryCreateCommentCalls: [
          [basicIssueTwo, 'Closed all depended issues:\n- url1'],
          [basicIssueThree, 'Closed depended issues:\n- url1'],
        ],
      },
      {
        name: 'should call clearProjectField and createComment once for one closed dependedIssue',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            basicIssueTwo,
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url2'],
            },
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [
          [basicProject, 'fieldId', basicIssueTwo],
        ],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [
          [basicIssueTwo, 'Closed all depended issues:\n- url1'],
        ],
      },
      {
        name: 'should call clearProjectField and createComment twice for two closed dependedIssues',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            {
              ...basicIssueTwo,
              isClosed: true,
            },
            basicIssueThree,
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [
          [basicProject, 'fieldId', basicIssueThree],
        ],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [
          [basicIssueThree, 'Closed all depended issues:\n- url1\n- url2'],
        ],
      },
      {
        name: 'should not call clearProjectField and createComment when dependedIssue is closed and cacheUsed is true',
        input: {
          project: basicProject,
          issues: [basicIssueOne, basicIssueTwo, basicIssueThree],
          cacheUsed: true,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [],
      },
      {
        name: 'should not call clearProjectField and createComment when target issue is closed',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            {
              ...basicIssueTwo,
              isClosed: true,
            },
            {
              ...basicIssueThree,
              isClosed: true,
            },
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [],
      },
      {
        name: 'should call clearProjectField and createComment when dependedIssue depends on each other',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            {
              ...basicIssueTwo,
              dependedIssueUrls: ['url3'],
            },
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url2'],
            },
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [
          [
            basicProject,
            'fieldId',
            {
              ...basicIssueTwo,
              dependedIssueUrls: ['url3'],
            },
          ],
          [
            basicProject,
            'fieldId',
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url2'],
            },
          ],
        ],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [
          [
            {
              ...basicIssueTwo,
              dependedIssueUrls: ['url3'],
            },
            'Circular dependency removed:\n- url3',
          ],
          [
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url2'],
            },
            'Circular dependency removed:\n- url2',
          ],
        ],
      },
      {
        name: 'should call clearProjectField and createComment when issue depends on own',
        input: {
          project: basicProject,
          issues: [
            basicIssueOne,
            {
              ...basicIssueTwo,
              dependedIssueUrls: ['url2'],
            },
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url3'],
            },
          ],
          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [
          [
            basicProject,
            'fieldId',
            {
              ...basicIssueTwo,
              dependedIssueUrls: ['url2'],
            },
          ],
          [
            basicProject,
            'fieldId',
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url3'],
            },
          ],
        ],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [
          [
            {
              ...basicIssueTwo,
              dependedIssueUrls: ['url2'],
            },
            'Circular dependency removed:\n- url2',
          ],
          [
            {
              ...basicIssueThree,
              dependedIssueUrls: ['url3'],
            },
            'Circular dependency removed:\n- url3',
          ],
        ],
      },
      {
        name: 'should call clearProjectField and createComment when issue depends circular',
        input: {
          project: basicProject,
          issues: [
            { ...basicIssueOne, dependedIssueUrls: ['url3'], isClosed: false },
            basicIssueTwo,
            basicIssueThree,
          ],

          cacheUsed: false,
        },
        expectedIssueRepositoryClearProjectFieldCalls: [
          [
            basicProject,
            'fieldId',
            {
              ...basicIssueOne,
              dependedIssueUrls: ['url3'],
              isClosed: false,
            },
          ],
          [basicProject, 'fieldId', basicIssueTwo],
          [basicProject, 'fieldId', basicIssueThree],
        ],
        expectedIssueRepositoryUpdateTextFieldCalls: [],
        expectedIssueRepositoryCreateCommentCalls: [
          [
            {
              ...basicIssueOne,
              dependedIssueUrls: ['url3'],
              isClosed: false,
            },
            'Circular dependency removed:\n- url3',
          ],
          [basicIssueTwo, 'Circular dependency removed:\n- url1'],
          [basicIssueThree, 'Circular dependency removed:\n- url1\n- url2'],
        ],
      },
    ];
    testCases.forEach(
      ({
        name,
        input,
        expectedIssueRepositoryClearProjectFieldCalls,
        expectedIssueRepositoryUpdateTextFieldCalls,
        expectedIssueRepositoryCreateCommentCalls,
      }) => {
        it(name, async () => {
          jest.clearAllMocks();
          const useCase = new ClearDependedIssueURLUseCase(mockIssueRepository);
          await useCase.run(input);
          expect(mockIssueRepository.clearProjectField.mock.calls).toEqual(
            expectedIssueRepositoryClearProjectFieldCalls,
          );
          expect(mockIssueRepository.updateProjectTextField.mock.calls).toEqual(
            expectedIssueRepositoryUpdateTextFieldCalls,
          );
          expect(mockIssueRepository.createComment.mock.calls).toEqual(
            expectedIssueRepositoryCreateCommentCalls,
          );
        });
      },
    );
  });
});
