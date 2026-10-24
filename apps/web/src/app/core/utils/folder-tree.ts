import { Folder, FolderNode } from '../models/flow.models';

const isInSubtree = (path: string, root: string): boolean =>
  path === root || path.startsWith(root + '.');

/**
 * Builds a nested tree from a FLAT list of folders using only the ltree `path`
 * (e.g. 'workspace.core' is a child of 'workspace'). Mirrors `path <@ 'x'` queries.
 */
export function buildFolderTree(
  folders: Folder[],
  opts: {
    expandedIds: ReadonlySet<string>;
    selectedId: string | null;
    flowCountForPath: (path: string) => number;
    hasActiveFlowForPath?: (path: string) => boolean;
  },
): FolderNode[] {
  const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path));
  const byPath = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const f of sorted) {
    const segments = f.path.split('.');
    const node: FolderNode = {
      ...f,
      children: [],
      depth: segments.length - 1,
      isExpanded: opts.expandedIds.has(f.id),
      isSelected: opts.selectedId === f.id,
      flowCount: opts.flowCountForPath(f.path),
      hasActiveFlow: opts.hasActiveFlowForPath ? opts.hasActiveFlowForPath(f.path) : false,
    };
    byPath.set(f.path, node);
    const parentPath = segments.slice(0, -1).join('.');
    const parent = byPath.get(parentPath);
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

export { isInSubtree };
