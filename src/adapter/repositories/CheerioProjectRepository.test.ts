import { CheerioProjectRepository } from './CheerioProjectRepository';
import dotenv from 'dotenv';
import { LocalStorageRepository } from './LocalStorageRepository';
import { FieldOption, Project } from '../../domain/entities/Project';

dotenv.config();

describe('CheerioProjectRepository', () => {
  jest.setTimeout(60 * 1000);
  const localStorageRepository = new LocalStorageRepository();

  const repository = new CheerioProjectRepository(
    localStorageRepository,
    './tmp/github.com.cookies.json',
    process.env.GH_TOKEN,
  );
  beforeAll(async () => {
    await repository.refreshCookie();
  });
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  describe('updateStoryList', () => {
    it('success', async () => {
      const project: Project = {
        completionDate50PercentConfidence: null,
        dependedIssueUrlSeparatedByComma: null,
        id: 'PVT_kwHOAGJHa84AFhgF',
        databaseId: 1447941,
        name: 'V2 project on owner for testing',
        nextActionDate: {
          fieldId: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
          name: 'NextActionDate',
        },
        nextActionHour: null,
        remainingEstimationMinutes: null,
        status: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
          name: 'Status',
          statuses: [
            {
              color: 'GRAY',
              description: '',
              id: 'f75ad846',
              name: 'Todo',
            },
            {
              color: 'GRAY',
              description: '',
              id: '47fc9ee4',
              name: 'In Progress',
            },
            {
              color: 'GRAY',
              description: '',
              id: '98236657',
              name: 'Done',
            },
          ],
        },
        story: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzg1oBms',
          databaseId: 224921195,
          name: 'Story',
          stories: [
            {
              color: 'GRAY',
              description: '',
              id: 'af410dae',
              name: 'story1',
            },
            {
              color: 'GRAY',
              description: '',
              id: '696ccdef',
              name: 'Workflow Management',
            },
            {
              color: 'GRAY',
              description: '',
              id: '4fa21881',
              name: 'test',
            },
          ],
          workflowManagementStory: {
            id: '696ccdef',
            name: 'Workflow Management',
          },
        },
      };

      const storyOption: Omit<FieldOption, 'id'> & { id: null } = {
        id: null,
        name: 'test-story-from-unit-test',
        color: 'BLUE',
        description: 'created by unit test',
      };
      const story = project.story;
      if (!story) {
        throw new Error('story is null');
      }
      const newStoryList: Parameters<typeof repository.updateStoryList>['1'] =
        [];
      newStoryList.push(...story.stories.slice(0, 2), storyOption);

      const res = await repository.updateStoryList(project, newStoryList);
      expect(res[0]).toEqual(newStoryList[0]);
      expect(res[1]).toEqual(newStoryList[1]);
      expect(res[1].id).toBeDefined();
      expect(res[2].name).toEqual(newStoryList[2].name);
      expect(res[2].color).toEqual(newStoryList[2].color);
      expect(res[2].description).toEqual(newStoryList[2].description);
    });
  });
});
