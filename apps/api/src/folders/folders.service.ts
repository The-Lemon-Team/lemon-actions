import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFolderDto, UpdateFolderDto } from './folder.dto';
import { FolderDto } from './folder.types';
import { FoldersRepository } from './folders.repository';

/** Converts a display name to a valid ltree label ([A-Za-z0-9_]). */
export function toLtreeLabel(name: string): string {
  const label = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return label || 'folder';
}

@Injectable()
export class FoldersService {
  constructor(private readonly repo: FoldersRepository) {}

  findAll(): Promise<FolderDto[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<FolderDto> {
    const folder = await this.repo.findById(id);
    if (!folder) throw new NotFoundException(`Folder ${id} not found`);
    return folder;
  }

  async subtree(id: string): Promise<FolderDto[]> {
    await this.findOne(id);
    return this.repo.findSubtree(id);
  }

  create(dto: CreateFolderDto): Promise<FolderDto> {
    return this.repo.transaction(async (tx) => {
      const parent = dto.parentId ? await this.requireFolder(dto.parentId, tx) : null;
      const path = await this.uniquePath(parent?.path ?? null, toLtreeLabel(dto.name), tx);
      return this.repo.insert(dto.name, parent?.id ?? null, path, tx);
    });
  }

  update(id: string, dto: UpdateFolderDto): Promise<FolderDto> {
    return this.repo.transaction(async (tx) => {
      const folder = await this.requireFolder(id, tx);

      if (dto.name !== undefined && dto.name !== folder.name) {
        await this.repo.updateName(id, dto.name, tx);
      }

      if (dto.parentId !== undefined && dto.parentId !== folder.parentId) {
        const parent = dto.parentId ? await this.requireFolder(dto.parentId, tx) : null;
        if (parent && (parent.id === id || parent.path === folder.path || parent.path.startsWith(folder.path + '.'))) {
          throw new BadRequestException('Cannot move a folder into itself or its descendants');
        }
        const ownLabel = folder.path.split('.').pop() as string;
        const newPath = await this.uniquePath(parent?.path ?? null, ownLabel, tx);
        await this.repo.moveSubtree(id, folder.path, newPath, parent?.id ?? null, tx);
      }
      return this.requireFolder(id, tx);
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    if ((await this.repo.countChildren(id)) > 0) {
      throw new ConflictException('Folder has sub-folders; move or delete them first');
    }
    await this.repo.delete(id); // flows.folder_id is SET NULL
  }

  private async requireFolder(id: string, tx: Parameters<FoldersRepository['findById']>[1]) {
    const f = await this.repo.findById(id, tx);
    if (!f) throw new NotFoundException(`Folder ${id} not found`);
    return f;
  }

  private async uniquePath(
    parentPath: string | null,
    label: string,
    tx: Parameters<FoldersRepository['pathExists']>[1],
  ): Promise<string> {
    const build = (l: string) => (parentPath ? `${parentPath}.${l}` : l);
    let candidate = build(label);
    for (let i = 2; await this.repo.pathExists(candidate, tx); i++) {
      candidate = build(`${label}_${i}`);
    }
    return candidate;
  }
}
