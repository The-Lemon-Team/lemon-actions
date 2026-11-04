import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FlowStatus, Prisma } from '@prisma/client';
import { CreateFlowDto, CreateFlowEventDto, ListFlowsQueryDto, UpdateFlowDto } from './flow.dto';
import { FlowView, FlowsRepository, toFlowView } from './flows.repository';
import { FlowTypeRegistry } from './handlers/flow-type.registry';

const RUNNING: FlowStatus[] = [FlowStatus.ACTIVE, FlowStatus.PROCESSING];
const isRunning = (s: FlowStatus) => RUNNING.includes(s);

/**
 * Orchestrator rules (flow.orchestratorRules JSON), used only when flow.isExclusive = true:
 *   { "onConflict": "reject" | "pause" }   (default "reject")
 * Exclusivity scope: other exclusive flows in the SAME folder (folderId equal, null = root).
 *  - reject: activating returns 409 Conflict while another exclusive flow runs.
 *  - pause : the conflicting flows are set to PAUSED and their sessions closed (closed_by = "flow:<id>").
 */
@Injectable()
export class FlowsService {
  constructor(
    private readonly repo: FlowsRepository,
    private readonly registry: FlowTypeRegistry,
  ) {}

  async list(q: ListFlowsQueryDto): Promise<FlowView[]> {
    return (await this.repo.findMany(q)).map(toFlowView);
  }

  async metrics(profileId?: string) {
    const c = await this.repo.countByStatus(profileId);
    return {
      registered: c.INACTIVE + c.ACTIVE + c.PAUSED + c.PROCESSING,
      executing: c.ACTIVE + c.PROCESSING,
      paused: c.PAUSED,
      standby: c.INACTIVE,
    };
  }

  async findOne(id: string): Promise<FlowView> {
    return toFlowView(await this.require(id));
  }

  async create(dto: CreateFlowDto): Promise<FlowView> {
    this.registry.get(dto.type).validateConfig(dto.config);
    const folderMeta = await this.assertFolder(dto.folderId);
    const resolvedProfileId = dto.profileId ?? folderMeta?.profileId ?? null;

    const flow = await this.repo.create(
      {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        isExclusive: dto.isExclusive ?? false,
        folder: dto.folderId ? { connect: { id: dto.folderId } } : undefined,
        profile: resolvedProfileId ? { connect: { id: resolvedProfileId } } : undefined,
        config: this.json(dto.config),
        orchestratorRules: this.json(dto.orchestratorRules),
      },
      this.uniqueTags(dto.tags),
    );
    return toFlowView(flow);
  }

  async update(id: string, dto: UpdateFlowDto): Promise<FlowView> {
    const current = await this.require(id);
    const type = dto.type ?? current.type;
    this.registry.get(type).validateConfig(dto.config !== undefined ? dto.config : current.config);
    if (dto.folderId !== undefined) await this.assertFolder(dto.folderId);

    const data: Prisma.FlowUpdateInput = {
      name: dto.name,
      description: dto.description,
      type: dto.type,
      isExclusive: dto.isExclusive,
      folder: dto.folderId === undefined ? undefined : dto.folderId ? { connect: { id: dto.folderId } } : { disconnect: true },
      config: dto.config === undefined ? undefined : this.json(dto.config),
      orchestratorRules: dto.orchestratorRules === undefined ? undefined : this.json(dto.orchestratorRules),
    };
    const tags = dto.tags ? this.uniqueTags(dto.tags) : undefined;
    return toFlowView(await this.repo.update(id, data, tags));
  }

  async remove(id: string): Promise<void> {
    await this.require(id);
    await this.repo.delete(id);
  }

  async updateStatus(id: string, next: FlowStatus, closedBy = 'user'): Promise<FlowView> {
    return this.repo.transaction(async (tx) => {
      const flow = await this.repo.findById(id, tx);
      if (!flow) throw new NotFoundException(`Flow ${id} not found`);
      if (flow.status === next) return toFlowView(flow);

      if (flow.isExclusive && isRunning(next) && !isRunning(flow.status)) {
        const conflicts = await this.repo.findRunningExclusive(flow.folderId, flow.id, tx);
        if (conflicts.length) {
          const rules = (flow.orchestratorRules ?? {}) as { onConflict?: string };
          if (rules.onConflict !== 'pause') {
            throw new ConflictException(
              `Exclusive flow(s) already running: ${conflicts.map((c) => c.name).join(', ')}`,
            );
          }
          for (const other of conflicts) {
            await this.repo.setStatus(other.id, FlowStatus.PAUSED, tx);
            await this.repo.closeSessions(other.id, `flow:${flow.id}`, tx);
          }
        }
      }

      const updated = await this.repo.setStatus(id, next, tx);
      if (isRunning(next)) {
        if (!(await this.repo.hasOpenSession(id, tx))) await this.repo.openSession(id, tx);
      } else {
        await this.repo.closeSessions(id, closedBy, tx);
      }
      return toFlowView(updated);
    });
  }

  async listSessions(id: string) {
    await this.require(id);
    return this.repo.listSessions(id);
  }

  async listEvents(id: string, sessionId?: string) {
    await this.require(id);
    return this.repo.listEvents(id, sessionId);
  }

  /**
   * Записывает событие напрямую в поток, не отсекая историю,
   * и автоматически прикрепляет слепок всех активных сессий в данном контейнере-папке (Neuron).
   */
  async appendEvent(id: string, dto: CreateFlowEventDto) {
    const flow = await this.require(id);
    return this.repo.transaction(async (tx) => {
      const openSessions = await this.repo.findOpenSessionsInFolder(flow.folderId, flow.id, tx);
      await this.repo.touchFlow(flow.id, tx);
      return this.repo.createFlowEvent(
        {
          flowId: flow.id,
          source: dto.source ?? 'external',
          eventType: dto.eventType,
          payload: (dto.payload ?? {}) as Prisma.InputJsonObject,
          activeFlowSessionIds: openSessions.map((s) => s.id),
        },
        tx,
      );
    });
  }

  private async require(id: string) {
    const f = await this.repo.findById(id);
    if (!f) throw new NotFoundException(`Flow ${id} not found`);
    return f;
  }

  private async assertFolder(folderId?: string | null) {
    if (!folderId) return null;
    const meta = await this.repo.getFolderMeta(folderId);
    if (!meta) {
      throw new BadRequestException(`Folder ${folderId} does not exist`);
    }
    return meta;
  }

  private uniqueTags(tags?: string[]): string[] {
    return [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))];
  }

  private json(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (v === undefined) return undefined;
    if (v === null) return Prisma.JsonNull;
    return v as Prisma.InputJsonValue;
  }
}
