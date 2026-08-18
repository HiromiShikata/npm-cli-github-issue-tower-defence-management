import { mock } from 'jest-mock-extended';
import { FieldOption, Project } from '../entities/Project';
import {
  DEPENDED_ISSUE_URL_FIELD_NAME,
  NEXT_ACTION_DATE_FIELD_NAME,
  NEXT_ACTION_HOUR_FIELD_NAME,
  STORY_FIELD_NAME,
} from '../entities/RequiredProjectField';
import { ProjectRequiredFieldCreateUseCase } from './ProjectRequiredFieldCreateUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

describe('ProjectRequiredFieldCreateUseCase', () => {
  const projectUrl = 'https://github.com/orgs/acme-labs/projects/18';
  const projectWithoutStory: Project = {
    id: 'PVT_kwDOAcmeLabs4AbCdEf',
    url: projectUrl,
    databaseId: 18,
    name: 'acme',
    status: {
      name: 'Status',
      fieldId: 'PVTSSF_status',
      statuses: [],
    },
    nextActionDate: null,
    nextActionHour: null,
    story: null,
    remainingEstimationMinutes: null,
    dependedIssueUrlSeparatedByComma: null,
    completionDate50PercentConfidence: null,
  };

  const buildProjectWithStory = (stories: FieldOption[]): Project => ({
    ...projectWithoutStory,
    story: {
      name: STORY_FIELD_NAME,
      fieldId: 'PVTSSF_story',
      databaseId: 42,
      stories,
      workflowManagementStory: {
        id:
          stories.find((s) => s.name === 'regular / workflow management')?.id ??
          'opt_wfm',
        name: 'regular / workflow management',
      },
    },
  });

  const createUseCase = (existingFieldNames: string[], project: Project) => {
    const projectRepository =
      mock<
        Pick<
          ProjectRepository,
          'getByUrl' | 'listFieldNames' | 'createField' | 'updateStoryList'
        >
      >();
    projectRepository.getByUrl.mockResolvedValue(project);
    projectRepository.listFieldNames.mockResolvedValue(existingFieldNames);
    projectRepository.createField.mockResolvedValue(undefined);
    projectRepository.updateStoryList.mockResolvedValue([]);
    return {
      projectRepository,
      useCase: new ProjectRequiredFieldCreateUseCase(projectRepository),
    };
  };

  it('should create every required field when the project has none of them', async () => {
    const { projectRepository, useCase } = createUseCase(
      ['Title', 'Assignees', 'Status'],
      projectWithoutStory,
    );

    await useCase.run({ projectUrl });

    const createdFieldNames = projectRepository.createField.mock.calls.map(
      (call) => call[1].name,
    );
    expect(createdFieldNames).toEqual([
      STORY_FIELD_NAME,
      NEXT_ACTION_DATE_FIELD_NAME,
      NEXT_ACTION_HOUR_FIELD_NAME,
      DEPENDED_ISSUE_URL_FIELD_NAME,
    ]);
  });

  it('should create nothing when the project already has every required field', async () => {
    const { projectRepository, useCase } = createUseCase(
      [
        'Title',
        'Status',
        'story',
        'nextactiondate',
        'nextactionhour',
        'Depended Issue URL separated by comma',
      ],
      projectWithoutStory,
    );

    await useCase.run({ projectUrl });

    expect(projectRepository.createField).not.toHaveBeenCalled();
  });

  it('should create only the missing fields', async () => {
    const { projectRepository, useCase } = createUseCase(
      ['Title', 'Status', 'Story', 'Next Action Date'],
      projectWithoutStory,
    );

    await useCase.run({ projectUrl });

    const createdFieldNames = projectRepository.createField.mock.calls.map(
      (call) => call[1].name,
    );
    expect(createdFieldNames).toEqual([
      NEXT_ACTION_HOUR_FIELD_NAME,
      DEPENDED_ISSUE_URL_FIELD_NAME,
    ]);
  });

  it('should create the story field with the standard story options including regular / inquiry', async () => {
    const { projectRepository, useCase } = createUseCase(
      ['Title', 'Status'],
      projectWithoutStory,
    );

    await useCase.run({ projectUrl });

    const storyCall = projectRepository.createField.mock.calls.find(
      (call) => call[1].name === STORY_FIELD_NAME,
    );
    expect(storyCall?.[1].dataType).toBe('SINGLE_SELECT');
    expect(storyCall?.[1].options.map((option) => option.name)).toEqual([
      'regular / NO STORY',
      'regular / WORKFLOW BLOCKER',
      'regular / inquiry',
      'regular / high priority',
      'regular / workflow management',
      'regular / routine management',
      'regular / middle bug',
      'regular / minor bug',
      'regular / refactor',
      'regular / backlog',
    ]);
  });

  it('should create the next action hour field with the hour options from 1 to 23', async () => {
    const { projectRepository, useCase } = createUseCase(
      ['Title', 'Status'],
      projectWithoutStory,
    );

    await useCase.run({ projectUrl });

    const hourCall = projectRepository.createField.mock.calls.find(
      (call) => call[1].name === NEXT_ACTION_HOUR_FIELD_NAME,
    );
    expect(hourCall?.[1].dataType).toBe('SINGLE_SELECT');
    expect(hourCall?.[1].options.map((option) => option.name)).toEqual(
      Array.from({ length: 23 }, (_, index) => `${index + 1}`),
    );
  });

  it('should create the depended issue url field as a text field', async () => {
    const { projectRepository, useCase } = createUseCase(
      ['Title', 'Status'],
      projectWithoutStory,
    );

    await useCase.run({ projectUrl });

    const dependedCall = projectRepository.createField.mock.calls.find(
      (call) => call[1].name === DEPENDED_ISSUE_URL_FIELD_NAME,
    );
    expect(dependedCall?.[1].dataType).toBe('TEXT');
    expect(dependedCall?.[1].options).toEqual([]);
  });

  it('should create the next action date field as a date field', async () => {
    const { projectRepository, useCase } = createUseCase(
      ['Title', 'Status'],
      projectWithoutStory,
    );

    await useCase.run({ projectUrl });

    const dateCall = projectRepository.createField.mock.calls.find(
      (call) => call[1].name === NEXT_ACTION_DATE_FIELD_NAME,
    );
    expect(dateCall?.[1].dataType).toBe('DATE');
    expect(dateCall?.[1].options).toEqual([]);
  });

  describe('reconcileStoryOptions', () => {
    const existingStoriesWithoutInquiry: FieldOption[] = [
      { id: 'opt1', name: 'regular / NO STORY', color: 'RED', description: '' },
      {
        id: 'opt2',
        name: 'regular / WORKFLOW BLOCKER',
        color: 'RED',
        description: '',
      },
      {
        id: 'opt3',
        name: 'regular / high priority',
        color: 'RED',
        description: '',
      },
      {
        id: 'opt4',
        name: 'regular / workflow management',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'opt5',
        name: 'regular / routine management',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'opt6',
        name: 'regular / middle bug',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'opt7',
        name: 'regular / minor bug',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'opt8',
        name: 'regular / refactor',
        color: 'GRAY',
        description: '',
      },
      { id: 'opt9', name: 'regular / backlog', color: 'GRAY', description: '' },
    ];

    const existingStoriesComplete: FieldOption[] = [
      { id: 'opt1', name: 'regular / NO STORY', color: 'RED', description: '' },
      {
        id: 'opt2',
        name: 'regular / WORKFLOW BLOCKER',
        color: 'RED',
        description: '',
      },
      {
        id: 'opt_inq',
        name: 'regular / inquiry',
        color: 'RED',
        description: '',
      },
      {
        id: 'opt3',
        name: 'regular / high priority',
        color: 'RED',
        description: '',
      },
      {
        id: 'opt4',
        name: 'regular / workflow management',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'opt5',
        name: 'regular / routine management',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'opt6',
        name: 'regular / middle bug',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'opt7',
        name: 'regular / minor bug',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'opt8',
        name: 'regular / refactor',
        color: 'GRAY',
        description: '',
      },
      { id: 'opt9', name: 'regular / backlog', color: 'GRAY', description: '' },
    ];

    it('should not call updateStoryList when story field does not exist on the project', async () => {
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        projectWithoutStory,
      );

      await useCase.run({ projectUrl });

      expect(projectRepository.updateStoryList).not.toHaveBeenCalled();
    });

    it('should not call updateStoryList when all required story options are already present', async () => {
      const project = buildProjectWithStory(existingStoriesComplete);
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        project,
      );

      await useCase.run({ projectUrl });

      expect(projectRepository.updateStoryList).not.toHaveBeenCalled();
    });

    it('should call updateStoryList when regular / inquiry is missing from the existing story field', async () => {
      const project = buildProjectWithStory(existingStoriesWithoutInquiry);
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        project,
      );

      await useCase.run({ projectUrl });

      expect(projectRepository.updateStoryList).toHaveBeenCalledTimes(1);
    });

    it('should place regular / inquiry immediately after regular / WORKFLOW BLOCKER in the merged option list', async () => {
      const project = buildProjectWithStory(existingStoriesWithoutInquiry);
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        project,
      );

      await useCase.run({ projectUrl });

      const submittedOptions =
        projectRepository.updateStoryList.mock.calls[0][1];
      const names = submittedOptions.map((o) => o.name);
      const workflowBlockerIndex = names.indexOf('regular / WORKFLOW BLOCKER');
      const inquiryIndex = names.indexOf('regular / inquiry');
      expect(inquiryIndex).toBe(workflowBlockerIndex + 1);
    });

    it('should submit the new option without an id', async () => {
      const project = buildProjectWithStory(existingStoriesWithoutInquiry);
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        project,
      );

      await useCase.run({ projectUrl });

      const submittedOptions =
        projectRepository.updateStoryList.mock.calls[0][1];
      const inquiryOption = submittedOptions.find(
        (o) => o.name === 'regular / inquiry',
      );
      expect(inquiryOption?.id).toBeNull();
    });

    it('should preserve the existing option ids in the merged list', async () => {
      const project = buildProjectWithStory(existingStoriesWithoutInquiry);
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        project,
      );

      await useCase.run({ projectUrl });

      const submittedOptions =
        projectRepository.updateStoryList.mock.calls[0][1];
      for (const original of existingStoriesWithoutInquiry) {
        const submitted = submittedOptions.find(
          (o) => o.name === original.name,
        );
        expect(submitted?.id).toBe(original.id);
      }
    });

    it('should include extra options that are not in the required list and preserve their ids', async () => {
      const extraOption: FieldOption = {
        id: 'opt_extra',
        name: 'regular / special project',
        color: 'BLUE',
        description: '',
      };
      const storiesWithExtra = [...existingStoriesWithoutInquiry, extraOption];
      const project = buildProjectWithStory(storiesWithExtra);
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        project,
      );

      await useCase.run({ projectUrl });

      const submittedOptions =
        projectRepository.updateStoryList.mock.calls[0][1];
      const submittedExtra = submittedOptions.find(
        (o) => o.name === 'regular / special project',
      );
      expect(submittedExtra?.id).toBe('opt_extra');
    });

    it('should submit regular / inquiry with color RED', async () => {
      const project = buildProjectWithStory(existingStoriesWithoutInquiry);
      const { projectRepository, useCase } = createUseCase(
        [
          'Title',
          'Status',
          'Story',
          'Next Action Date',
          'Next Action Hour',
          'Depended Issue URL separated by comma',
        ],
        project,
      );

      await useCase.run({ projectUrl });

      const submittedOptions =
        projectRepository.updateStoryList.mock.calls[0][1];
      const inquiryOption = submittedOptions.find(
        (o) => o.name === 'regular / inquiry',
      );
      expect(inquiryOption?.color).toBe('RED');
    });
  });
});
