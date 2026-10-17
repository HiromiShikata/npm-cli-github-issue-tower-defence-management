import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  FileSystemAgentDefinitionRepository,
  resolveAgentDefinitionsDirectoryPath,
} from './FileSystemAgentDefinitionRepository';

describe('FileSystemAgentDefinitionRepository', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'agent-definition-repository-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeAgentDefinitionFile = (
    agentName: string,
    content: string,
  ): void => {
    fs.writeFileSync(path.join(dir, `${agentName}.md`), content);
  };

  describe('getLlmModelName', () => {
    it('resolves the model field from valid YAML frontmatter', async () => {
      writeAgentDefinitionFile(
        'triager',
        [
          '---',
          'name: triager',
          'model: some-model',
          '---',
          '',
          '# Triager',
          'Body content.',
          '',
        ].join('\n'),
      );
      const repository = new FileSystemAgentDefinitionRepository(dir);

      const model = await repository.getLlmModelName('triager');

      expect(model).toBe('some-model');
    });

    it('resolves null when the frontmatter has no model field', async () => {
      writeAgentDefinitionFile(
        'triager',
        ['---', 'name: triager', '---', '', '# Triager', ''].join('\n'),
      );
      const repository = new FileSystemAgentDefinitionRepository(dir);

      const model = await repository.getLlmModelName('triager');

      expect(model).toBeNull();
    });

    it('resolves null without throwing when the agent definition file does not exist', async () => {
      const repository = new FileSystemAgentDefinitionRepository(dir);

      const model = await repository.getLlmModelName('nonexistent-agent');

      expect(model).toBeNull();
    });

    it('resolves null without throwing and logs a prefixed console.warn when the frontmatter YAML is malformed', async () => {
      writeAgentDefinitionFile(
        'triager',
        [
          '---',
          'model: "unterminated quoted scalar',
          '---',
          '',
          '# Triager',
          '',
        ].join('\n'),
      );
      const repository = new FileSystemAgentDefinitionRepository(dir);
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const model = await repository.getLlmModelName('triager');

      expect(model).toBeNull();
      expect(
        consoleWarnSpy.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].startsWith('FileSystemAgentDefinitionRepository:'),
        ),
      ).toBe(true);
      consoleWarnSpy.mockRestore();
    });

    it('resolves null without throwing and logs a prefixed console.warn when the file has no frontmatter delimiter at all', async () => {
      writeAgentDefinitionFile(
        'triager',
        ['# Triager', '', 'Body content with no frontmatter block.', ''].join(
          '\n',
        ),
      );
      const repository = new FileSystemAgentDefinitionRepository(dir);
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const model = await repository.getLlmModelName('triager');

      expect(model).toBeNull();
      expect(
        consoleWarnSpy.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].startsWith('FileSystemAgentDefinitionRepository:'),
        ),
      ).toBe(true);
      consoleWarnSpy.mockRestore();
    });

    it('resolves null without throwing and logs a prefixed console.warn when the frontmatter block has no closing delimiter', async () => {
      writeAgentDefinitionFile(
        'triager',
        ['---', 'name: triager', 'model: some-model', '', '# Triager', ''].join(
          '\n',
        ),
      );
      const repository = new FileSystemAgentDefinitionRepository(dir);
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const model = await repository.getLlmModelName('triager');

      expect(model).toBeNull();
      expect(
        consoleWarnSpy.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].startsWith('FileSystemAgentDefinitionRepository:'),
        ),
      ).toBe(true);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('resolveAgentDefinitionsDirectoryPath', () => {
    it('returns a non-empty configured path unchanged', () => {
      expect(resolveAgentDefinitionsDirectoryPath('/custom/agents/path')).toBe(
        '/custom/agents/path',
      );
    });

    it('returns the default ~/.claude/agents path when configuredPath is null', () => {
      expect(resolveAgentDefinitionsDirectoryPath(null)).toBe(
        path.join(os.homedir(), '.claude', 'agents'),
      );
    });

    it('returns the default ~/.claude/agents path when configuredPath is undefined', () => {
      expect(resolveAgentDefinitionsDirectoryPath(undefined)).toBe(
        path.join(os.homedir(), '.claude', 'agents'),
      );
    });
  });
});
