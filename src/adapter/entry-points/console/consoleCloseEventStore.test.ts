import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendCloseEvent, countCloseEvents } from './consoleCloseEventStore';

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

    it('counts an event within 1h in all three windows', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 30 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 1,
        h3: 1,
        h5: 1,
      });
    });

    it('counts an event older than 1h but within 3h only in the 3h and 5h windows', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 90 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 0,
        h3: 1,
        h5: 1,
      });
    });

    it('counts an event older than 3h but within 5h only in the 5h window', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 0,
        h3: 0,
        h5: 1,
      });
    });

    it('includes an event at exactly the 1h window boundary', () => {
      const nowMs = 1_000_000_000_000;
      const oneHourMs = 60 * 60 * 1000;
      appendCloseEvent(baseDir, 'acme', nowMs - oneHourMs);
      const counts = countCloseEvents(baseDir, 'acme', nowMs);
      expect(counts.h1).toBe(1);
    });

    it('counts events from multiple appends correctly across windows', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 20 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 90 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 4 * 60 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs)).toEqual({
        h1: 1,
        h3: 2,
        h5: 3,
      });
    });

    it('keeps events per project isolated', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 10 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs).h1).toBe(1);
      expect(countCloseEvents(baseDir, 'initech', nowMs).h1).toBe(0);
    });
  });

  describe('appendCloseEvent', () => {
    it('creates the project directory when it does not exist', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'new-project', nowMs);
      expect(countCloseEvents(baseDir, 'new-project', nowMs).h1).toBe(1);
    });

    it('prunes events older than 5 hours on append', () => {
      const baseMs = 1_000_000_000_000;
      const fiveHoursMs = 5 * 60 * 60 * 1000;
      appendCloseEvent(baseDir, 'acme', baseMs - fiveHoursMs - 1);
      appendCloseEvent(baseDir, 'acme', baseMs);
      expect(countCloseEvents(baseDir, 'acme', baseMs).h5).toBe(1);
    });

    it('does not leave a tmp file behind after writing', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs);
      const dir = path.join(baseDir, 'acme');
      const entries = fs.readdirSync(dir);
      expect(entries.some((e) => e.endsWith('.tmp'))).toBe(false);
    });

    it('accumulates multiple events in order', () => {
      const nowMs = 1_000_000_000_000;
      appendCloseEvent(baseDir, 'acme', nowMs - 30 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 10 * 60 * 1000);
      appendCloseEvent(baseDir, 'acme', nowMs - 5 * 60 * 1000);
      expect(countCloseEvents(baseDir, 'acme', nowMs).h1).toBe(3);
    });
  });
});
