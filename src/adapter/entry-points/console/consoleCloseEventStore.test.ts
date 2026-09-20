import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  appendCloseEvent,
  appendCloseEventCount,
  countCloseEvents,
} from './consoleCloseEventStore';

describe('consoleCloseEventStore', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'close-events-'));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  describe('countCloseEvents', () => {
    it('returns zero counts when no events have been recorded', () => {
      const nowMs = 1_000_000_000_000;
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 0,
        h3: 0,
        h5: 0,
      });
    });

    it('counts a recent event as 1 across all windows at 30 min decay', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 30 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 1,
        h3: 1,
        h5: 1,
      });
    });

    it('event at 90 min appears in h3 and h5 but not h1', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 90 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 0,
        h3: 1,
        h5: 1,
      });
    });

    it('event aged 4h contributes 0 to all windows', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 0,
        h3: 0,
        h5: 0,
      });
    });

    it('event at exactly 1h decays to 0 in h1 window', () => {
      const nowMs = 1_000_000_000_000;
      const oneHourMs = 60 * 60 * 1000;
      appendCloseEvent(baseDir, 'acme', nowMs - oneHourMs);
      const counts = countCloseEvents(baseDir, 'acme', nowMs);
      expect(counts.h1).toBe(0);
      expect(counts.h3).toBe(1);
      expect(counts.h5).toBe(1);
    });

    it('sums EMA contributions from events spread across windows', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 20 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 90 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 1,
        h3: 2,
        h5: 2,
      });
    });

    it('keeps events per project isolated', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 10 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs).h1).toBe(1);
      expect(countCloseEvents(baseDir, 'initech', nowMs).h1).toBe(0);
    });

    it('longer time constants accumulate more history giving h5 greater than h3 greater than h1', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 20 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 20 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 20 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 2 * 60 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 2 * 60 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 2 * 60 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 3,
        h3: 5,
        h5: 7,
      });
    });

    describe('EMA computation', () => {
      it('single event at nowMs contributes 1 to all three windows', () => {
        const nowMs = 1_000_000_000_000;
        appendCloseEvent(baseDir, 'acme', nowMs);
        expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
          h1: 1,
          h3: 1,
          h5: 1,
        });
      });

      it('event aged 2h appears in h3 and h5 but not h1', () => {
        const nowMs = 1_000_000_000_000;
        appendCloseEvent(baseDir, 'acme', nowMs - 2 * 60 * 60 * 1000);
        const counts = countCloseEvents(baseDir, 'acme', nowMs);
        expect(counts.h1).toBe(0);
        expect(counts.h3).toBe(1);
        expect(counts.h5).toBe(1);
      });
    });
  });

  describe('appendCloseEvent', () => {
    it('creates the project directory when it does not exist', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'new-project', nowMs);
      expect(countCloseEvents(baseDir, 'new-project', nowMs).h1).toBe(1);
    });

    it('prunes events older than 15 hours on append', () => {
      const baseMs = 1_000_000_000_000;
      const fifteenHoursMs = 15 * 60 * 60 * 1000;
      appendCloseEvent(baseDir, 'acme', baseMs - fifteenHoursMs - 1);
      appendCloseEvent(baseDir, 'acme', baseMs);
      expect(countCloseEvents(baseDir, 'acme', baseMs).h1).toBe(1);
    });

    it('does not leave a tmp file behind after writing', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs);
      const dir = path.join(baseDir, 'acme');
      const entries = fs.readdirSync(dir);
      expect(entries.some((e) => e.endsWith('.tmp'))).toBe(false);
    });

    it('accumulates multiple events with EMA decay applied per event age', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 30 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 10 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 5 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs).h1).toBe(2);
    });
  });

  describe('appendCloseEventCount', () => {
    it('adds the specified number of events at nowMs', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEventCount(baseDir, 'acme', 3, nowMs);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 3,
        h3: 3,
        h5: 3,
      });
    });

    it('is a no-op when count is zero', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEventCount(baseDir, 'acme', 0, nowMs);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 0,
        h3: 0,
        h5: 0,
      });
    });

    it('prunes events older than 15 hours before adding new ones', () => {
      const baseMs = 1_000_000_000_000;
      const fifteenHoursMs = 15 * 60 * 60 * 1000;
      appendCloseEvent(baseDir, 'acme', baseMs - fifteenHoursMs - 1);
      appendCloseEventCount(baseDir, 'acme', 2, baseMs);
      expect(countCloseEvents(baseDir, 'acme', baseMs).h1).toBe(2);
    });

    it('accumulates with existing events', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 90 * 60 * 1000);
      appendCloseEventCount(baseDir, 'acme', 2, nowMs);
      expect(countCloseEvents(baseDir, 'acme', nowMs).h1).toBe(2);
      expect(countCloseEvents(baseDir, 'acme', nowMs).h3).toBe(3);
    });
  });
});
