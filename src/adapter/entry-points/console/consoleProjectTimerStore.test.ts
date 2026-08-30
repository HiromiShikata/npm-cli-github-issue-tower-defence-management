import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  deleteProjectTimer,
  readProjectTimer,
  writeProjectTimer,
} from './consoleProjectTimerStore';

describe('consoleProjectTimerStore', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-timer-'));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  describe('readProjectTimer', () => {
    it('returns null when timer file does not exist', () => {
      expect(readProjectTimer(baseDir, 'acme')).toBeNull();
    });

    it('returns null when file content is invalid JSON', () => {
      const dir = path.join(baseDir, 'acme');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'timer.json'), 'not-json');
      expect(readProjectTimer(baseDir, 'acme')).toBeNull();
    });

    it('returns null when startedAt is missing', () => {
      const dir = path.join(baseDir, 'acme');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'timer.json'),
        JSON.stringify({ durationSeconds: 1800 }),
      );
      expect(readProjectTimer(baseDir, 'acme')).toBeNull();
    });

    it('returns null when durationSeconds is not a positive number', () => {
      const dir = path.join(baseDir, 'acme');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'timer.json'),
        JSON.stringify({ startedAt: '2026-08-30T00:00:00.000Z', durationSeconds: 0 }),
      );
      expect(readProjectTimer(baseDir, 'acme')).toBeNull();
    });

    it('returns valid timer data when file is well-formed', () => {
      const timer = {
        startedAt: '2026-08-30T00:00:00.000Z',
        durationSeconds: 1800,
      };
      writeProjectTimer(baseDir, 'acme', timer);
      expect(readProjectTimer(baseDir, 'acme')).toEqual(timer);
    });
  });

  describe('writeProjectTimer', () => {
    it('creates the directory and writes timer atomically', () => {
      const timer = {
        startedAt: '2026-08-30T10:00:00.000Z',
        durationSeconds: 3600,
      };
      writeProjectTimer(baseDir, 'acme', timer);
      const filePath = path.join(baseDir, 'acme', 'timer.json');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(filePath, 'utf-8'))).toEqual(timer);
    });

    it('overwrites an existing timer file', () => {
      const first = { startedAt: '2026-08-30T10:00:00.000Z', durationSeconds: 1800 };
      const second = { startedAt: '2026-08-30T11:00:00.000Z', durationSeconds: 3600 };
      writeProjectTimer(baseDir, 'acme', first);
      writeProjectTimer(baseDir, 'acme', second);
      expect(readProjectTimer(baseDir, 'acme')).toEqual(second);
    });
  });

  describe('deleteProjectTimer', () => {
    it('removes an existing timer file', () => {
      const timer = { startedAt: '2026-08-30T10:00:00.000Z', durationSeconds: 1800 };
      writeProjectTimer(baseDir, 'acme', timer);
      deleteProjectTimer(baseDir, 'acme');
      expect(readProjectTimer(baseDir, 'acme')).toBeNull();
    });

    it('does not throw when timer file does not exist', () => {
      expect(() => deleteProjectTimer(baseDir, 'acme')).not.toThrow();
    });
  });
});
