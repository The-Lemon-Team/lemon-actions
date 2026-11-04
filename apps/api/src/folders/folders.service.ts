import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFolderDto, ListFoldersQueryDto, UpdateFolderDto } from './folder.dto';
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

  findAll(q: ListFoldersQueryDto = {}): Promise<FolderDto[]> {
    return this.repo.findAll(q);
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

  /**
   * Срез контекста Нейрона-Контейнера (папки) для внешних императивных приложений:
   * возвращает права доступа (статусы потоков/мьютексов), открытые сессии и последние события.
   */
  async context(id: string) {
    const folder = await this.findOne(id);
    const { flows, activeSessions, recentEvents } = await this.repo.findFolderContextData(id);

    const gates: Record<
      string,
      { id: string; type: string; status: string; isExclusive: boolean; config: unknown }
    > = {};
    const activeFlows: string[] = [];
    let isExclusiveLocked = false;

    for (const f of flows) {
      const running = f.status === 'ACTIVE' || f.status === 'PROCESSING';
      if (running) {
        activeFlows.push(f.name);
        if (f.isExclusive) isExclusiveLocked = true;
      }
      gates[f.name] = {
        id: f.id,
        type: f.type,
        status: f.status,
        isExclusive: f.isExclusive,
        config: f.config,
      };
    }

    return {
      neuron: folder,
      permissions: {
        isExclusiveLocked,
        activeFlows,
        gates,
      },
      activeSessions,
      recentEvents,
    };
  }

  create(dto: CreateFolderDto): Promise<FolderDto> {
    return this.repo.transaction(async (tx) => {
      const parent = dto.parentId ? await this.requireFolder(dto.parentId, tx) : null;
      const profileId = dto.profileId ?? parent?.profileId ?? null;
      const path = await this.uniquePath(parent?.path ?? null, toLtreeLabel(dto.name), profileId, tx);
      return this.repo.insert(dto.name, parent?.id ?? null, path, profileId, tx);
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
        const newPath = await this.uniquePath(parent?.path ?? null, ownLabel, folder.profileId, tx);
        await this.repo.moveSubtree(id, folder.path, newPath, parent?.id ?? null, folder.profileId, tx);
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
    profileId: string | null,
    tx: Parameters<FoldersRepository['pathExists']>[2],
  ): Promise<string> {
    const build = (l: string) => (parentPath ? `${parentPath}.${l}` : l);
    let candidate = build(label);
    for (let i = 2; await this.repo.pathExists(candidate, profileId, tx); i++) {
      candidate = build(`${label}_${i}`);
    }
    return candidate;
  }
}
