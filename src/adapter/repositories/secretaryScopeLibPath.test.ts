import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('fs', () => {
  const actualFs: typeof fs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(actualFs.existsSync),
  };
});
jest.mock('os', () => {
  const actualOs: typeof os = jest.requireActual('os');
  return {
    ...actualOs,
    homedir: jest.fn(actualOs.homedir),
  };
});

import { secretaryScopeLibPath } from './secretaryScopeLibPath';

describe('secretaryScopeLibPath', () => {
  const originalEnvironmentValue = process.env.CL_SCOPE_LIB_PATH;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnvironmentValue === undefined) {
      delete process.env.CL_SCOPE_LIB_PATH;
    } else {
      process.env.CL_SCOPE_LIB_PATH = originalEnvironmentValue;
    }
  });

  it('returns the CL_SCOPE_LIB_PATH value when the environment variable is set and that path exists', () => {
    const explicitPath = '/tmp/fake-secretary-checkout/env-cl-scope-lib.sh';
    process.env.CL_SCOPE_LIB_PATH = explicitPath;
    jest
      .mocked(os.homedir)
      .mockReturnValue('/home/fake-user-for-env-present-existing');
    jest
      .mocked(fs.existsSync)
      .mockImplementation((candidate) => candidate === explicitPath);

    expect(secretaryScopeLibPath()).toBe(explicitPath);
  });

  it('falls back to the default path under the home directory when CL_SCOPE_LIB_PATH is set but that path does not exist', () => {
    const missingExplicitPath =
      '/tmp/fake-secretary-checkout/missing-env-cl-scope-lib.sh';
    process.env.CL_SCOPE_LIB_PATH = missingExplicitPath;
    const fakeHomeDirectory = '/home/fake-user-for-env-present-missing';
    jest.mocked(os.homedir).mockReturnValue(fakeHomeDirectory);
    const defaultPath = path.join(
      fakeHomeDirectory,
      'git',
      'secretary',
      'machine',
      'sk',
      'sh',
      'cl-scope-lib.sh',
    );
    jest
      .mocked(fs.existsSync)
      .mockImplementation((candidate) => candidate === defaultPath);

    expect(secretaryScopeLibPath()).toBe(defaultPath);
  });

  it('returns the default path under the home directory when CL_SCOPE_LIB_PATH is absent and that default path exists', () => {
    delete process.env.CL_SCOPE_LIB_PATH;
    const fakeHomeDirectory = '/home/fake-user-for-env-absent-existing';
    jest.mocked(os.homedir).mockReturnValue(fakeHomeDirectory);
    const defaultPath = path.join(
      fakeHomeDirectory,
      'git',
      'secretary',
      'machine',
      'sk',
      'sh',
      'cl-scope-lib.sh',
    );
    jest
      .mocked(fs.existsSync)
      .mockImplementation((candidate) => candidate === defaultPath);

    expect(secretaryScopeLibPath()).toBe(defaultPath);
  });

  it('returns null when CL_SCOPE_LIB_PATH is absent and the default path under the home directory does not exist', () => {
    delete process.env.CL_SCOPE_LIB_PATH;
    jest
      .mocked(os.homedir)
      .mockReturnValue('/home/fake-user-for-env-absent-missing');
    jest.mocked(fs.existsSync).mockReturnValue(false);

    expect(secretaryScopeLibPath()).toBeNull();
  });
});
