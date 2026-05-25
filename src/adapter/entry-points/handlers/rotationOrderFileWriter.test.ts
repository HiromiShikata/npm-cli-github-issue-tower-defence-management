import fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeRotationOrderFile } from './rotationOrderFileWriter';
import type { RotationOrderEntry } from '../../../domain/usecases/StartPreparationUseCase';

jest.mock('fs');

const TOKEN_A = 'sk-ant-secret-token-a-value';
const TOKEN_B = 'sk-ant-secret-token-b-value';

describe('writeRotationOrderFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fs.mkdirSync).mockReturnValue(undefined);
    jest.mocked(fs.writeFileSync).mockReturnValue(undefined);
    jest.mocked(fs.renameSync).mockReturnValue(undefined);
  });

  it('writes rotation order entries sorted selected-first to the stable path under XDG_CACHE_HOME', () => {
    const originalXdg = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = '/custom/cache';

    const entries: RotationOrderEntry[] = [
      {
        name: 'personal-1',
        fiveHourUtilization: 0.2,
        blocked: false,
        rejected: false,
        thresholdExcluded: false,
      },
    ];

    writeRotationOrderFile(entries);

    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      '/custom/cache/tdpm/rotation-order.json.tmp',
      expect.any(String),
    );
    expect(jest.mocked(fs.renameSync)).toHaveBeenCalledWith(
      '/custom/cache/tdpm/rotation-order.json.tmp',
      '/custom/cache/tdpm/rotation-order.json',
    );

    process.env.XDG_CACHE_HOME = originalXdg;
  });

  it('falls back to ~/.cache/tdpm/rotation-order.json when XDG_CACHE_HOME is unset', () => {
    const originalXdg = process.env.XDG_CACHE_HOME;
    delete process.env.XDG_CACHE_HOME;

    const home = os.homedir();
    const expectedPath = path.join(
      home,
      '.cache',
      'tdpm',
      'rotation-order.json',
    );

    writeRotationOrderFile([]);

    expect(jest.mocked(fs.renameSync)).toHaveBeenCalledWith(
      `${expectedPath}.tmp`,
      expectedPath,
    );

    process.env.XDG_CACHE_HOME = originalXdg;
  });

  it('includes name, fiveHourUtilization, blocked, rejected, and thresholdExcluded in output', () => {
    process.env.XDG_CACHE_HOME = '/cache';

    const entries: RotationOrderEntry[] = [
      {
        name: 'personal-1',
        fiveHourUtilization: 0.3,
        blocked: false,
        rejected: false,
        thresholdExcluded: false,
      },
      {
        name: 'personal-2',
        fiveHourUtilization: 0.95,
        blocked: false,
        rejected: false,
        thresholdExcluded: true,
      },
    ];

    writeRotationOrderFile(entries);

    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"name":"personal-1"'),
    );
    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"name":"personal-2"'),
    );
    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"fiveHourUtilization":0.3'),
    );
    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"thresholdExcluded":true'),
    );

    delete process.env.XDG_CACHE_HOME;
  });

  it('does not write raw token values to the output file', () => {
    process.env.XDG_CACHE_HOME = '/cache';

    const entries: RotationOrderEntry[] = [
      {
        name: 'personal-1',
        fiveHourUtilization: 0.1,
        blocked: false,
        rejected: false,
        thresholdExcluded: false,
      },
    ];

    writeRotationOrderFile(entries);

    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringContaining(TOKEN_A),
    );
    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringContaining(TOKEN_B),
    );
    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringContaining('sk-ant-'),
    );

    delete process.env.XDG_CACHE_HOME;
  });

  it('writes atomically: mkdirSync before writeFileSync before renameSync', () => {
    process.env.XDG_CACHE_HOME = '/cache';

    const callOrder: string[] = [];
    jest.mocked(fs.mkdirSync).mockImplementation((): undefined => {
      callOrder.push('mkdir');
      return undefined;
    });
    jest.mocked(fs.writeFileSync).mockImplementation((): void => {
      callOrder.push('write');
    });
    jest.mocked(fs.renameSync).mockImplementation((): void => {
      callOrder.push('rename');
    });

    writeRotationOrderFile([]);

    expect(callOrder).toEqual(['mkdir', 'write', 'rename']);

    delete process.env.XDG_CACHE_HOME;
  });

  it('writes an empty array when no rotation entries are provided', () => {
    process.env.XDG_CACHE_HOME = '/cache';

    writeRotationOrderFile([]);

    expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.any(String),
      '[]',
    );

    delete process.env.XDG_CACHE_HOME;
  });
});
