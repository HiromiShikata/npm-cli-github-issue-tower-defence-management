import { GraphqlProjectRepository } from './GraphqlProjectRepository';

describe('GraphqlProjectRepository', () => {
  let repository: GraphqlProjectRepository;

  beforeEach(() => {
    repository = new GraphqlProjectRepository(
      '',
      process.env.TEST_BOT_GH_TOKEN,
    );
  });
  describe('getProjectFields', () => {
    it('should return project  fields', async () => {});
  });
});
