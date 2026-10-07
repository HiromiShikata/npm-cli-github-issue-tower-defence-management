import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { secretaryScopeLibPath } from './secretaryScopeLibPath';

describe('secretaryScopeLibPath', () => {
  const originalEnvironmentValue = process.env.CL_SCOPE_LIB_PATH;
  let homedirSpy: jest.SpyInstance<string, []>;
  let existsSyncSpy: jest.SpyInstance<boolean, [fs.PathLike]>;

  beforeEach(() => {
    homedirSpy = jest.spyOn(os, 'homedir');
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    if (originalEnvironmentValue === undefined) {
      delete process.env.CL_SCOPE_LIB_PATH;
    } else {
      process.env.CL_SCOPE_LIB_PATH = originalEnvironmentValue;
    }
    homedirSpy.mockRestore();
    existsSyncSpy.mockRestore();
  });

  it('returns the CL_SCOPE_LIB_PATH value when the environment variable is set and that path exists', () => {
    const explicitPath = '/tmp/fake-secretary-checkout/env-cl-scope-lib.sh';
    process.env.CL_SCOPE_LIB_PATH = explicitPath;
    homedirSpy.mockReturnValue('/home/fake-user-for-env-present-existing');
    existsSyncSpy.mockImplementation(
      (candidate) => candidate === explicitPath,
    );

    expect(secretaryScopeLibPath()).toBe(explicitPath);
  });

  it('falls back to the default path under the home directory when CL_SCOPE_LIB_PATH is set but that path does not exist', () => {
    const missingExplicitPath =
      '/tmp/fake-secretary-checkout/missing-env-cl-scope-lib.sh';
    process.env.CL_SCOPE_LIB_PATH = missingExplicitPath;
    const fakeHomeDirectory = '/home/fake-user-for-env-present-missing';
    homedirSpy.mockReturnValue(fakeHomeDirectory);
    const defaultPath = path.join(
      fakeHomeDirectory,
      'git',
      'secretary',
      'machine',
      'sk',
      'sh',
      'cl-scope-lib.sh',
    );
    existsSyncSpy.mockImplementation((candidate) => candidate === defaultPath);

    expect(secretaryScopeLibPath()).toBe(defaultPath);
  });

  it('returns the default path under the home directory when CL_SCOPE_LIB_PATH is absent and that default path exists', () => {
    delete process.env.CL_SCOPE_LIB_PATH;
    const fakeHomeDirectory = '/home/fake-user-for-env-absent-existing';
    homedirSpy.mockReturnValue(fakeHomeDirectory);
    const defaultPath = path.join(
      fakeHomeDirectory,
      'git',
      'secretary',
      'machine',
      'sk',
      'sh',
      'cl-scope-lib.sh',
    );
    existsSyncSpy.mockImplementation((candidate) => candidate === defaultPath);

    expect(secretaryScopeLibPath()).toBe(defaultPath);
  });

  it('returns null when CL_SCOPE_LIB_PATH is absent and the default path under the home directory does not exist', () => {
    delete process.env.CL_SCOPE_LIB_PATH;
    homedirSpy.mockReturnValue('/home/fake-user-for-env-absent-missing');
    existsSyncSpy.mockReturnValue(false);

    expect(secretaryScopeLibPath()).toBeNull();
  });
});
