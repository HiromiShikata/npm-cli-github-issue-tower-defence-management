import { NoUnansweredOwnerCallStatusProvider } from './NoUnansweredOwnerCallStatusProvider';

describe('NoUnansweredOwnerCallStatusProvider', () => {
  it('always reports no session as having an unanswered owner call', async () => {
    const provider = new NoUnansweredOwnerCallStatusProvider();
    const result = await provider.listSessionNamesWithUnansweredOwnerCall(
      new Map([
        ['session-a', '/transcripts/a.jsonl'],
        ['session-b', '/transcripts/b.jsonl'],
      ]),
    );
    expect(result.size).toBe(0);
  });
});
