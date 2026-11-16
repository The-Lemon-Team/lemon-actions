import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import {
  NoteTodoItem,
  SeasonsApiClient,
  SeasonsSseBus,
  SeasonsSsePacket,
  SeasonsTopologySnapshot,
  computeTodoStats,
  extractTodoListFromNote,
} from '@lemon/seasons-neurons';
import { ProjectariumProject } from '@lemon/projectarium';
import {
  ProjectariumChangeEvent,
  ProjectariumService,
} from '../projectarium/projectarium.service';
import {
  CreateSeasonFeedDto,
  CreateSeasonStreamDto,
  IngestSeasonNoteDto,
  ProxyNoteTodosDto,
} from './seasons.dto';

export const PROJECTARIUM_STREAM_SLUG = 'projectarium';
export const PROJECTARIUM_PROJECTS_FEED_SLUG = 'projectarium-projects';
export const PROJECTARIUM_TODOS_FEED_SLUG = 'projectarium-todos';
export const PROJECTARIUM_NOTES_FEED_SLUG = 'projectarium-notes';
export const PROJECTARIUM_CHRONICLE_FEED_SLUG = 'projectarium-chronicle';

@Injectable()
export class SeasonsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeasonsService.name);
  public readonly baseUrl: string;
  private readonly client: SeasonsApiClient;
  private readonly sseBus: SeasonsSseBus;
  private projectariumSub: Subscription | null = null;
  private namespaceEnsured = false;

  constructor(
    @Optional() private readonly projectariumService?: ProjectariumService,
  ) {
    this.baseUrl = (process.env.LEMON_SEASONS_URL || 'http://127.0.0.1:3002').replace(
      /\/+$/,
      '',
    );
    const token =
      process.env.LEMON_SEASONS_TOKEN ||
      process.env.ADMIN_TOKEN ||
      'lenta_adm_master_permanent_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c';

    this.client = new SeasonsApiClient({ baseUrl: this.baseUrl, token });
    this.sseBus = new SeasonsSseBus({
      baseUrl: this.baseUrl,
      token,
      includeTopology: true,
    });
  }

  onModuleInit(): void {
    this.sseBus.connect({ includeTopology: true });

    if (this.projectariumService) {
      this.projectariumSub = this.projectariumService
        .changes$()
        .subscribe((change) => {
          void this.handleProjectariumChange(change);
        });
    }
  }

  onModuleDestroy(): void {
    if (this.projectariumSub) {
      this.projectariumSub.unsubscribe();
      this.projectariumSub = null;
    }
    this.sseBus.disconnect();
  }

  events$(): Observable<SeasonsSsePacket> {
    return this.sseBus.packets$();
  }

  async getStatus(): Promise<{
    baseUrl: string;
    connected: boolean;
    projectariumStreamSlug: string;
    error?: string;
  }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      return {
        baseUrl: this.baseUrl,
        connected: res.ok,
        projectariumStreamSlug: PROJECTARIUM_STREAM_SLUG,
      };
    } catch (error) {
      return {
        baseUrl: this.baseUrl,
        connected: false,
        projectariumStreamSlug: PROJECTARIUM_STREAM_SLUG,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getTopology(params?: {
    streamSlug?: string;
    privacy?: 'public' | 'private' | 'all';
    days?: number;
  }): Promise<SeasonsTopologySnapshot> {
    return this.client.getTopology({
      privacy: params?.privacy || 'all',
      streamSlug: params?.streamSlug,
      days: params?.days,
    });
  }

  async ensureStream(dto: CreateSeasonStreamDto): Promise<any> {
    return this.client.ensureStream({
      slug: dto.slug,
      title: dto.title,
      description: dto.description,
      icon: dto.icon,
      color: dto.color,
      privacy: dto.privacy || 'private',
      feedIds: dto.feedIds,
    });
  }

  async ensureFeedAndAttach(dto: CreateSeasonFeedDto): Promise<any> {
    const feed = await this.client.ensureFeed({
      slug: dto.slug,
      title: dto.title,
      description: dto.description,
      icon: dto.icon || 'dynamic_feed',
      color: dto.color,
      privacy: dto.privacy || 'private',
      hashtags: dto.hashtags,
    });

    if (dto.streamSlug && feed?.id) {
      const stream = await this.client.ensureStream({
        slug: dto.streamSlug,
        title: dto.streamSlug,
        privacy: dto.privacy || 'private',
      });
      if (stream?.id) {
        const existingFeedIds: string[] = Array.isArray(stream.feedIds) ? stream.feedIds : [];
        if (!existingFeedIds.includes(feed.id)) {
          await this.client.attachFeedToStream(stream.id, feed.id);
        }
      }
    }

    return feed;
  }

  async getFeedNotes(
    feedSlug: string,
    params: { limit?: number; offset?: number; search?: string; type?: string },
  ) {
    return this.client.getFeedNotesPage(feedSlug, {
      privacy: 'all',
      limit: params.limit ?? 30,
      offset: params.offset ?? 0,
      search: params.search,
      type: params.type,
    });
  }

  async getStreamNotes(
    streamSlug: string,
    params: { limit?: number; offset?: number; search?: string; type?: string },
  ) {
    return this.client.getStreamNotesPage(streamSlug, {
      privacy: 'all',
      limit: params.limit ?? 30,
      offset: params.offset ?? 0,
      search: params.search,
      type: params.type,
    });
  }

  async getNote(noteId: string) {
    const note = await this.client.getNote(noteId);
    const todoList = extractTodoListFromNote(note);
    return {
      ...note,
      todoList,
      todoStats: computeTodoStats(todoList),
    };
  }

  async ingestNote(dto: IngestSeasonNoteDto) {
    const todoList: NoteTodoItem[] | undefined = dto.todoList?.map((t, idx) => ({
      id: t.id || `todo-${Date.now()}-${idx + 1}`,
      title: t.title,
      completed: Boolean(t.completed),
      priority: t.priority || 'MEDIUM',
      scope: t.scope || 'PROJECT',
      targetAppName: t.targetAppName,
      author: t.author || dto.author || 'lemon-actions',
      createdAt: new Date().toISOString(),
      completedAt: t.completed ? new Date().toISOString() : null,
    }));

    return this.client.ingestNote({
      externalId: dto.externalId,
      title: dto.title,
      content: dto.content,
      summary: dto.summary,
      type: dto.type || (todoList ? 'PERIOD' : 'SINGLE'),
      privacy: dto.privacy || 'private',
      status: 'PUBLISHED',
      streamSlug: dto.streamSlug,
      feedSlug: dto.feedSlug,
      author: dto.author || 'lemon-actions',
      tags: dto.tags,
      origin: 'LEMON_ACTIONS_PROXY',
      todoList,
    });
  }

  /**
   * Proxies todo list mutations directly onto a Note in Lemon Seasons.
   */
  async proxyNoteTodos(noteId: string, dto: ProxyNoteTodosDto) {
    const current = await this.client.getNote<any>(noteId);
    let nextList = extractTodoListFromNote(current);

    switch (dto.action) {
      case 'add': {
        if (!dto.title || !dto.title.trim()) {
          throw new BadRequestException('Title is required to add a todo item');
        }
        nextList = [
          ...nextList,
          {
            id: dto.todoId || `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: dto.title.trim(),
            completed: false,
            priority: dto.priority || 'MEDIUM',
            scope: dto.scope || 'PROJECT',
            targetAppName: dto.targetAppName,
            author: dto.author || 'user',
            createdAt: new Date().toISOString(),
            completedAt: null,
          },
        ];
        break;
      }
      case 'toggle': {
        if (!dto.todoId) {
          throw new BadRequestException('todoId is required to toggle a todo item');
        }
        nextList = nextList.map((item) => {
          if (item.id !== dto.todoId) return item;
          const completed = !item.completed;
          return {
            ...item,
            completed,
            completedAt: completed ? new Date().toISOString() : null,
          };
        });
        break;
      }
      case 'remove': {
        if (!dto.todoId) {
          throw new BadRequestException('todoId is required to remove a todo item');
        }
        nextList = nextList.filter((item) => item.id !== dto.todoId);
        break;
      }
      case 'replace': {
        nextList = (dto.todoList || []).map((t, idx) => ({
          id: t.id || `todo-${Date.now()}-${idx + 1}`,
          title: t.title,
          completed: Boolean(t.completed),
          priority: t.priority || 'MEDIUM',
          scope: t.scope || 'PROJECT',
          targetAppName: t.targetAppName,
          author: t.author,
          createdAt: new Date().toISOString(),
          completedAt: t.completed ? new Date().toISOString() : null,
        }));
        break;
      }
    }

    const updatedNote = await this.client.updateNoteTodoList(noteId, nextList);
    return {
      note: updatedNote,
      todoList: nextList,
      todoStats: computeTodoStats(nextList),
    };
  }

  /**
   * Creates or ensures the private 'projectarium' stream and its core feeds.
   */
  async ensureProjectariumNamespace(): Promise<{ streamId: string; feedIds: string[] }> {
    const feedConfigs = [
      {
        slug: PROJECTARIUM_PROJECTS_FEED_SLUG,
        title: 'Projectarium Projects',
        description:
          'Единая лента ведения проектов и межпроектных изменений под эгидой Lemon Projectarium',
        icon: '🚀',
        color: '#3b82f6',
        privacy: 'private' as const,
        hashtags: ['projectarium', 'projects'],
      },
      {
        slug: PROJECTARIUM_TODOS_FEED_SLUG,
        title: 'Projectarium Todo Lists',
        icon: '✅',
        color: '#10b981',
        privacy: 'private' as const,
        hashtags: ['projectarium', 'todolist'],
      },
      {
        slug: PROJECTARIUM_NOTES_FEED_SLUG,
        title: 'Projectarium Notes & Stories',
        icon: '📝',
        color: '#f59e0b',
        privacy: 'private' as const,
        hashtags: ['projectarium', 'notes'],
      },
      {
        slug: PROJECTARIUM_CHRONICLE_FEED_SLUG,
        title: 'Projectarium Chronicle',
        icon: '📜',
        color: '#6366f1',
        privacy: 'private' as const,
        hashtags: ['projectarium', 'chronicle'],
      },
    ];

    const feedIds: string[] = [];
    for (const cfg of feedConfigs) {
      const feed = await this.client.ensureFeed(cfg);
      if (feed?.id) feedIds.push(feed.id);
    }

    const stream = await this.client.ensureStream({
      slug: PROJECTARIUM_STREAM_SLUG,
      title: 'Projectarium Workspace',
      description: 'Приватный namespace для историй, хронологий, заметок и todo-листов стендов Projectarium',
      icon: '🏛️',
      color: '#f59e0b',
      privacy: 'private',
      feedIds,
    });

    const streamId = stream?.id || PROJECTARIUM_STREAM_SLUG;
    const existingFeedIds: string[] = Array.isArray(stream?.feedIds) ? stream.feedIds : [];
    for (const feedId of feedIds) {
      if (!existingFeedIds.includes(feedId)) {
        await this.client.attachFeedToStream(streamId, feedId);
      }
    }

    this.namespaceEnsured = true;
    return { streamId, feedIds };
  }

  /**
   * Projects a Projectarium stand (todos list, notes, chronicle snapshot) into Lemon Seasons.
   */
  async syncProjectariumStand(slugOrToken: string) {
    if (!this.projectariumService) {
      throw new BadRequestException('ProjectariumService is not available');
    }
    const project = this.projectariumService.getProject(slugOrToken);
    if (!this.namespaceEnsured) {
      await this.ensureProjectariumNamespace();
    }

    const projectRes = await this.projectStandOverview(project);
    const todosRes = await this.projectStandTodoList(project);
    let notesSynced = 0;
    for (const note of project.notes || []) {
      await this.projectStandNote(project, note);
      notesSynced++;
    }
    const chronicleRes = await this.projectStandChronicle(project);

    return {
      success: true,
      projectSlug: project.slug,
      streamSlug: PROJECTARIUM_STREAM_SLUG,
      projectNoteId: projectRes.noteId,
      todosNoteId: todosRes.noteId,
      notesSynced,
      chronicleNoteId: chronicleRes?.noteId || null,
    };
  }

  private async handleProjectariumChange(change: ProjectariumChangeEvent): Promise<void> {
    try {
      if (!this.namespaceEnsured) {
        await this.ensureProjectariumNamespace();
      }
      if (change.kind === 'STAND_CREATED') {
        await this.projectStandOverview(change.project);
      }
      if (change.kind === 'TODO_CHANGED' || change.kind === 'STAND_CREATED') {
        await this.projectStandTodoList(change.project);
      }
      if (change.kind === 'NOTE_CHANGED' && change.note) {
        await this.projectStandNote(change.project, change.note);
      }
      if (change.kind === 'CHRONICLE_ADDED') {
        await this.projectStandChronicle(change.project);
      }
    } catch (error) {
      this.logger.debug(
        `Non-blocking Seasons sync skipped for '${change.project.slug}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async projectStandOverview(project: ProjectariumProject) {
    const stack = project.context?.stack?.length ? project.context.stack.join(', ') : '—';
    const appsCount = project.apps?.length || 0;
    const todosCount = project.todos?.length || 0;
    const lines = [
      project.context?.description || `Стенд проекта **${project.name}** (\`${project.slug}\`).`,
      '',
      `- **Slug**: \`${project.slug}\``,
      `- **Neuron Workspace**: \`${project.neuronWorkspace}\``,
      `- **Стек**: ${stack}`,
      `- **Сервисов / портов**: ${appsCount}`,
      `- **Задач в чек-листе**: ${todosCount}`,
    ];

    return this.client.ingestNote({
      externalId: `projectarium:project:${project.slug}`,
      title: `🚀 ${project.name}`,
      content: lines.join('\n'),
      summary: project.context?.description || `Стенд ${project.name} (${appsCount} сервисов)`,
      type: 'SINGLE',
      privacy: 'private',
      status: 'PUBLISHED',
      streamSlug: PROJECTARIUM_STREAM_SLUG,
      feedSlug: PROJECTARIUM_PROJECTS_FEED_SLUG,
      icon: '🚀',
      author: 'projectarium-sync',
      tags: ['projectarium', 'projects', `stand:${project.slug}`, `project:${project.slug}`],
      origin: 'PROJECTARIUM_SYNC',
      metadata: {
        projectSlug: project.slug,
        projectName: project.name,
        neuronWorkspace: project.neuronWorkspace,
      },
    });
  }

  private async projectStandTodoList(project: ProjectariumProject) {
    const todoList: NoteTodoItem[] = (project.todos || []).map((t) => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      priority: t.priority,
      scope: t.scope,
      targetAppName: t.targetAppName,
      author: t.author,
      createdAt: t.createdAt,
      completedAt: t.completedAt ?? null,
    }));

    return this.client.ingestNote({
      externalId: `projectarium:todos:${project.slug}`,
      title: `${project.name} — Todo List`,
      content: `Оперативный чек-лист стенда **${project.name}** (\`${project.slug}\`).`,
      type: 'PERIOD',
      privacy: 'private',
      status: 'PUBLISHED',
      streamSlug: PROJECTARIUM_STREAM_SLUG,
      feedSlug: PROJECTARIUM_TODOS_FEED_SLUG,
      icon: '✅',
      author: 'projectarium-sync',
      tags: ['projectarium', 'todolist', `stand:${project.slug}`],
      origin: 'PROJECTARIUM_SYNC',
      todoList,
      metadata: {
        projectSlug: project.slug,
        projectName: project.name,
        neuronWorkspace: project.neuronWorkspace,
      },
    });
  }

  private async projectStandNote(
    project: ProjectariumProject,
    note: { id: string; title?: string; content: string; author: string; tags?: string[] },
  ) {
    return this.client.ingestNote({
      externalId: `projectarium:note:${project.slug}:${note.id}`,
      title: note.title || `Note · ${project.name}`,
      content: note.content,
      type: 'SINGLE',
      privacy: 'private',
      status: 'PUBLISHED',
      streamSlug: PROJECTARIUM_STREAM_SLUG,
      feedSlug: PROJECTARIUM_NOTES_FEED_SLUG,
      icon: '📝',
      author: note.author || 'developer',
      tags: ['projectarium', `stand:${project.slug}`, ...(note.tags || [])],
      origin: 'PROJECTARIUM_SYNC',
      metadata: {
        projectSlug: project.slug,
        standNoteId: note.id,
      },
    });
  }

  private async projectStandChronicle(project: ProjectariumProject) {
    const recent = (project.chronicle || []).slice(0, 25);
    if (recent.length === 0) return null;

    const dateKey = new Date().toISOString().split('T')[0];
    const lines = recent.map(
      (ev) =>
        `- \`${new Date(ev.timestamp).toLocaleTimeString('ru-RU')}\` **[${ev.type}]**${
          ev.targetAppName ? ` (${ev.targetAppName})` : ''
        }: ${ev.description} — _${ev.author}_`,
    );

    return this.client.ingestNote({
      externalId: `projectarium:chronicle:${project.slug}:${dateKey}`,
      title: `📜 ${project.name} — Хронология [${dateKey}]`,
      content: lines.join('\n'),
      summary: `Срез хронологии ${project.name}: ${recent.length} событий`,
      type: 'PERIOD',
      privacy: 'private',
      status: 'PUBLISHED',
      streamSlug: PROJECTARIUM_STREAM_SLUG,
      feedSlug: PROJECTARIUM_CHRONICLE_FEED_SLUG,
      icon: '📜',
      author: 'projectarium-sync',
      tags: ['projectarium', 'chronicle', `stand:${project.slug}`, `date:${dateKey}`],
      origin: 'PROJECTARIUM_SYNC',
      metadata: {
        projectSlug: project.slug,
        eventsCount: recent.length,
        dateKey,
      },
    });
  }
}
