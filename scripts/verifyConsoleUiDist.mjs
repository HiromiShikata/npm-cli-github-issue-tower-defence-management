import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const sourceDir = path.join(
  repoRoot,
  'src',
  'adapter',
  'entry-points',
  'console',
  'ui-dist',
);
const targetDir = path.join(
  repoRoot,
  'bin',
  'adapter',
  'entry-points',
  'console',
  'ui-dist',
);

const collectRelativeFiles = (baseDir) => {
  const walk = (currentDir) => {
    const entries = readdirSync(currentDir);
    return entries.flatMap((entry) => {
      const absolutePath = path.join(currentDir, entry);
      if (statSync(absolutePath).isDirectory()) {
        return walk(absolutePath);
      }
      return [path.relative(baseDir, absolutePath)];
    });
  };
  return walk(baseDir).sort();
};

if (!existsSync(sourceDir)) {
  throw new Error(
    `Console UI source build output not found at ${sourceDir}. Run "npm run build:console-ui" first.`,
  );
}

if (!existsSync(targetDir)) {
  throw new Error(
    `Served console UI bundle not found at ${targetDir}. Run "node scripts/copyConsoleUiDist.mjs" to regenerate it.`,
  );
}

const sourceFiles = collectRelativeFiles(sourceDir);
const targetFiles = collectRelativeFiles(targetDir);

const mismatches = [];

const sourceFileSet = new Set(sourceFiles);
const targetFileSet = new Set(targetFiles);

for (const relativePath of sourceFiles) {
  if (!targetFileSet.has(relativePath)) {
    mismatches.push(`missing in served bundle: ${relativePath}`);
  }
}

for (const relativePath of targetFiles) {
  if (!sourceFileSet.has(relativePath)) {
    mismatches.push(`unexpected in served bundle: ${relativePath}`);
  }
}

for (const relativePath of sourceFiles) {
  if (!targetFileSet.has(relativePath)) {
    continue;
  }
  const sourceContent = readFileSync(path.join(sourceDir, relativePath));
  const targetContent = readFileSync(path.join(targetDir, relativePath));
  if (!sourceContent.equals(targetContent)) {
    mismatches.push(`content differs: ${relativePath}`);
  }
}

if (mismatches.length > 0) {
  throw new Error(
    [
      'Served console UI bundle is stale and does not match the source build.',
      `Source: ${sourceDir}`,
      `Served: ${targetDir}`,
      'Run "npm run build:console-ui && node scripts/copyConsoleUiDist.mjs" and commit the result.',
      ...mismatches.map((entry) => `  - ${entry}`),
    ].join('\n'),
  );
}

process.stdout.write(
  `Served console UI bundle matches source build (${sourceFiles.length} files).\n`,
);
