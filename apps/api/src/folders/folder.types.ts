export interface FolderDto {
  id: string;
  name: string;
  parentId: string | null;
  profileId: string | null;
  /** ltree path, e.g. 'home.supplies' or 'workspace.core' */
  path: string;
  createdAt: Date;
  updatedAt: Date;
}
