import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemInteractiveLiveSessionTranscriptResolver } from './FileSystemInteractiveLiveSessionTranscriptResolver';

describe('FileSystemInteractiveLiveSessionTranscriptResolver', () => {
  let configRoot: string;
  let sharedProjectsDirectory: string;

  beforeEach(() => {
    configRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'interactive-transcript-'),
    );
    sharedProjectsDirectory = path.join(configRoot, 'shared', 'projects');
  });

  afterEach(() => {
    fs.rmSync(configRoot, { force: true, recursive: true });
  });

  const writeTranscript = (params: {
    projectsDirectory: string;
    cwdSlug: string;
    sessionId: string;
    mtimeEpochSeconds?: number;
  }): string => {
    const projectDirectory = path.join(
      params.projectsDirectory,
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

  it('resolves a resume-case transcript by config dir and session id', () => {
    const configDir = path.join(configRoot, 'workbench');
    const filePath = writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'wb-uuid',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        candidateSessionIds: ['wb-uuid'],
        configDir,
      },
    ]);

    expect(result.get('workbench')).toBe(filePath);
  });

  it('resolves a rotated-id transcript via a later candidate session id', () => {
    const configDir = path.join(configRoot, 'workbench');
    const rotatedPath = writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'rotated-uuid',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'launch-uuid',
        candidateSessionIds: ['rotated-uuid', 'launch-uuid'],
        configDir,
      },
    ]);

    expect(result.get('workbench')).toBe(rotatedPath);
  });

  it('resolves a transcript that lives under the shared projects directory', () => {
    const configDir = path.join(configRoot, 'workbench');
    const sharedPath = writeTranscript({
      projectsDirectory: sharedProjectsDirectory,
      cwdSlug: '-home-user',
      sessionId: 'rotated-uuid',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'launch-uuid',
        candidateSessionIds: ['rotated-uuid', 'launch-uuid'],
        configDir,
      },
    ]);

    expect(result.get('workbench')).toBe(sharedPath);
  });

  it('prefers the most recently modified match across both projects roots', () => {
    const configDir = path.join(configRoot, 'workbench');
    writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'rotated-uuid',
      mtimeEpochSeconds: 1700000000,
    });
    const newerPath = writeTranscript({
      projectsDirectory: sharedProjectsDirectory,
      cwdSlug: '-home-user',
      sessionId: 'rotated-uuid',
      mtimeEpochSeconds: 1700000500,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'launch-uuid',
        candidateSessionIds: ['rotated-uuid', 'launch-uuid'],
        configDir,
      },
    ]);

    expect(result.get('workbench')).toBe(newerPath);
  });

  it('resolves several sessions in one call', () => {
    const workbenchConfig = path.join(configRoot, 'workbench');
    const controlRoomConfig = path.join(configRoot, 'control-room');
    const workbenchPath = writeTranscript({
      projectsDirectory: path.join(workbenchConfig, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'wb-uuid',
    });
    const controlRoomPath = writeTranscript({
      projectsDirectory: path.join(controlRoomConfig, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'cr-uuid',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        candidateSessionIds: ['wb-uuid'],
        configDir: workbenchConfig,
      },
      {
        sessionName: 'control-room',
        sessionId: 'cr-uuid',
        candidateSessionIds: ['cr-uuid'],
        configDir: controlRoomConfig,
      },
    ]);

    expect(result.get('workbench')).toBe(workbenchPath);
    expect(result.get('control-room')).toBe(controlRoomPath);
  });

  it('omits a session whose transcript file is absent in both roots', () => {
    const configDir = path.join(configRoot, 'workbench');
    fs.mkdirSync(path.join(configDir, 'projects', '-home-user'), {
      recursive: true,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'missing-uuid',
        candidateSessionIds: ['missing-uuid'],
        configDir,
      },
    ]);

    expect(result.has('workbench')).toBe(false);
  });

  it('omits a session when neither projects directory exists', () => {
    const configDir = path.join(configRoot, 'workbench');
    fs.mkdirSync(configDir, { recursive: true });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        candidateSessionIds: ['wb-uuid'],
        configDir,
      },
    ]);

    expect(result.has('workbench')).toBe(false);
  });

  it('returns an empty map for an empty session list', () => {
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([]);

    expect(result.size).toBe(0);
  });
});
