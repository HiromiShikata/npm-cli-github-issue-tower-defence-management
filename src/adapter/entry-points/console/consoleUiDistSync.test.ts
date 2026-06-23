import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const srcUiDistDir = path.join(
  repoRoot,
  'src',
  'adapter',
  'entry-points',
  'console',
  'ui-dist',
);
const binUiDistDir = path.join(
  repoRoot,
  'bin',
  'adapter',
  'entry-points',
  'console',
  'ui-dist',
);

const listFilesRecursively = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listFilesRecursively(fullPath) : [fullPath];
    })
    .sort();
};

const relativePaths = (dir: string): string[] =>
  listFilesRecursively(dir).map((file) => path.relative(dir, file));

describe('console ui-dist served bundle synchronization', () => {
  it('has the same file set in bin/ui-dist as in src/ui-dist', () => {
    expect(relativePaths(binUiDistDir)).toEqual(relativePaths(srcUiDistDir));
  });

  it('has byte-identical files in bin/ui-dist and src/ui-dist', () => {
    for (const relativePath of relativePaths(srcUiDistDir)) {
      const srcContent = fs
        .readFileSync(path.join(srcUiDistDir, relativePath))
        .toString('base64');
      const binContent = fs
        .readFileSync(path.join(binUiDistDir, relativePath))
        .toString('base64');
      expect(binContent).toBe(srcContent);
    }
  });

  it('serves bundle assets that read the API from the server root, never via a relative path', () => {
    const assetsDir = path.join(binUiDistDir, 'assets');
    const scriptFiles = fs
      .readdirSync(assetsDir)
      .filter((name) => name.endsWith('.js'));
    expect(scriptFiles.length).toBeGreaterThan(0);
    for (const scriptFile of scriptFiles) {
      const content = fs.readFileSync(
        path.join(assetsDir, scriptFile),
        'utf-8',
      );
      expect(content).not.toMatch(/\.\/api\//);
    }
  });
});
