import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadConfigFile, mergeConfigs } from './projectConfig';

describe('workerHostsPath configuration', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-worker-hosts-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parses workerHostsPath from the config file', () => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(
      filePath,
      "projectName: 'demo'\nworkerHostsPath: '/tmp/worker-hosts.yml'\n",
    );
    expect(loadConfigFile(filePath).workerHostsPath).toBe(
      '/tmp/worker-hosts.yml',
    );
  });

  it('merges the CLI workerHostsPath over the config file value', () => {
    expect(
      mergeConfigs(
        { workerHostsPath: '/tmp/config-hosts.yml' },
        { workerHostsPath: '/tmp/cli-hosts.yml' },
        {},
      ).workerHostsPath,
    ).toBe('/tmp/cli-hosts.yml');
  });

  it('falls back to the config file workerHostsPath', () => {
    expect(
      mergeConfigs({ workerHostsPath: '/tmp/config-hosts.yml' }, {}, {})
        .workerHostsPath,
    ).toBe('/tmp/config-hosts.yml');
  });
});
