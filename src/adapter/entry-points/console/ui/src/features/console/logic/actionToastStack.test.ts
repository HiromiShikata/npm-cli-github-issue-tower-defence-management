import { splitActionToastStack } from './actionToastStack';

type Entry = { id: string; createdAt: number };

const buildEntries = (count: number): Entry[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`,
    createdAt: index,
  }));

describe('splitActionToastStack', () => {
  it.each([
    {
      totalEntries: 0,
      displayLimit: 4,
      expectedVisibleCount: 0,
      expectedCollapsedCount: 0,
    },
    {
      totalEntries: 1,
      displayLimit: 4,
      expectedVisibleCount: 1,
      expectedCollapsedCount: 0,
    },
    {
      totalEntries: 4,
      displayLimit: 4,
      expectedVisibleCount: 4,
      expectedCollapsedCount: 0,
    },
    {
      totalEntries: 5,
      displayLimit: 4,
      expectedVisibleCount: 4,
      expectedCollapsedCount: 1,
    },
    {
      totalEntries: 6,
      displayLimit: 4,
      expectedVisibleCount: 4,
      expectedCollapsedCount: 2,
    },
    {
      totalEntries: 3,
      displayLimit: 2,
      expectedVisibleCount: 2,
      expectedCollapsedCount: 1,
    },
  ])(
    'splits $totalEntries entries into $expectedVisibleCount visible and $expectedCollapsedCount collapsed at displayLimit $displayLimit',
    ({
      totalEntries,
      displayLimit,
      expectedVisibleCount,
      expectedCollapsedCount,
    }) => {
      const entries = buildEntries(totalEntries);

      const result = splitActionToastStack(entries, displayLimit);

      expect(result.visibleEntries).toHaveLength(expectedVisibleCount);
      expect(result.collapsedEntries).toHaveLength(expectedCollapsedCount);
      expect(result.collapsedCount).toBe(expectedCollapsedCount);

      const expectedVisibleIds = entries
        .slice(totalEntries - expectedVisibleCount)
        .map((entry) => entry.id);
      const expectedCollapsedIds = entries
        .slice(0, expectedCollapsedCount)
        .map((entry) => entry.id);
      expect(result.visibleEntries.map((entry) => entry.id)).toEqual(
        expectedVisibleIds,
      );
      expect(result.collapsedEntries.map((entry) => entry.id)).toEqual(
        expectedCollapsedIds,
      );
    },
  );

  it('orders the newest entries ascending within visibleEntries, most recent last, regardless of input order', () => {
    const newest = { id: 'newest', createdAt: 500 };
    const secondNewest = { id: 'second-newest', createdAt: 400 };
    const thirdNewest = { id: 'third-newest', createdAt: 300 };
    const fourthNewest = { id: 'fourth-newest', createdAt: 200 };
    const oldest = { id: 'oldest', createdAt: 100 };
    const shuffledInput = [
      secondNewest,
      oldest,
      newest,
      fourthNewest,
      thirdNewest,
    ];

    const result = splitActionToastStack(shuffledInput, 4);

    expect(result.visibleEntries.map((entry) => entry.id)).toEqual([
      fourthNewest.id,
      thirdNewest.id,
      secondNewest.id,
      newest.id,
    ]);
    expect(result.collapsedEntries.map((entry) => entry.id)).toEqual([
      oldest.id,
    ]);
    expect(result.collapsedCount).toBe(1);
  });

  it('produces the same split whether the input arrives already sorted or in arbitrary order', () => {
    const sortedAscending = buildEntries(6);
    const shuffled = [
      sortedAscending[3],
      sortedAscending[0],
      sortedAscending[5],
      sortedAscending[1],
      sortedAscending[4],
      sortedAscending[2],
    ];

    const resultFromSorted = splitActionToastStack(sortedAscending, 4);
    const resultFromShuffled = splitActionToastStack(shuffled, 4);

    expect(resultFromShuffled.visibleEntries.map((entry) => entry.id)).toEqual(
      resultFromSorted.visibleEntries.map((entry) => entry.id),
    );
    expect(
      resultFromShuffled.collapsedEntries.map((entry) => entry.id),
    ).toEqual(resultFromSorted.collapsedEntries.map((entry) => entry.id));
    expect(resultFromShuffled.collapsedCount).toBe(
      resultFromSorted.collapsedCount,
    );
  });

  it('does not mutate the input array, either its order or its contents', () => {
    const entries = [
      { id: 'c', createdAt: 3 },
      { id: 'a', createdAt: 1 },
      { id: 'b', createdAt: 2 },
    ];
    const entriesBeforeCall = entries.map((entry) => ({ ...entry }));

    splitActionToastStack(entries, 4);

    expect(entries).toEqual(entriesBeforeCall);
    expect(entries.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
  });

  it('returns a visibleEntries array that is not the same array reference as the input', () => {
    const entries = buildEntries(2);

    const result = splitActionToastStack(entries, 4);

    expect(result.visibleEntries).not.toBe(entries);
  });
});
