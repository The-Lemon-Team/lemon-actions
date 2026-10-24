import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './event.dto';
import { validateEventPayload } from './event-payload.validators';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actionId?: string) {
    return this.prisma.actionEvent.findMany({
      where: { actionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateEventDto) {
    validateEventPayload(dto.eventType, dto.payload);

    const action = await this.prisma.action.findUnique({ where: { id: dto.actionId } });
    if (!action) throw new NotFoundException(`Action ${dto.actionId} not found`);

    // Snapshot the open sessions of flows the card subscribes to whose status matches the requirement.
    const subs = await this.prisma.cardFlowSubscription.findMany({ where: { cardId: action.cardId }, include: { flow: true } });
    const matching = subs.filter((s) => s.flow.status === s.requiredStatus).map((s) => s.flowId);
    const sessions = matching.length
      ? await this.prisma.flowSession.findMany({ where: { flowId: { in: matching }, endedAt: null }, select: { id: true } })
      : [];

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.actionEvent.create({
        data: {
          actionId: dto.actionId,
          eventType: dto.eventType,
          payload: dto.payload as Prisma.InputJsonObject,
          activeFlowSessionIds: sessions.map((s) => s.id),
        },
      });
      if (dto.eventType === 'STATE_CHANGE') {
        await tx.action.update({ where: { id: action.id }, data: { currentState: String(dto.payload.to) } });
      }
      return event;
    });
  }
}
