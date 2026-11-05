import { FlowStatus, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { buildArenaActorFlows } from '../src/seeds/arena-actors-2.seed';
import { buildArenaGameFlows } from '../src/seeds/arena-game.seed';
import { CORE_FLOWS, CORE_FOLDERS } from '../src/seeds/core.seed';
import { DACHA_HOME_FLOWS, DEFAULT_HOME_FLOWS, SEED_PROFILES } from '../src/seeds/home.seed';
import { SeedFlow } from '../src/seeds/seed.types';

try {
  process.loadEnvFile();
} catch {
  // Ignore if .env is missing
}

const prisma = new PrismaClient();

async function ensureFoldersForProfile(profileId: string): Promise<Map<string, string>> {
  const folderIds = new Map<string, string>();
  for (const f of CORE_FOLDERS) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM folders WHERE path = ${f.path}::ltree AND profile_id = ${profileId}::uuid`;
    if (existing[0]) {
      folderIds.set(f.path, existing[0].id);
      continue;
    }
    const id = randomUUID();
    const parentPath = f.path.includes('.') ? f.path.slice(0, f.path.lastIndexOf('.')) : null;
    const parentId = parentPath ? folderIds.get(parentPath) ?? null : null;
    await prisma.$executeRaw`
      INSERT INTO folders (id, name, parent_id, profile_id, path, updated_at)
      VALUES (${id}::uuid, ${f.name}, ${parentId}::uuid, ${profileId}::uuid, ${f.path}::ltree, now())`;
    folderIds.set(f.path, id);
  }
  return folderIds;
}

async function seedFlowsForProfile(
  profileId: string,
  folderIds: Map<string, string>,
  flows: SeedFlow[],
): Promise<void> {
  for (const f of flows) {
    const existingFlow = await prisma.flow.findFirst({
      where: { name: f.name, profileId },
    });

    if (existingFlow) {
      await prisma.flow.update({
        where: { id: existingFlow.id },
        data: {
          description: f.description,
          folderId: folderIds.get(f.folder) ?? existingFlow.folderId,
          config: (f.config ?? undefined) as any,
          orchestratorRules: (f.orchestratorRules ?? undefined) as any,
        },
      });
      if (f.status === FlowStatus.ACTIVE) {
        const openSession = await prisma.flowSession.findFirst({
          where: { flowId: existingFlow.id, endedAt: null },
        });
        if (!openSession) {
          await prisma.flowSession.create({ data: { flowId: existingFlow.id } });
        }
      }
      continue;
    }

    const flow = await prisma.flow.create({
      data: {
        name: f.name,
        description: f.description,
        type: f.type,
        status: f.status,
        isExclusive: f.isExclusive,
        folderId: folderIds.get(f.folder),
        profileId,
        config: (f.config ?? undefined) as any,
        orchestratorRules: (f.orchestratorRules ?? undefined) as any,
        tags: {
          create: f.tags.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
    });

    if (f.status === FlowStatus.ACTIVE) {
      await prisma.flowSession.create({ data: { flowId: flow.id } });
      await prisma.flowEvent.create({
        data: {
          flowId: flow.id,
          source: 'lemon-seed',
          eventType: 'RESTOCKED',
          payload: {
            action: 'initial_stock_seeded',
            currentQty: (f.config as any)?.widget?.currentQty,
          },
        },
      });
    }
  }
}

async function main() {
  const profilesByHandle = new Map<string, { id: string; handle: string }>();

  for (const p of SEED_PROFILES) {
    const upserted = await prisma.profile.upsert({
      where: { handle: p.handle },
      update: { displayName: p.displayName, avatarIcon: p.avatarIcon },
      create: p,
    });
    profilesByHandle.set(p.handle, upserted);
  }

  const defaultProfile = profilesByHandle.get('default')!;
  const dachaProfile = profilesByHandle.get('dacha')!;

  // Attach any pre-existing unowned folders/flows to the default profile
  await prisma.$executeRaw`
    DELETE FROM folders a USING folders b
    WHERE a.profile_id IS NULL AND b.profile_id = ${defaultProfile.id}::uuid AND a.path = b.path`;
  await prisma.$executeRaw`UPDATE folders SET profile_id = ${defaultProfile.id}::uuid WHERE profile_id IS NULL`;
  await prisma.flow.updateMany({
    where: { profileId: null },
    data: { profileId: defaultProfile.id },
  });

  const arenaFlows = [...buildArenaActorFlows(), ...buildArenaGameFlows()];

  // 1. Seed Default Profile (Core + Default Home + Arena)
  const defaultFolders = await ensureFoldersForProfile(defaultProfile.id);
  await seedFlowsForProfile(defaultProfile.id, defaultFolders, [
    ...CORE_FLOWS,
    ...DEFAULT_HOME_FLOWS,
    ...arenaFlows,
  ]);

  // 2. Seed Dacha Profile (Dacha Home + Arena)
  const dachaFolders = await ensureFoldersForProfile(dachaProfile.id);
  await seedFlowsForProfile(dachaProfile.id, dachaFolders, [
    ...DACHA_HOME_FLOWS,
    ...arenaFlows,
  ]);

  console.log('Seed complete: Default + Dacha profiles, Home flows, and 30 Neuron Arena actors seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
