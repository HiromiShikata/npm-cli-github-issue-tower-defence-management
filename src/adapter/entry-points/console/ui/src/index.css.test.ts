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
  const names: string[] = [];
  const consoleClassRe = /console-[a-z][a-z0-9-]+/g;

  for (const m of content.matchAll(
    /\bclassName\s*=\s*(?:"([^"]*?)"|'([^']*?)'|`([^`]*?)`|\{`([^`]*?)`\}|\{([^}]*)\})/g,
  )) {
    const val = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
    for (const inner of val.matchAll(consoleClassRe)) {
      names.push(inner[0]);
    }
  }

  for (const m of content.matchAll(
    /\.className\s*=\s*(?:"([^"]*?)"|'([^']*?)'|`([^`]*?)`)/g,
  )) {
    const val = m[1] ?? m[2] ?? m[3] ?? '';
    for (const inner of val.matchAll(consoleClassRe)) {
      names.push(inner[0]);
    }
  }

  return [...new Set(names)];
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

function extractAllCssRuleBlocks(
  cssContent: string,
  selector: string,
): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    ...cssContent.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'g')),
  ].map((m) => m[1]);
}

const REQUIRED_FILE_PREVIEW_DECLARATIONS = [
  {
    selector: '.console-task-create-dialog-file-preview',
    declaration: 'max-height: 45dvh',
  },
  {
    selector: '.console-task-create-dialog-file-preview',
    declaration: 'overflow-y: auto',
  },
  {
    selector: '.console-task-create-dialog-file-preview-bar',
    declaration: 'position: sticky',
  },
  {
    selector: '.console-task-create-dialog-file-preview-bar',
    declaration: 'top: 0',
  },
  {
    selector: '.console-task-create-dialog-file-preview-image',
    declaration: 'width: 100%',
  },
  {
    selector: '.console-task-create-dialog-file-preview-image',
    declaration: 'height: auto',
  },
  {
    selector: '.console-task-create-dialog-file-preview-image',
    declaration: 'display: block',
  },
  {
    selector: '.console-task-create-dialog-file-preview-image',
    declaration: 'border-radius: 4px',
  },
];

const FORBIDDEN_FILE_PREVIEW_DECLARATIONS = [
  {
    selector: '.console-task-create-dialog-file-preview-image',
    declaration: 'max-height:',
  },
  {
    selector: '.console-task-create-dialog-file-preview-image',
    declaration: 'object-fit:',
  },
  {
    selector: '.console-task-create-dialog-file-preview',
    declaration: '45vh',
  },
  {
    selector: '.console-task-create-dialog-file-preview-bar',
    declaration: '45vh',
  },
  {
    selector: '.console-task-create-dialog-file-preview-image',
    declaration: '45vh',
  },
];

describe('console CSS class contract', () => {
  it('sets margin-left: 4rem on console-tab-pjname to add visual breathing room to the left of the project selector equal to its own approximate width', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-tab-pjname');
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('margin-left: 4rem');
  });

  it('sets min-height: 0 on console-task-create-dialog-body to enable overflow-y scrolling when dialog is height-constrained in landscape orientation', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(
      css,
      '.console-task-create-dialog-body',
    );
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('min-height: 0');
  });

  it('bounds max-height of console-task-create-dialog by the dynamic viewport unit (100dvh) so the dialog footer with the Create button stays inside the visible area when the mobile browser toolbar is shown in landscape orientation', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-task-create-dialog');
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('max-height: calc(100dvh - 100px)');
  });

  it('sets overflow-y: auto on console-task-create-dialog and no longer clips it with overflow: hidden, so the whole dialog from the header through the Cancel/Create footer is one scroll container', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-task-create-dialog');
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('overflow-y: auto');
    expect(ruleBlock).not.toContain('overflow: hidden');
  });

  it('sets flex: none on console-task-create-dialog-body so its children are not compressed by flex shrinking and the body has no own scroll area', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(
      css,
      '.console-task-create-dialog-body',
    );
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('flex: none');
    expect(ruleBlock).not.toContain('overflow-y');
  });

  it('declares no max-height and no overflow-y on console-task-create-dialog-option-list so the Story and Agent lists show every option without a nested scroll inside the dialog', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(
      css,
      '.console-task-create-dialog-option-list',
    );
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).not.toContain('max-height');
    expect(ruleBlock).not.toContain('overflow-y');
  });

  it('sets minimum 8px vertical padding on console-tab-project-link to provide an adequate tap target for the GitHub project icon link', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-tab-project-link');
    expect(ruleBlock).not.toBeNull();
    const paddingMatch = (ruleBlock as string).match(/padding:\s*([^;]+)/);
    expect(paddingMatch).not.toBeNull();
    const parts = (paddingMatch as RegExpMatchArray)[1].trim().split(/\s+/);
    const verticalPx = parseInt(parts[0], 10);
    expect(verticalPx).toBeGreaterThanOrEqual(8);
  });

  it('sets minimum 8px vertical padding on console-timer-settings-button to provide an adequate tap target for the timer settings icon button', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(
      css,
      '.console-timer-settings-button',
    );
    expect(ruleBlock).not.toBeNull();
    const paddingMatch = (ruleBlock as string).match(/padding:\s*([^;]+)/);
    expect(paddingMatch).not.toBeNull();
    const parts = (paddingMatch as RegExpMatchArray)[1].trim().split(/\s+/);
    const verticalPx = parseInt(parts[0], 10);
    expect(verticalPx).toBeGreaterThanOrEqual(8);
  });

  it('sets minimum 8px vertical padding on console-tab-settings-button to provide an adequate tap target for the settings gear icon button', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-tab-settings-button');
    expect(ruleBlock).not.toBeNull();
    const paddingMatch = (ruleBlock as string).match(/padding:\s*([^;]+)/);
    expect(paddingMatch).not.toBeNull();
    const parts = (paddingMatch as RegExpMatchArray)[1].trim().split(/\s+/);
    const verticalPx = parseInt(parts[0], 10);
    expect(verticalPx).toBeGreaterThanOrEqual(8);
  });

  it('sets minimum 8px vertical padding on console-task-create-button to provide an adequate tap target for the new task icon button', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-task-create-button');
    expect(ruleBlock).not.toBeNull();
    const paddingMatch = (ruleBlock as string).match(/padding:\s*([^;]+)/);
    expect(paddingMatch).not.toBeNull();
    const parts = (paddingMatch as RegExpMatchArray)[1].trim().split(/\s+/);
    const verticalPx = parseInt(parts[0], 10);
    expect(verticalPx).toBeGreaterThanOrEqual(8);
  });

  it('sets margin: 0.5em 0 on console-markdown p so consecutive paragraphs render with a visible vertical gap, matching the separation GitHub.com renders for the same Markdown', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-markdown p');
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('margin: 0.5em 0');
  });

  it('sets flex: 0 1 auto, min-width: 0, overflow: hidden, white-space: nowrap, and text-overflow: ellipsis on console-error-toast-title so the title truncates with ellipsis instead of wrapping at narrow viewports', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const ruleBlock = extractCssRuleBlock(css, '.console-error-toast-title');
    expect(ruleBlock).not.toBeNull();
    expect(ruleBlock).toContain('flex: 0 1 auto');
    expect(ruleBlock).toContain('min-width: 0');
    expect(ruleBlock).toContain('overflow: hidden');
    expect(ruleBlock).toContain('white-space: nowrap');
    expect(ruleBlock).toContain('text-overflow: ellipsis');
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

  it('defines a CSS rule in index.css for every console-* class name used in all non-modal inline TSX components', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const definedClasses = loadDefinedCssClasses(css);
    const missingEntries: { file: string; className: string }[] = [];

    for (const filePath of walkTsxFiles(SRC_DIR)) {
      const content = readFileSync(filePath, 'utf-8');
      if (isModalOverlayComponent(content)) continue;

      const relPath = filePath.replace(`${SRC_DIR}/`, '');
      for (const className of extractConsoleClassNames(content)) {
        if (className.endsWith('-')) continue;
        if (!definedClasses.has(className)) {
          missingEntries.push({ file: relPath, className });
        }
      }
    }

    expect(missingEntries).toEqual([]);
  });

  it('declares every required file preview declaration on its own rule so the preview caps its height and scrolls, the close bar sticks to the top, and the image fills the width', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const missingDeclarations = REQUIRED_FILE_PREVIEW_DECLARATIONS.filter(
      ({ selector, declaration }) => {
        const ruleBlock = extractCssRuleBlock(css, selector);
        return ruleBlock === null || !ruleBlock.includes(declaration);
      },
    );
    expect(missingDeclarations).toEqual([]);
  });

  it('declares no forbidden file preview declaration in any rule for its selector so the image is not shrunk to a height cap and no rule uses the 45vh value', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8');
    const forbiddenDeclarations = FORBIDDEN_FILE_PREVIEW_DECLARATIONS.filter(
      ({ selector, declaration }) =>
        extractAllCssRuleBlocks(css, selector).some((ruleBlock) =>
          ruleBlock.includes(declaration),
        ),
    );
    expect(forbiddenDeclarations).toEqual([]);
  });
});
