export interface FolderDto {
  id: string;
  name: string;
  parentId: string | null;
  /** ltree path, e.g. 'workspace.core' */
  path: string;
  createdAt: Date;
  updatedAt: Date;
}
