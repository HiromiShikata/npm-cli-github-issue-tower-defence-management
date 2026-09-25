import {
  airplaneSnapshotMerge,
  type AirplaneSnapshotForMerge,
} from './AirplaneSnapshotMergeUseCase';

const makeSnapshot = (
  overrides: Partial<AirplaneSnapshotForMerge> = {},
): AirplaneSnapshotForMerge => ({
  capturedAt: '2026-01-01T00:00:00Z',
  tabs: {},
  items: {},
  failures: [],
  ...overrides,
});

describe('airplaneSnapshotMerge', () => {
  it('returns error when no items succeeded and failures exist', () => {
    const result = airplaneSnapshotMerge(
      null,
      makeSnapshot({
        items: {},
        failures: ['https://github.com/o/r/issues/1'],
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.failures).toContain('https://github.com/o/r/issues/1');
    }
  });

  it('returns on with snapshot when all items succeed with no previous', () => {
    const newResult = makeSnapshot({
      capturedAt: '2026-02-01T00:00:00Z',
      items: { 'https://github.com/o/r/issues/1': { body: 'body' } },
      failures: [],
    });
    const result = airplaneSnapshotMerge(null, newResult);
    expect(result.status).toBe('on');
    if (result.status === 'on') {
      expect(
        result.snapshot.items['https://github.com/o/r/issues/1'],
      ).toBeDefined();
      expect(result.snapshot.failures).toEqual([]);
      expect(result.snapshot.capturedAt).toBe('2026-02-01T00:00:00Z');
    }
  });

  it('returns on and merges new items over previous when partial success', () => {
    const previous = makeSnapshot({
      capturedAt: '2026-01-01T00:00:00Z',
      items: {
        'https://github.com/o/r/issues/1': { body: 'old-1' },
        'https://github.com/o/r/issues/2': { body: 'old-2' },
      },
    });
    const newResult = makeSnapshot({
      capturedAt: '2026-02-01T00:00:00Z',
      items: { 'https://github.com/o/r/issues/2': { body: 'new-2' } },
      failures: ['https://github.com/o/r/issues/3'],
    });
    const result = airplaneSnapshotMerge(previous, newResult);
    expect(result.status).toBe('on');
    if (result.status === 'on') {
      expect(result.snapshot.items['https://github.com/o/r/issues/1']).toEqual({
        body: 'old-1',
      });
      expect(result.snapshot.items['https://github.com/o/r/issues/2']).toEqual({
        body: 'new-2',
      });
      expect(result.snapshot.failures).toContain(
        'https://github.com/o/r/issues/3',
      );
      expect(result.snapshot.capturedAt).toBe('2026-02-01T00:00:00Z');
    }
  });

  it('merges tabs from previous and new, new overrides on conflict', () => {
    const previous = makeSnapshot({
      tabs: { pj1: { 'queued': { items: [] } } },
      items: { 'https://github.com/o/r/issues/1': { body: 'body' } },
    });
    const newResult = makeSnapshot({
      tabs: { pj2: { prs: { items: [] } } },
      items: { 'https://github.com/o/r/issues/2': { body: 'body2' } },
    });
    const result = airplaneSnapshotMerge(previous, newResult);
    expect(result.status).toBe('on');
    if (result.status === 'on') {
      expect(result.snapshot.tabs['pj1']).toBeDefined();
      expect(result.snapshot.tabs['pj2']).toBeDefined();
    }
  });

  it('returns on with full success when merged with previous', () => {
    const previous = makeSnapshot({
      items: { 'https://github.com/o/r/issues/1': { body: 'old' } },
    });
    const newResult = makeSnapshot({
      capturedAt: '2026-03-01T00:00:00Z',
      items: {
        'https://github.com/o/r/issues/1': { body: 'fresh' },
        'https://github.com/o/r/issues/2': { body: 'new' },
      },
      failures: [],
    });
    const result = airplaneSnapshotMerge(previous, newResult);
    expect(result.status).toBe('on');
    if (result.status === 'on') {
      expect(result.snapshot.items['https://github.com/o/r/issues/1']).toEqual({
        body: 'fresh',
      });
      expect(result.snapshot.items['https://github.com/o/r/issues/2']).toEqual({
        body: 'new',
      });
      expect(result.snapshot.failures).toEqual([]);
    }
  });

  it('returns on when both items and failures are empty', () => {
    const result = airplaneSnapshotMerge(
      null,
      makeSnapshot({ items: {}, failures: [] }),
    );
    expect(result.status).toBe('on');
  });

  it('preserves failures from newResult in the merged snapshot', () => {
    const previous = makeSnapshot({
      items: { 'https://github.com/o/r/issues/1': { body: 'body' } },
    });
    const newResult = makeSnapshot({
      items: { 'https://github.com/o/r/issues/2': { body: 'body2' } },
      failures: ['https://github.com/o/r/issues/3'],
    });
    const result = airplaneSnapshotMerge(previous, newResult);
    expect(result.status).toBe('on');
    if (result.status === 'on') {
      expect(result.snapshot.failures).toEqual([
        'https://github.com/o/r/issues/3',
      ]);
    }
  });
});
