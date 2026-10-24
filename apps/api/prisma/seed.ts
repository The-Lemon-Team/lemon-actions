import { FlowStatus, FlowType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const FOLDERS: { name: string; path: string }[] = [
  { name: 'Workspace', path: 'workspace' },
  { name: 'Core Services', path: 'workspace.core' },
  { name: 'Billing Pipelines', path: 'workspace.billing' },
  { name: 'Infrastructure', path: 'infrastructure' },
  { name: 'Focus Modes', path: 'focus_modes' },
  { name: 'Event Hooks', path: 'event_hooks' },
  { name: 'Archival Tasks', path: 'archival' },
];

const deepWorkFsm = {
  initial: 'idle',
  states: {
    idle: {
      label: 'Idle',
      badgeColor: '#9ca3af',
      transitions: [
        { event: 'START', target: 'focusing', ui: { buttonLabel: 'Start Focus', icon: 'play_arrow', intent: 'primary' } },
      ],
    },
    focusing: {
      label: 'Focusing',
      badgeColor: '#16a34a',
      transitions: [
        { event: 'BREAK', target: 'break', ui: { buttonLabel: 'Take Break', icon: 'coffee', intent: 'secondary' } },
        { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
      ],
    },
    break: {
      label: 'On Break',
      badgeColor: '#f59e0b',
      transitions: [
        { event: 'RESUME', target: 'focusing', ui: { buttonLabel: 'Resume', icon: 'play_arrow', intent: 'primary' } },
        { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
      ],
    },
  },
};

const FLOWS = [
  { name: 'Database Sync', description: 'Keeps primary and replica databases in sync; only one sync may run at a time.', type: FlowType.MUTEX, status: FlowStatus.ACTIVE, isExclusive: true, folder: 'workspace.core', tags: ['infra', 'db', 'mutex'], orchestratorRules: { onConflict: 'reject' } },
  { name: 'Deep Work State Machine', description: 'Tracks focus, break and idle states for deep work sessions.', type: FlowType.FSM, status: FlowStatus.INACTIVE, isExclusive: false, folder: 'focus_modes', tags: ['focus', 'daily', 'routine'], config: deepWorkFsm },
  { name: 'Token Refresh Engine', description: 'Periodically refreshes auth tokens before they expire.', type: FlowType.TIMER, status: FlowStatus.ACTIVE, isExclusive: false, folder: 'workspace.core', tags: ['auth', 'security', 'routine'], config: { intervalSeconds: 3300 } },
  { name: 'Webhook Ingestion Router', description: 'Observes incoming webhook streams and routes them to handlers.', type: FlowType.OBSERVER, status: FlowStatus.PAUSED, isExclusive: false, folder: 'event_hooks', tags: ['webhook', 'stream', 'fsm'] },
  { name: 'Memory Compactor', description: 'Compacts in-memory caches to reclaim resources.', type: FlowType.MUTEX, status: FlowStatus.ACTIVE, isExclusive: false, folder: 'infrastructure', tags: ['infrastructure', 'mutex', 'routine'] },
];

async function main() {
  const folderIds = new Map<string, string>();
  for (const f of FOLDERS) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM folders WHERE path = ${f.path}::ltree`;
    if (existing[0]) {
      folderIds.set(f.path, existing[0].id);
      continue;
    }
    const id = randomUUID();
    const parentPath = f.path.includes('.') ? f.path.slice(0, f.path.lastIndexOf('.')) : null;
    const parentId = parentPath ? folderIds.get(parentPath) ?? null : null;
    await prisma.$executeRaw`
      INSERT INTO folders (id, name, parent_id, path, updated_at)
      VALUES (${id}::uuid, ${f.name}, ${parentId}::uuid, ${f.path}::ltree, now())`;
    folderIds.set(f.path, id);
  }

  for (const f of FLOWS) {
    if (await prisma.flow.findFirst({ where: { name: f.name } })) continue;
    const flow = await prisma.flow.create({
      data: {
        name: f.name,
        description: f.description,
        type: f.type,
        status: f.status,
        isExclusive: f.isExclusive,
        folderId: folderIds.get(f.folder),
        config: (f as any).config,
        orchestratorRules: (f as any).orchestratorRules,
        tags: {
          create: f.tags.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
    });
    if (f.status === FlowStatus.ACTIVE) {
      await prisma.flowSession.create({ data: { flowId: flow.id } });
    }
  }
  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
