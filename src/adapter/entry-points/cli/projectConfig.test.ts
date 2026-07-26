import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadConfigFile, mergeConfigs } from './projectConfig';

describe('loadConfigFile disks', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-config-disks-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (content: string): string => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  it('parses a disks list of title and mountpoint pairs', () => {
    const filePath = writeConfig(
      [
        "projectName: 'demo'",
        'disks:',
        "  - title: 'D'",
        "    mountpoint: '/'",
        "  - title: 'S'",
        "    mountpoint: '/mountpoint-secondary'",
      ].join('\n'),
    );
    expect(loadConfigFile(filePath).disks).toEqual([
      { title: 'D', mountpoint: '/' },
      { title: 'S', mountpoint: '/mountpoint-secondary' },
    ]);
  });

  it('yields undefined disks when the key is absent', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(loadConfigFile(filePath).disks).toBeUndefined();
  });

  it('yields undefined disks when an entry is missing required fields', () => {
    const filePath = writeConfig(
      ['disks:', "  - title: 'D'"].join('\n') + '\n',
    );
    expect(loadConfigFile(filePath).disks).toBeUndefined();
  });
});

describe('mergeConfigs disks', () => {
  it('prefers cli override disks over the config file disks', () => {
    const merged = mergeConfigs(
      { disks: [{ title: 'D', mountpoint: '/' }] },
      { disks: [{ title: 'C', mountpoint: '/cli' }] },
      {},
    );
    expect(merged.disks).toEqual([{ title: 'C', mountpoint: '/cli' }]);
  });

  it('falls back to the config file disks when no cli override is present', () => {
    const merged = mergeConfigs(
      { disks: [{ title: 'D', mountpoint: '/' }] },
      {},
      {},
    );
    expect(merged.disks).toEqual([{ title: 'D', mountpoint: '/' }]);
  });

  it('yields undefined disks when neither source provides them', () => {
    expect(mergeConfigs({}, {}, {}).disks).toBeUndefined();
  });
});
