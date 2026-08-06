import { mock } from 'jest-mock-extended';
import { Project } from '../entities/Project';
import {
  DEPENDED_ISSUE_URL_FIELD_NAME,
  NEXT_ACTION_DATE_FIELD_NAME,
  NEXT_ACTION_HOUR_FIELD_NAME,
  STORY_FIELD_NAME,
} from '../entities/RequiredProjectField';
import { ProjectRequiredFieldCreateUseCase } from './ProjectRequiredFieldCreateUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

describe('ProjectRequiredFieldCreateUseCase', () => {
  const projectUrl = 'https://github.com/orgs/meta-site/projects/18';
  const project: Project = {
    id: 'PVT_kwDOBjp5zs4BfQGn',
    url: projectUrl,
    databaseId: 18,
    name: 'cmg',
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

  const createUseCase = (existingFieldNames: string[]) => {
    const projectRepository =
      mock<
        Pick<ProjectRepository, 'getByUrl' | 'listFieldNames' | 'createField'>
      >();
    projectRepository.getByUrl.mockResolvedValue(project);
    projectRepository.listFieldNames.mockResolvedValue(existingFieldNames);
    projectRepository.createField.mockResolvedValue(undefined);
    return {
      projectRepository,
      useCase: new ProjectRequiredFieldCreateUseCase(projectRepository),
    };
  };

  it('should create every required field when the project has none of them', async () => {
    const { projectRepository, useCase } = createUseCase([
      'Title',
      'Assignees',
      'Status',
    ]);

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
    const { projectRepository, useCase } = createUseCase([
      'Title',
      'Status',
      'story',
      'nextactiondate',
      'nextactionhour',
      'Depended Issue URL separated by comma',
    ]);

    await useCase.run({ projectUrl });

    expect(projectRepository.createField).not.toHaveBeenCalled();
  });

  it('should create only the missing fields', async () => {
    const { projectRepository, useCase } = createUseCase([
      'Title',
      'Status',
      'Story',
      'Next Action Date',
    ]);

    await useCase.run({ projectUrl });

    const createdFieldNames = projectRepository.createField.mock.calls.map(
      (call) => call[1].name,
    );
    expect(createdFieldNames).toEqual([
      NEXT_ACTION_HOUR_FIELD_NAME,
      DEPENDED_ISSUE_URL_FIELD_NAME,
    ]);
  });

  it('should create the story field with the standard story options', async () => {
    const { projectRepository, useCase } = createUseCase(['Title', 'Status']);

    await useCase.run({ projectUrl });

    const storyCall = projectRepository.createField.mock.calls.find(
      (call) => call[1].name === STORY_FIELD_NAME,
    );
    expect(storyCall?.[1].dataType).toBe('SINGLE_SELECT');
    expect(storyCall?.[1].options.map((option) => option.name)).toEqual([
      'regular / NO STORY',
      'regular / WORKFLOW BLOCKER',
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
    const { projectRepository, useCase } = createUseCase(['Title', 'Status']);

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
    const { projectRepository, useCase } = createUseCase(['Title', 'Status']);

    await useCase.run({ projectUrl });

    const dependedCall = projectRepository.createField.mock.calls.find(
      (call) => call[1].name === DEPENDED_ISSUE_URL_FIELD_NAME,
    );
    expect(dependedCall?.[1].dataType).toBe('TEXT');
    expect(dependedCall?.[1].options).toEqual([]);
  });

  it('should create the next action date field as a date field', async () => {
    const { projectRepository, useCase } = createUseCase(['Title', 'Status']);

    await useCase.run({ projectUrl });

    const dateCall = projectRepository.createField.mock.calls.find(
      (call) => call[1].name === NEXT_ACTION_DATE_FIELD_NAME,
    );
    expect(dateCall?.[1].dataType).toBe('DATE');
    expect(dateCall?.[1].options).toEqual([]);
  });
});
