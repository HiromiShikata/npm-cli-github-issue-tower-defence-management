import { buildConsoleFileTree } from './fileTree';
import type { ConsoleChangedFile } from './types';

const changedFile = (path: string): ConsoleChangedFile => ({
  path,
  additions: 1,
  deletions: 0,
  status: 'modified',
  patch: null,
});

describe('buildConsoleFileTree', () => {
  it('nests files under their directory segments', () => {
    const tree = buildConsoleFileTree([
      changedFile('src/features/console/markdown.ts'),
    ]);
    expect(tree).toEqual([
      {
        kind: 'directory',
        name: 'src',
        path: 'src',
        children: [
          {
            kind: 'directory',
            name: 'features',
            path: 'src/features',
            children: [
              {
                kind: 'directory',
                name: 'console',
                path: 'src/features/console',
                children: [
                  {
                    kind: 'file',
                    name: 'markdown.ts',
                    path: 'src/features/console/markdown.ts',
                    file: changedFile('src/features/console/markdown.ts'),
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('groups multiple files that share a directory under a single directory node', () => {
    const tree = buildConsoleFileTree([
      changedFile('src/one.ts'),
      changedFile('src/two.ts'),
    ]);
    expect(tree).toHaveLength(1);
    const [directory] = tree;
    expect(directory.kind).toBe('directory');
    if (directory.kind !== 'directory') {
      throw new Error('expected a directory node');
    }
    expect(directory.children.map((child) => child.name)).toEqual([
      'one.ts',
      'two.ts',
    ]);
  });

  it('sorts directories before files and both alphabetically', () => {
    const tree = buildConsoleFileTree([
      changedFile('zeta.ts'),
      changedFile('alpha.ts'),
      changedFile('lib/util.ts'),
      changedFile('components/view.ts'),
    ]);
    expect(tree.map((node) => node.name)).toEqual([
      'components',
      'lib',
      'alpha.ts',
      'zeta.ts',
    ]);
  });

  it('places a root-level file as a leaf at the top level', () => {
    const tree = buildConsoleFileTree([changedFile('package.json')]);
    expect(tree).toEqual([
      {
        kind: 'file',
        name: 'package.json',
        path: 'package.json',
        file: changedFile('package.json'),
      },
    ]);
  });

  it('returns an empty tree for no files', () => {
    expect(buildConsoleFileTree([])).toEqual([]);
  });
});
