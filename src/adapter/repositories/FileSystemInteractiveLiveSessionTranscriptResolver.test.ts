import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemInteractiveLiveSessionTranscriptResolver } from './FileSystemInteractiveLiveSessionTranscriptResolver';
import { TranscriptOwnerCallStatusProvider } from './TranscriptOwnerCallStatusProvider';

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

  const writeSubagentTranscript = (params: {
    projectsDirectory: string;
    cwdSlug: string;
    parentSessionId: string;
    agentId: string;
    mtimeEpochSeconds?: number;
  }): string => {
    const subagentDirectory = path.join(
      params.projectsDirectory,
      params.cwdSlug,
      params.parentSessionId,
      'subagents',
    );
    fs.mkdirSync(subagentDirectory, { recursive: true });
    const filePath = path.join(
      subagentDirectory,
      `agent-${params.agentId}.jsonl`,
    );
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

  it('resolves a non-resume session to the descendant id file when the own launch id file is absent', () => {
    const configDir = path.join(configRoot, 'non-resume');
    const harnessPath = writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'harness-id',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'non-resume',
        sessionId: 'launch-id',
        candidateSessionIds: ['launch-id', 'harness-id'],
        configDir,
      },
    ]);

    expect(result.get('non-resume')).toBe(harnessPath);
  });

  it('resolves a resume session to the own id file when descendants share the own id', () => {
    const configDir = path.join(configRoot, 'resume');
    const ownPath = writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'own-id',
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'resume',
        sessionId: 'own-id',
        candidateSessionIds: ['own-id', 'own-id'],
        configDir,
      },
    ]);

    expect(result.get('resume')).toBe(ownPath);
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

  it('selects the parent transcript over a newer descendant id transcript', () => {
    const configDir = path.join(configRoot, 'with-subagent');
    const parentPath = writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'parent-id',
      mtimeEpochSeconds: 1700000000,
    });
    writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'subagent-id',
      mtimeEpochSeconds: 1700000500,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'with-subagent',
        sessionId: 'parent-id',
        candidateSessionIds: ['parent-id', 'subagent-id'],
        configDir,
      },
    ]);

    expect(result.get('with-subagent')).toBe(parentPath);
  });

  it('selects the rotated parent transcript over a newer descendant id transcript', () => {
    const configDir = path.join(configRoot, 'rotated-with-subagent');
    const rotatedParentPath = writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'rotated-id',
      mtimeEpochSeconds: 1700000000,
    });
    writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'subagent-id',
      mtimeEpochSeconds: 1700000500,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'rotated-with-subagent',
        sessionId: 'launch-id',
        candidateSessionIds: ['rotated-id', 'launch-id', 'subagent-id'],
        configDir,
      },
    ]);

    expect(result.get('rotated-with-subagent')).toBe(rotatedParentPath);
  });

  it('selects the parent transcript and never a newer subagent transcript nested under subagents', () => {
    const configDir = path.join(configRoot, 'subagent-nested');
    const parentPath = writeTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      sessionId: 'parent-id',
      mtimeEpochSeconds: 1700000000,
    });
    const subagentPath = writeSubagentTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      parentSessionId: 'parent-id',
      agentId: 'worker',
      mtimeEpochSeconds: 1700000500,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'subagent-nested',
        sessionId: 'parent-id',
        candidateSessionIds: ['parent-id', 'subagent-id'],
        configDir,
      },
    ]);

    expect(result.get('subagent-nested')).toBe(parentPath);
    expect(result.get('subagent-nested')).not.toBe(subagentPath);
  });

  it('omits a session whose only transcript is nested under a subagents directory', () => {
    const configDir = path.join(configRoot, 'subagent-only');
    writeSubagentTranscript({
      projectsDirectory: path.join(configDir, 'projects'),
      cwdSlug: '-home-user',
      parentSessionId: 'parent-id',
      agentId: 'worker',
      mtimeEpochSeconds: 1700000500,
    });
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );

    const result = resolver.resolveTranscriptPaths([
      {
        sessionName: 'subagent-only',
        sessionId: 'parent-id',
        candidateSessionIds: ['parent-id', 'subagent-id'],
        configDir,
      },
    ]);

    expect(result.has('subagent-only')).toBe(false);
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

describe('parent transcript resolution feeding owner-call detection', () => {
  let configRoot: string;
  let sharedProjectsDirectory: string;

  beforeEach(() => {
    configRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'interactive-transcript-ownercall-'),
    );
    sharedProjectsDirectory = path.join(configRoot, 'shared', 'projects');
  });

  afterEach(() => {
    fs.rmSync(configRoot, { force: true, recursive: true });
  });

  const ownerCallMarker = '<<OWNER_CALL>>';

  const writeJsonlTranscript = (
    filePath: string,
    lines: object[],
    mtimeEpochSeconds: number,
  ): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
    fs.utimesSync(filePath, mtimeEpochSeconds, mtimeEpochSeconds);
  };

  it('identifies a session running a subagent as waiting on the owner', () => {
    const configDir = path.join(configRoot, 'waiting');
    const projectDirectory = path.join(configDir, 'projects', '-home-user');
    writeJsonlTranscript(
      path.join(projectDirectory, 'parent-id.jsonl'),
      [
        {
          type: 'assistant',
          timestamp: '2026-01-01T00:00:00.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: `${ownerCallMarker} please decide` },
            ],
          },
        },
      ],
      1700000000,
    );
    writeJsonlTranscript(
      path.join(
        projectDirectory,
        'parent-id',
        'subagents',
        'agent-worker.jsonl',
      ),
      [
        {
          type: 'assistant',
          timestamp: '2026-01-01T00:05:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'subagent progress' }],
          },
        },
      ],
      1700000500,
    );
    const resolver = new FileSystemInteractiveLiveSessionTranscriptResolver(
      sharedProjectsDirectory,
    );
    const ownerCallStatusProvider = new TranscriptOwnerCallStatusProvider(
      ownerCallMarker,
    );

    const transcriptPaths = resolver.resolveTranscriptPaths([
      {
        sessionName: 'waiting',
        sessionId: 'parent-id',
        candidateSessionIds: ['parent-id', 'subagent-id'],
        configDir,
      },
    ]);

    return ownerCallStatusProvider
      .listUnansweredOwnerCallEpochSecondsBySessionName(transcriptPaths)
      .then((waiting) => {
        expect(waiting.has('waiting')).toBe(true);
      });
  });
});
