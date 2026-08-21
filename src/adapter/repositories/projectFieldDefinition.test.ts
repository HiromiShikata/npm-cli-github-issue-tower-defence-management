import {
  ProjectFieldDefinition,
  convertToFieldOptionColor,
  projectFromDefinition,
} from './projectFieldDefinition';

describe('convertToFieldOptionColor', () => {
  it('should preserve PINK so the Todo by human status button renders pink', () => {
    expect(convertToFieldOptionColor('PINK')).toEqual('PINK');
  });

  it('should preserve ORANGE so the Unread status button renders orange', () => {
    expect(convertToFieldOptionColor('ORANGE')).toEqual('ORANGE');
  });

  it('should preserve the remaining GitHub project option colors', () => {
    expect(convertToFieldOptionColor('RED')).toEqual('RED');
    expect(convertToFieldOptionColor('YELLOW')).toEqual('YELLOW');
    expect(convertToFieldOptionColor('GREEN')).toEqual('GREEN');
    expect(convertToFieldOptionColor('BLUE')).toEqual('BLUE');
    expect(convertToFieldOptionColor('PURPLE')).toEqual('PURPLE');
    expect(convertToFieldOptionColor('GRAY')).toEqual('GRAY');
  });

  it('should fall back to GRAY for an unknown color value', () => {
    expect(convertToFieldOptionColor('UNKNOWN')).toEqual('GRAY');
  });
});

describe('projectFromDefinition', () => {
  const statusField: ProjectFieldDefinition = {
    fieldId: 'PVTSSF_status',
    databaseId: 12940049,
    name: 'Status',
    options: [
      {
        id: 'f75ad846',
        name: 'Unread',
        color: 'ORANGE',
        description: '',
      },
    ],
  };
  const storyField: ProjectFieldDefinition = {
    fieldId: 'PVTSSF_story',
    databaseId: 133939017,
    name: 'story',
    options: [
      {
        id: '6dc26727',
        name: 'regular / workflow management',
        color: 'BLUE',
        description: 'workflow',
      },
      {
        id: '4ada6c4c',
        name: 'regular / entertainment',
        color: 'BLUE',
        description: '',
      },
    ],
  };

  it('should map the status field and every optional field it finds by name', () => {
    const project = projectFromDefinition({
      id: 'PVT_project',
      url: 'https://github.com/users/HiromiShikata/projects/48',
      databaseId: 1403371,
      name: 'UMINO',
      fields: [
        statusField,
        storyField,
        {
          fieldId: 'PVTF_nextactiondate',
          databaseId: 35978365,
          name: 'nextactiondate',
          options: [],
        },
        {
          fieldId: 'PVTSSF_nextactionhour',
          databaseId: 133948391,
          name: 'nextactionhour',
          options: [],
        },
        {
          fieldId: 'PVTF_remaining',
          databaseId: 1,
          name: 'remaining estimation minutes',
          options: [],
        },
        {
          fieldId: 'PVTF_depended',
          databaseId: 156128545,
          name: 'Depended Issue URL separated by comma',
          options: [],
        },
        {
          fieldId: 'PVTF_completion',
          databaseId: 2,
          name: 'Completion Date (50% Confidence)',
          options: [],
        },
      ],
    });

    expect(project).toEqual({
      id: 'PVT_project',
      url: 'https://github.com/users/HiromiShikata/projects/48',
      databaseId: 1403371,
      name: 'UMINO',
      status: {
        name: 'Status',
        fieldId: 'PVTSSF_status',
        statuses: statusField.options,
      },
      nextActionDate: {
        name: 'nextactiondate',
        fieldId: 'PVTF_nextactiondate',
      },
      nextActionHour: {
        name: 'nextactionhour',
        fieldId: 'PVTSSF_nextactionhour',
      },
      story: {
        name: 'story',
        fieldId: 'PVTSSF_story',
        databaseId: 133939017,
        stories: storyField.options,
        workflowManagementStory: storyField.options[0],
      },
      remainingEstimationMinutes: {
        name: 'remaining estimation minutes',
        fieldId: 'PVTF_remaining',
      },
      dependedIssueUrlSeparatedByComma: {
        name: 'Depended Issue URL separated by comma',
        fieldId: 'PVTF_depended',
      },
      completionDate50PercentConfidence: {
        name: 'Completion Date (50% Confidence)',
        fieldId: 'PVTF_completion',
      },
      agent: null,
    });
  });

  it('should leave every optional field null when the project carries only the status field', () => {
    const project = projectFromDefinition({
      id: 'PVT_project',
      url: 'https://github.com/orgs/X-Mile/projects/7',
      databaseId: 7,
      name: 'minimal',
      fields: [statusField],
    });

    expect(project.story).toBeNull();
    expect(project.nextActionDate).toBeNull();
    expect(project.nextActionHour).toBeNull();
    expect(project.remainingEstimationMinutes).toBeNull();
    expect(project.dependedIssueUrlSeparatedByComma).toBeNull();
    expect(project.completionDate50PercentConfidence).toBeNull();
  });

  it('should leave the story null when no option names the workflow management story', () => {
    const project = projectFromDefinition({
      id: 'PVT_project',
      url: 'https://github.com/users/HiromiShikata/projects/48',
      databaseId: 1403371,
      name: 'UMINO',
      fields: [
        statusField,
        { ...storyField, options: [storyField.options[1]] },
      ],
    });

    expect(project.story).toBeNull();
  });

  it('should throw when the project has no status field', () => {
    expect(() =>
      projectFromDefinition({
        id: 'PVT_project',
        url: 'https://github.com/users/HiromiShikata/projects/48',
        databaseId: 1403371,
        name: 'UMINO',
        fields: [storyField],
      }),
    ).toThrow('status field is not found');
  });
});
