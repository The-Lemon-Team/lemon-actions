import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FlowStatus } from '@prisma/client';
import { buildArenaActorFlows } from '../seeds/arena-actors-2.seed';
import { buildArenaGameFlows } from '../seeds/arena-game.seed';
import { CORE_FOLDERS } from '../seeds/core.seed';
import { DACHA_HOME_FLOWS, DEFAULT_HOME_FLOWS, SEED_PROFILES } from '../seeds/home.seed';
import { FlowsService } from '../flows/flows.service';
import { FoldersRepository } from '../folders/folders.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto, ProfileView } from './profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foldersRepo: FoldersRepository,
    private readonly flowsService: FlowsService,
  ) {}

  async findAll(): Promise<ProfileView[]> {
    let profiles = await this.prisma.profile.findMany({
      orderBy: { createdAt: 'asc' },
    });
    if (profiles.length === 0) {
      const def = await this.ensureDefaultProfile();
      profiles = [def];
    }
    return profiles.map((p) => ({
      id: p.id,
      handle: p.handle,
      displayName: p.displayName,
      avatarIcon: p.avatarIcon ?? undefined,
      createdAt: p.createdAt,
    }));
  }

  async findOne(id: string): Promise<ProfileView> {
    const p = await this.prisma.profile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Profile ${id} not found`);
    return {
      id: p.id,
      handle: p.handle,
      displayName: p.displayName,
      avatarIcon: p.avatarIcon ?? undefined,
      createdAt: p.createdAt,
    };
  }

  /**
   * Регистрирует нового пользователя и автоматически разворачивает для него
   * изолированное дерево папок-контейнеров и стартовые потоки из модульных сидов.
   */
  async register(dto: CreateProfileDto): Promise<ProfileView> {
    const handle = dto.handle.trim().toLowerCase();
    const existing = await this.prisma.profile.findUnique({ where: { handle } });
    if (existing) {
      throw new ConflictException(`Profile with handle "${handle}" already exists`);
    }

    const profile = await this.prisma.profile.create({
      data: {
        handle,
        displayName: dto.displayName.trim(),
        avatarIcon: dto.avatarIcon ?? 'home',
      },
    });

    await this.provisionStarterSpace(profile.id, handle === 'dacha');

    return {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarIcon: profile.avatarIcon ?? undefined,
      createdAt: profile.createdAt,
    };
  }

  private async ensureDefaultProfile() {
    const defMeta = SEED_PROFILES[0];
    let profile = await this.prisma.profile.findUnique({ where: { handle: defMeta.handle } });
    if (!profile) {
      profile = await this.prisma.profile.create({ data: defMeta });
    }

    await this.prisma.$executeRaw`UPDATE folders SET profile_id = ${profile.id}::uuid WHERE profile_id IS NULL`;
    await this.prisma.flow.updateMany({
      where: { profileId: null },
      data: { profileId: profile.id },
    });

    const homeFolders = await this.foldersRepo.findAll({
      profileId: profile.id,
      scope: 'home',
    });
    if (homeFolders.length === 0) {
      await this.provisionStarterSpace(profile.id, false);
    }

    return profile;
  }

  private async provisionStarterSpace(profileId: string, isDacha = false): Promise<void> {
    const folderIdByPath = new Map<string, string>();
    for (const f of CORE_FOLDERS) {
      const parentPath = f.path.includes('.') ? f.path.slice(0, f.path.lastIndexOf('.')) : null;
      const parentId = parentPath ? folderIdByPath.get(parentPath) ?? null : null;
      const inserted = await this.foldersRepo.insert(f.name, parentId, f.path, profileId);
      folderIdByPath.set(f.path, inserted.id);
    }

    const seedFlows = [
      ...(isDacha ? DACHA_HOME_FLOWS : DEFAULT_HOME_FLOWS),
      ...buildArenaActorFlows(),
      ...buildArenaGameFlows(),
    ];

    for (const s of seedFlows) {
      const created = await this.flowsService.create({
        name: s.name,
        description: s.description,
        type: s.type,
        isExclusive: s.isExclusive,
        folderId: folderIdByPath.get(s.folder),
        profileId,
        tags: s.tags,
        config: s.config,
        orchestratorRules: s.orchestratorRules,
      });
      if (s.status === FlowStatus.ACTIVE) {
        await this.flowsService.updateStatus(created.id, FlowStatus.ACTIVE, 'provision');
      }
    }
  }
}
