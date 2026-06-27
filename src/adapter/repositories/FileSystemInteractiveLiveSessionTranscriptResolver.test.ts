import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemInteractiveLiveSessionTranscriptResolver } from './FileSystemInteractiveLiveSessionTranscriptResolver';

describe('FileSystemInteractiveLiveSessionTranscriptResolver', () => {
  let configRoot: string;

  beforeEach(() => {
    configRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'interactive-transcript-'),
    );
  });

  afterEach(() => {
    fs.rmSync(configRoot, { force: true, recursive: true });
  });

  const writeTranscript = (params: {
    configDir: string;
    cwdSlug: string;
    sessionId: string;
    mtimeEpochSeconds?: number;
  }): string => {
    const projectDirectory = path.join(
      params.configDir,
      'projects',
      params.cwdSlug,
    );
    fs.mkdirSync(projectDirectory, { recursive: true });
    const filePath = path.join(projectDirectory, `${params.sessionId}.jsonl`);
    fs.writeFileSync(filePath, '{"type":"custom-title"}', 'utf8');
    if (params.mtimeEpochSeconds !== undefined) {
      fs.utimesSync(
        filePath,
        params.mtimeEpochSeconds,
        params.mtimeEpochSeconds,
      );
    }
    return filePath;
  };

  it('resolves a transcript by config dir and session id for a plain-named session', () => {
    const configDir = path.join(configRoot, 'workbench');
    const filePath = writeTranscript({
      configDir,
      cwdSlug: '-home-user',
      sessionId: 'wb-uuid',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver();

    const result = resolver.resolveTranscriptPaths([
      { sessionName: 'workbench', sessionId: 'wb-uuid', configDir },
    ]);

    expect(result.get('workbench')).toBe(filePath);
  });

  it('chooses the most recently modified match across project directories', () => {
    const configDir = path.join(configRoot, 'workbench');
    writeTranscript({
      configDir,
      cwdSlug: '-home-user-old',
      sessionId: 'wb-uuid',
      mtimeEpochSeconds: 1700000000,
    });
    const newerPath = writeTranscript({
      configDir,
      cwdSlug: '-home-user-new',
      sessionId: 'wb-uuid',
      mtimeEpochSeconds: 1700000500,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver();

    const result = resolver.resolveTranscriptPaths([
      { sessionName: 'workbench', sessionId: 'wb-uuid', configDir },
    ]);

    expect(result.get('workbench')).toBe(newerPath);
  });

  it('resolves several sessions in one call', () => {
    const workbenchConfig = path.join(configRoot, 'workbench');
    const controlRoomConfig = path.join(configRoot, 'control-room');
    const workbenchPath = writeTranscript({
      configDir: workbenchConfig,
      cwdSlug: '-home-user',
      sessionId: 'wb-uuid',
    });
    const controlRoomPath = writeTranscript({
      configDir: controlRoomConfig,
      cwdSlug: '-home-user',
      sessionId: 'cr-uuid',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver();

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        configDir: workbenchConfig,
      },
      {
        sessionName: 'control-room',
        sessionId: 'cr-uuid',
        configDir: controlRoomConfig,
      },
    ]);

    expect(result.get('workbench')).toBe(workbenchPath);
    expect(result.get('control-room')).toBe(controlRoomPath);
  });

  it('omits a session whose transcript file is absent', () => {
    const configDir = path.join(configRoot, 'workbench');
    fs.mkdirSync(path.join(configDir, 'projects', '-home-user'), {
      recursive: true,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver();

    const result = resolver.resolveTranscriptPaths([
      { sessionName: 'workbench', sessionId: 'missing-uuid', configDir },
    ]);

    expect(result.has('workbench')).toBe(false);
  });

  it('omits a session whose config dir has no projects directory', () => {
    const configDir = path.join(configRoot, 'workbench');
    fs.mkdirSync(configDir, { recursive: true });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver();

    const result = resolver.resolveTranscriptPaths([
      { sessionName: 'workbench', sessionId: 'wb-uuid', configDir },
    ]);

    expect(result.has('workbench')).toBe(false);
  });

  it('returns an empty map for an empty session list', () => {
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver();

    const result = resolver.resolveTranscriptPaths([]);

    expect(result.size).toBe(0);
  });
});
