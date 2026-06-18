import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
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

if (!existsSync(sourceDir)) {
  throw new Error(
    `Console UI build output not found at ${sourceDir}. Run "npm run build:console-ui" first.`,
  );
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(path.dirname(targetDir), { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

process.stdout.write(`Copied console UI dist to ${targetDir}\n`);
