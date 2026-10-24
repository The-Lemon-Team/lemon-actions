import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { flows: true } } },
    });
    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      colorHex: t.colorHex ?? undefined,
      flowCount: t._count.flows,
    }));
  }
}

@Controller('tags')
export class TagsController {
  constructor(private readonly service: TagsService) {}

  @Get()
  list() {
    return this.service.list();
  }
}

@Module({
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
