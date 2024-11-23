import { getInProgressTimeline } from './issueTimelineUtils';

describe('issueTimelineUtils', () => {
  const issueUrl = 'https://github.com/HiromiShikata/test-repository/issues/38';
  describe('getInProgressTimelineEvents', () => {
    it('should return in progress timeline events', async () => {
      const statusTimeline = [
        {
          author: 'HiromiShikata',
          from: 'In Progress',
          time: '2024-04-21T09:31:46Z',
          to: 'Todo',
        },
        {
          author: 'HiromiShikata',
          from: 'Todo',
          time: '2024-04-21T10:13:07Z',
          to: 'In Progress',
        },
      ];
      const inProgressTimeline = getInProgressTimeline(
        statusTimeline,
        issueUrl,
      );
      expect(inProgressTimeline).toEqual([
        {
          author: 'HiromiShikata',
          durationMinutes: 60.516666666666666,
          endedAt: new Date('2024-04-21T11:13:38Z'),
          issueUrl:
            'https://github.com/HiromiShikata/test-repository/issues/38',
          startedAt: new Date('2024-04-21T10:13:07Z'),
        },
      ]);
    });
    describe('should count `in progress` if from is not `in progress` but input it to `in progress` before', () => {
      describe(`fromToList | expectedStartEndList`, () => {
        test.each`
          caseName                                                       | fromToList                                                                                              | expectedStartEndList
          ${'Normal'}                                                    | ${[['Todo', 'In Progress', 'user0'], ['In Progress', 'Todo', 'user0']]}                                 | ${[['2000-01-01T00:00:00Z', '2000-01-01T00:01:00Z', 'user0', 1]]}
          ${'Closed by other user'}                                      | ${[['Todo', 'In Progress', 'user0'], ['In Progress', 'Todo', 'user1']]}                                 | ${[['2000-01-01T00:00:00Z', '2000-01-01T00:01:00Z', 'user0', 1]]}
          ${'No record moved from In Progress'}                          | ${[['Todo', 'In Progress', 'user0'], ['In Review', 'Todo', 'user0']]}                                   | ${[['2000-01-01T00:00:00Z', '2000-01-01T00:01:00Z', 'user0', 1]]}
          ${'No record moved from In Progress and other user continued'} | ${[['Todo', 'In Progress', 'user0'], ['Todo', 'In Progress', 'user1'], ['In Review', 'Todo', 'user1']]} | ${[['2000-01-01T00:00:00Z', '2000-01-01T00:01:00Z', 'user0', 1], ['2000-01-01T00:01:00Z', '2000-01-01T00:02:00Z', 'user1', 1]]}
        `(
          `$caseName, $fromToList, $expectedStartEndList`,
          async ({
            fromToList,
            expectedStartEndList,
          }: {
            fromToList: string[][];
            expectedStartEndList: string[][];
          }) => {
            const timeline = fromToList.map((fromTo: string[], index) => ({
              time: `2000-01-01T00:0${index}:00Z`,
              author: fromTo[2],
              from: fromTo[0],
              to: fromTo[1],
            }));
            const inProgressTimeline = await getInProgressTimeline(
              timeline,
              issueUrl,
            );
            expect(inProgressTimeline).toEqual(
              expectedStartEndList.map((expectedStartEnd) => {
                return {
                  author: expectedStartEnd[2],
                  endedAt: new Date(expectedStartEnd[1]),
                  issueUrl,
                  startedAt: new Date(expectedStartEnd[0]),
                  durationMinutes: expectedStartEnd[3],
                };
              }),
            );
          },
        );
      });
    });
  });
});
