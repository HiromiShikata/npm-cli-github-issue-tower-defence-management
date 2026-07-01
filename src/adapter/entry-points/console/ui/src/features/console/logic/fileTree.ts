import type { ConsoleChangedFile } from './types';

export type ConsoleFileTreeFileNode = {
  kind: 'file';
  name: string;
  path: string;
  file: ConsoleChangedFile;
};

export type ConsoleFileTreeDirectoryNode = {
  kind: 'directory';
  name: string;
  path: string;
  children: ConsoleFileTreeNode[];
};

export type ConsoleFileTreeNode =
  | ConsoleFileTreeDirectoryNode
  | ConsoleFileTreeFileNode;

type DirectoryBuilder = {
  directories: Map<string, DirectoryBuilder>;
  files: ConsoleChangedFile[];
};

const createDirectoryBuilder = (): DirectoryBuilder => ({
  directories: new Map(),
  files: [],
});

const splitPathSegments = (path: string): string[] =>
  path.split('/').filter((segment) => segment !== '');

const compareByName = (
  left: { name: string },
  right: { name: string },
): number => left.name.localeCompare(right.name);

const buildNodes = (
  builder: DirectoryBuilder,
  parentPath: string,
): ConsoleFileTreeNode[] => {
  const directoryNodes: ConsoleFileTreeDirectoryNode[] = [];
  builder.directories.forEach((childBuilder, name) => {
    const path = parentPath === '' ? name : `${parentPath}/${name}`;
    directoryNodes.push({
      kind: 'directory',
      name,
      path,
      children: buildNodes(childBuilder, path),
    });
  });
  directoryNodes.sort(compareByName);

  const fileNodes: ConsoleFileTreeFileNode[] = builder.files.map((file) => ({
    kind: 'file',
    name: splitPathSegments(file.path).at(-1) ?? file.path,
    path: file.path,
    file,
  }));
  fileNodes.sort(compareByName);

  return [...directoryNodes, ...fileNodes];
};

export const buildConsoleFileTree = (
  files: ConsoleChangedFile[],
): ConsoleFileTreeNode[] => {
  const root = createDirectoryBuilder();

  for (const file of files) {
    const segments = splitPathSegments(file.path);
    if (segments.length === 0) {
      root.files.push(file);
      continue;
    }
    const directorySegments = segments.slice(0, -1);
    let cursor = root;
    for (const segment of directorySegments) {
      const existing = cursor.directories.get(segment);
      if (existing === undefined) {
        const created = createDirectoryBuilder();
        cursor.directories.set(segment, created);
        cursor = created;
        continue;
      }
      cursor = existing;
    }
    cursor.files.push(file);
  }

  return buildNodes(root, '');
};
