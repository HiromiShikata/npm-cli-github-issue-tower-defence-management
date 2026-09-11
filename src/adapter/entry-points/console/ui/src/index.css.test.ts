import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = __dirname;
const INDEX_CSS_PATH = join(__dirname, 'index.css');

function walkTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsxFiles(fullPath));
    } else if (
      entry.name.endsWith('.tsx') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.stories.tsx')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function isModalOverlayComponent(content: string): boolean {
  return (
    content.includes('createPortal') &&
    /['"`]console-[a-z][a-z0-9-]*-(overlay|backdrop)['"`]/.test(content)
  );
}

function extractConsoleClassNames(content: string): string[] {
  return [
    ...new Set(
      [...content.matchAll(/console-[a-z][a-z0-9-]+/g)].map((m) => m[0]),
    ),
  ];
}

function loadDefinedCssClasses(cssContent: string): Set<string> {
  return new Set(
    [...cssContent.matchAll(/\.console-[a-z0-9][a-z0-9-]+/g)].map((m) =>
      m[0].slice(1),
    ),
  );
}

function extractCssRuleBlock(
  cssContent: string,
  selector: string,
): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cssContent.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  return match ? match[1] : null;
}

describe('console CSS class contract', () => {
  it('sets min-height: 0 on console-task-create-dialog-body to enable overflow-y scrolling when dialog is height-constrained in landscape orientation', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(
      css,
      '.console-task-create-dialog-body',
    );
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('min-height: 0');
  });

  it('defines a CSS rule in index.css for every console-* class name used in portal overlay components', () => {
    const definedClasses = loadDefinedCssClasses(
      readFileSync(INDEX_CSS_PATH, 'utf-8'),
    );
    const missingEntries: { file: string; className: string }[] = [];

    for (const filePath of walkTsxFiles(SRC_DIR)) {
      const content = readFileSync(filePath, 'utf-8');
      if (!isModalOverlayComponent(content)) continue;

      const relPath = filePath.replace(`${SRC_DIR}/`, '');
      for (const className of extractConsoleClassNames(content)) {
        if (!definedClasses.has(className)) {
          missingEntries.push({ file: relPath, className });
        }
      }
    }

    expect(missingEntries).toEqual([]);
  });
});
