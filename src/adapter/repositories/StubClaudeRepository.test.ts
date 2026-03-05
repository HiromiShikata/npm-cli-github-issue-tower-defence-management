import { StubClaudeRepository } from './StubClaudeRepository';

describe('StubClaudeRepository', () => {
  let repository: StubClaudeRepository;

  beforeEach(() => {
    repository = new StubClaudeRepository();
  });

  it('should return empty usage array', async () => {
    const result = await repository.getUsage();
    expect(result).toEqual([]);
  });

  it('should return true for isClaudeAvailable', async () => {
    const result = await repository.isClaudeAvailable(90);
    expect(result).toBe(true);
  });
});
