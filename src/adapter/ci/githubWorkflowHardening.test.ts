import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isMap,
  isScalar,
  parseDocument,
  visit,
  type Document,
  type Pair,
} from 'yaml';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');

const HARDENED_WORKFLOW_FILES = [
  '.github/workflows/format.yml',
  '.github/workflows/publish.yml',
] as const;

const PUBLISH_WORKFLOW_FILE = '.github/workflows/publish.yml';

const FULL_COMMIT_SHA_REF_PATTERN = /@[0-9a-f]{40}$/;

const SECRET_ENV_NAMES = ['RELEASE_APP_PRIVATE_KEY', 'PJ_GITHUB_TOKEN'];

type ParsedWorkflow = {
  readonly relativePath: string;
  readonly text: string;
  readonly document: Document;
};

const parseWorkflow = (relativePath: string): ParsedWorkflow => {
  const text = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
  return { relativePath, text, document: parseDocument(text) };
};

const lineNumberAt = (text: string, offset: number): number =>
  text.slice(0, offset).split('\n').length;

const scalarValueOf = (node: unknown): string | undefined =>
  isScalar(node) && typeof node.value === 'string' ? node.value : undefined;

type UsesReference = {
  readonly line: number;
  readonly value: string;
};

const collectUsesReferences = (workflow: ParsedWorkflow): UsesReference[] => {
  const references: UsesReference[] = [];
  visit(workflow.document, {
    Pair(_key, pair: Pair) {
      if (scalarValueOf(pair.key) !== 'uses') {
        return;
      }
      const value = scalarValueOf(pair.value);
      if (value === undefined || !isScalar(pair.key) || !pair.key.range) {
        return;
      }
      references.push({
        line: lineNumberAt(workflow.text, pair.key.range[0]),
        value,
      });
    },
  });
  return references;
};

describe('GitHub workflow hardening', () => {
  describe('action references', () => {
    it.each(HARDENED_WORKFLOW_FILES)(
      'pins every uses reference in %s to a 40-character commit SHA',
      (relativePath) => {
        const workflow = parseWorkflow(relativePath);
        const unpinned = collectUsesReferences(workflow)
          .filter(
            (reference) => !FULL_COMMIT_SHA_REF_PATTERN.test(reference.value),
          )
          .map(
            (reference) =>
              `${relativePath}:${reference.line} uses: ${reference.value}`,
          );

        expect(unpinned).toEqual([]);
      },
    );
  });

  describe('publish job environment', () => {
    it('keeps the release secrets out of the job-level env block of publish.yml', () => {
      const workflow = parseWorkflow(PUBLISH_WORKFLOW_FILE);
      const jobs = workflow.document.get('jobs');
      if (!isMap(jobs)) {
        throw new Error(`${PUBLISH_WORKFLOW_FILE} has no jobs mapping`);
      }

      const jobLevelSecretEnv: string[] = [];
      for (const jobPair of jobs.items) {
        const jobName = scalarValueOf(jobPair.key) ?? '<unknown>';
        const jobEnv = isMap(jobPair.value)
          ? jobPair.value.get('env')
          : undefined;
        if (!isMap(jobEnv)) {
          continue;
        }
        for (const envPair of jobEnv.items) {
          const envName = scalarValueOf(envPair.key);
          if (envName === undefined || !SECRET_ENV_NAMES.includes(envName)) {
            continue;
          }
          const line =
            isScalar(envPair.key) && envPair.key.range
              ? lineNumberAt(workflow.text, envPair.key.range[0])
              : 0;
          jobLevelSecretEnv.push(
            `${PUBLISH_WORKFLOW_FILE}:${line} jobs.${jobName}.env ${envName}`,
          );
        }
      }

      expect(jobLevelSecretEnv).toEqual([]);
    });
  });
});
