import {
  CreateFlowPayload,
  Flow,
  FlowStatus,
  FlowType,
  Folder,
  HomeWidgetMeta,
  HomeWidgetView,
  RoomTask,
} from '../models/flow.models';
import { CreateHomeWidgetInput } from './home-tracker.models';

export interface WidgetState {
  oldWidget: HomeWidgetMeta;
  currentQty: number;
  maxQty: number;
  step: number;
  unit: string;
}

export function readWidgetState(flow: Flow, customAmount?: number): WidgetState {
  const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
  const currentQty =
    oldWidget.currentQty !== undefined
      ? oldWidget.currentQty
      : flow.status === FlowStatus.ACTIVE
        ? (oldWidget.maxQty ?? 1)
        : 0;
  const maxQty = oldWidget.maxQty ?? Math.max(currentQty, 1);
  const step = customAmount ?? oldWidget.step ?? 1;
  const unit = oldWidget.unit || 'ед.';
  return { oldWidget, currentQty, maxQty, step, unit };
}

export function formatScheduleLabel(flow: Flow): string {
  const win = flow.orchestratorRules?.schedule?.windows?.[0];
  return win ? `${win.start}–${win.end}` : 'По расписанию';
}

/** Преобразует flows scope `home.*` в доменные виджеты (запасы и рутины). */
export function buildHomeWidgetViews(flows: Flow[], folders: Folder[]): HomeWidgetView[] {
  return flows
    .filter((flow) => {
      const folderPath = folders.find((f) => f.id === flow.folderId)?.path ?? '';
      const rawConfig = (flow.config ?? {}) as Record<string, unknown>;
      return !rawConfig['homeTask'] && !folderPath.includes('home.tasks');
    })
    .map((flow) => {
      const folderPath = folders.find((f) => f.id === flow.folderId)?.path ?? 'home.supplies';
      const rawConfig = (flow.config ?? {}) as { widget?: HomeWidgetMeta };
      const meta: HomeWidgetMeta = rawConfig.widget ?? {};
      const isRoutine =
        meta.kind === 'routine' ||
        folderPath.includes('routines') ||
        Boolean(flow.orchestratorRules?.schedule?.enabled);

      const updatedMs = new Date(flow.updatedAt || flow.createdAt).getTime();
      const daysSinceUpdate = Math.max(0, Math.floor((Date.now() - updatedMs) / 86_400_000));

      const currentQty =
        meta.currentQty !== undefined
          ? meta.currentQty
          : flow.status === FlowStatus.ACTIVE
            ? (meta.maxQty ?? 1)
            : 0;
      const maxQty = meta.maxQty && meta.maxQty > 0 ? meta.maxQty : Math.max(currentQty, 1);
      const unit = meta.unit || (meta.unitHint ? meta.unitHint.split(' ')[1] || 'шт' : 'шт');
      const step = meta.step && meta.step > 0 ? meta.step : 1;
      const daysPerUnit = meta.daysPerUnit || 1;
      const percentage = maxQty > 0 ? Math.min(100, Math.round((currentQty / maxQty) * 100)) : 0;

      return {
        flow,
        kind: isRoutine ? 'routine' : 'supply',
        icon: meta.icon || (isRoutine ? 'schedule' : 'inventory_2'),
        room: meta.room || (isRoutine ? 'Весь дом' : 'Дом'),
        expectedDays: meta.expectedDays || 14,
        unitHint: meta.unitHint || `${maxQty} ${unit}`,
        brand: meta.brand,
        price: meta.price,
        note: meta.note,
        scheduleLabel: meta.scheduleLabel || formatScheduleLabel(flow),
        isInStock: flow.status === FlowStatus.ACTIVE || flow.status === FlowStatus.PROCESSING,
        daysSinceUpdate,
        folderPath,
        currentQty,
        maxQty,
        unit,
        step,
        daysPerUnit,
        percentage,
      } satisfies HomeWidgetView;
    });
}

/** Достаёт чек-лист задач комнат из flows с `config.homeTask`. */
export function extractRoomTasks(flows: Flow[]): RoomTask[] {
  return flows
    .filter((f) => Boolean((f.config as any)?.homeTask))
    .map((f) => {
      const ht = (f.config as any).homeTask;
      return {
        id: f.id,
        room: ht.room || 'Дом',
        title: ht.title || f.name,
        done: Boolean(ht.done),
        createdAt: f.createdAt,
        priority: ht.priority || 'medium',
      } satisfies RoomTask;
    });
}

export function buildHomeWidgetPayload(
  input: CreateHomeWidgetInput,
  profileId: string,
  folders: Folder[],
): CreateFlowPayload {
  const targetPath = input.kind === 'routine' ? 'home.routines' : 'home.supplies';
  const targetFolder =
    folders.find((f) => f.path === targetPath) ?? folders.find((f) => f.path === 'home') ?? folders[0];

  const days = input.scheduleDays?.length ? input.scheduleDays : [6, 0];
  const start = input.scheduleStart || '10:00';
  const end = input.scheduleEnd || '14:00';

  return {
    name: input.name.trim(),
    description:
      input.description?.trim() ||
      (input.kind === 'routine'
        ? 'Домашняя рутина под управлением Scheduled Mutex.'
        : 'Бытовой мьютекс наличия ресурса в доме.'),
    type: FlowType.MUTEX,
    isExclusive: false,
    folderId: targetFolder?.id ?? null,
    profileId,
    tags: input.kind === 'routine' ? ['home', 'routine', 'schedule'] : ['home', 'supplies', 'mutex'],
    config: {
      widget: {
        kind: input.kind,
        icon: input.icon || (input.kind === 'routine' ? 'cleaning_services' : 'inventory_2'),
        room: input.room.trim() || 'Дом',
        brand: input.brand?.trim() || undefined,
        unitHint: input.unitHint?.trim() || '1 шт.',
        price: input.price?.trim() || undefined,
        expectedDays: input.expectedDays || 14,
        note: input.note?.trim() || undefined,
        scheduleLabel: input.kind === 'routine' ? `${start}–${end}` : undefined,
        currentQty: input.currentQty !== undefined ? input.currentQty : (input.maxQty || 1),
        maxQty: input.maxQty !== undefined ? input.maxQty : 1,
        unit: input.unit || 'шт',
        step: input.step !== undefined ? input.step : 1,
        daysPerUnit: input.daysPerUnit || 1,
      } satisfies HomeWidgetMeta,
    },
    orchestratorRules:
      input.kind === 'routine'
        ? { schedule: { enabled: true, windows: [{ days, start, end }] } }
        : undefined,
  };
}
