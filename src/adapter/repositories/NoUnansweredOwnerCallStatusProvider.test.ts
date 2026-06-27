import { NoUnansweredOwnerCallStatusProvider } from './NoUnansweredOwnerCallStatusProvider';

describe('NoUnansweredOwnerCallStatusProvider', () => {
  it('always reports no session as having an unanswered owner call', async () => {
    const provider = new NoUnansweredOwnerCallStatusProvider();
    const result = await provider.listSessionNamesWithUnansweredOwnerCall([
      'session-a',
      'session-b',
    ]);
    expect(result.size).toBe(0);
  });
});
