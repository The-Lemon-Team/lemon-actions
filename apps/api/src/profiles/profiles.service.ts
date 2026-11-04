import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FlowStatus, FlowType } from '@prisma/client';
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
   * изолированное дерево папок-контейнеров (`home`, `home.supplies`, `home.routines`, `workspace`)
   * и стартовые бытовые виджеты-потоки.
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

    await this.provisionStarterSpace(profile.id);

    return {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarIcon: profile.avatarIcon ?? undefined,
      createdAt: profile.createdAt,
    };
  }

  private async ensureDefaultProfile() {
    const existing = await this.prisma.profile.findUnique({ where: { handle: 'default' } });
    if (existing) return existing;

    const profile = await this.prisma.profile.create({
      data: {
        handle: 'default',
        displayName: 'Мой Дом (Основной)',
        avatarIcon: 'home',
      },
    });

    // Привязываем существующие папки и потоки без профиля к основному профилю
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
      await this.provisionStarterSpace(profile.id);
    }

    return profile;
  }

  private async provisionStarterSpace(profileId: string): Promise<void> {
    const home = await this.foldersRepo.insert('Home', null, 'home', profileId);
    const supplies = await this.foldersRepo.insert('Household Supplies', home.id, 'home.supplies', profileId);
    const routines = await this.foldersRepo.insert('Home Routines', home.id, 'home.routines', profileId);
    const workspace = await this.foldersRepo.insert('Workspace', null, 'workspace', profileId);
    await this.foldersRepo.insert('Core Services', workspace.id, 'workspace.core', profileId);

    const starterSupplies = [
      {
        name: 'Стиральный порошок',
        description: 'Бытовой мьютекс наличия порошка (ACTIVE = есть дома, INACTIVE = в список покупок).',
        status: FlowStatus.ACTIVE,
        tags: ['home', 'supplies', 'laundry'],
        config: {
          widget: {
            kind: 'supply',
            icon: 'local_laundry_service',
            room: 'Ванная',
            expectedDays: 30,
            unitHint: 'Упаковка 3 кг',
          },
        },
      },
      {
        name: 'Хлеб и выпечка',
        description: 'Ежедневный ресурс кухни. Когда мьютекс выключается — попадает в список покупок.',
        status: FlowStatus.INACTIVE,
        tags: ['home', 'supplies', 'kitchen'],
        config: {
          widget: {
            kind: 'supply',
            icon: 'bakery_dining',
            room: 'Кухня',
            expectedDays: 3,
            unitHint: 'Свежая буханка',
          },
        },
      },
      {
        name: 'Чай и зерновой кофе',
        description: 'Запасы напитков на кухне.',
        status: FlowStatus.ACTIVE,
        tags: ['home', 'supplies', 'kitchen'],
        config: {
          widget: {
            kind: 'supply',
            icon: 'coffee',
            room: 'Кухня',
            expectedDays: 14,
            unitHint: 'Пачка 250 г',
          },
        },
      },
    ];

    for (const s of starterSupplies) {
      const created = await this.flowsService.create({
        name: s.name,
        description: s.description,
        type: FlowType.MUTEX,
        isExclusive: false,
        folderId: supplies.id,
        profileId,
        tags: s.tags,
        config: s.config,
      });
      if (s.status === FlowStatus.ACTIVE) {
        await this.flowsService.updateStatus(created.id, FlowStatus.ACTIVE, 'provision');
      }
    }

    const routine = await this.flowsService.create({
      name: 'Субботняя уборка и полив цветов',
      description: 'Scheduled Mutex: активирует окно домашней рутины по выходным с 10:00 до 14:00.',
      type: FlowType.MUTEX,
      isExclusive: false,
      folderId: routines.id,
      profileId,
      tags: ['home', 'routine', 'schedule'],
      config: {
        widget: {
          kind: 'routine',
          icon: 'cleaning_services',
          room: 'Весь дом',
          scheduleLabel: 'Сб–Вс, 10:00–14:00',
        },
      },
      orchestratorRules: {
        schedule: {
          enabled: true,
          windows: [{ days: [6, 0], start: '10:00', end: '14:00' }],
        },
      },
    });
    await this.flowsService.updateStatus(routine.id, FlowStatus.ACTIVE, 'provision');
  }
}
