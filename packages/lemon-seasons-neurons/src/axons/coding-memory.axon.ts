import { SeasonsCombinatorBridge } from '../bridge/seasons-combinator-bridge';
import { IngestSeasonNoteInput } from '../types/seasons.types';

export interface CodingMemoryAxonOptions {
  bridge: SeasonsCombinatorBridge;
  streamSlug?: string;
  thoughtsFeedSlug?: string;
  changelogsFeedSlug?: string;
  privacy?: 'public' | 'private';
}

export class CodingMemoryAxon {
  private readonly bridge: SeasonsCombinatorBridge;
  private readonly streamSlug: string;
  private readonly thoughtsFeedSlug: string;
  private readonly changelogsFeedSlug: string;
  private readonly privacy: 'public' | 'private';

  constructor(options: CodingMemoryAxonOptions) {
    this.bridge = options.bridge;
    this.streamSlug = options.streamSlug || 'coding-memory';
    this.thoughtsFeedSlug = options.thoughtsFeedSlug || 'coding-thoughts';
    this.changelogsFeedSlug = options.changelogsFeedSlug || 'coding-sessions';
    this.privacy = options.privacy || 'private';
  }

  async ensureTopology(): Promise<{ streamId: string; feedIds: string[] }> {
    return this.bridge.ensureTopology({
      streamSlug: this.streamSlug,
      streamTitle: 'Agent Coding Memory',
      feeds: [
        {
          slug: this.thoughtsFeedSlug,
          title: 'Coding Thoughts & Decisions',
          icon: '🧠',
          privacy: this.privacy,
          hashtags: ['coding-memory', 'agent-thought'],
        },
        {
          slug: this.changelogsFeedSlug,
          title: 'Coding Session Changelogs',
          icon: '🛠️',
          privacy: this.privacy,
          hashtags: ['coding-memory', 'session-changelog'],
        },
      ],
    });
  }

  async recordDecision(input: {
    sessionId: string;
    repoName: string;
    title: string;
    markdown: string;
    tags?: string[];
    combinatorFlowId?: string;
  }): Promise<{ noteId: string }> {
    const res = await this.bridge.ingestNote(
      {
        externalId: `coding-thought:${input.sessionId}:${Date.now()}`,
        title: input.title,
        content: input.markdown,
        summary: input.markdown.slice(0, 180),
        type: 'SINGLE',
        privacy: this.privacy,
        status: 'PUBLISHED',
        feedSlug: this.thoughtsFeedSlug,
        streamSlug: this.streamSlug,
        tags: [...(input.tags || []), 'coding-memory', `repo:${input.repoName}`],
        origin: 'CODING_AGENT',
        metadata: {
          sessionId: input.sessionId,
          repoName: input.repoName,
        },
      },
      input.combinatorFlowId,
    );

    return { noteId: res.noteId };
  }

  async recordSessionCompleted(input: {
    sessionId: string;
    repoName: string;
    taskTitle: string;
    changelogMarkdown: string;
    testsPassedCount?: number;
    filesTouched?: string[];
    combinatorFlowId?: string;
  }): Promise<{ noteId: string }> {
    const res = await this.bridge.ingestNote(
      {
        externalId: `coding-session:${input.sessionId}`,
        title: `Done: ${input.taskTitle}`,
        content: input.changelogMarkdown,
        summary: `Completed ${input.taskTitle} with ${input.testsPassedCount || 0} passed tests`,
        type: 'DONE',
        privacy: this.privacy,
        status: 'PUBLISHED',
        feedSlug: this.changelogsFeedSlug,
        streamSlug: this.streamSlug,
        tags: ['coding-session', 'done', `repo:${input.repoName}`],
        origin: 'CODING_AGENT',
        metadata: {
          sessionId: input.sessionId,
          repoName: input.repoName,
          testsPassedCount: input.testsPassedCount,
          filesTouched: input.filesTouched,
        },
      },
      input.combinatorFlowId,
    );

    return { noteId: res.noteId };
  }

  /**
   * Логирует открытие клиента / запуск рабочей сессии агента.
   */
  async recordClientLaunch(input: {
    sessionId: string;
    clientId: string;
    agentRole: string;
    workspaceRoot: string;
    repoName?: string;
    environment?: string;
    combinatorFlowId?: string;
  }): Promise<{ noteId: string }> {
    const res = await this.bridge.ingestNote(
      {
        externalId: `client-launch:${input.sessionId}`,
        title: `🚀 Client Launched: ${input.agentRole}`,
        content: `Agent initialized in workspace: \`${input.workspaceRoot}\`\nClient ID: \`${input.clientId}\`\nEnvironment: \`${input.environment || 'production'}\``,
        summary: `Agent session initialized (${input.agentRole})`,
        type: 'SINGLE',
        privacy: this.privacy,
        status: 'PUBLISHED',
        feedSlug: this.thoughtsFeedSlug,
        streamSlug: this.streamSlug,
        tags: ['client-launch', 'agent-session', `repo:${input.repoName || 'workspace'}`],
        origin: 'CODING_AGENT',
        metadata: {
          sessionId: input.sessionId,
          clientId: input.clientId,
          agentRole: input.agentRole,
          workspaceRoot: input.workspaceRoot,
        },
      },
      input.combinatorFlowId,
    );

    return { noteId: res.noteId };
  }

  /**
   * Фиксирует срез за день (End-of-Day Commit & Daily Digest).
   * Отправляет агрегированную историю за день в память агента и таймлайн Seasons.
   */
  async recordDailyDigestCommit(input: {
    date: string;
    commitHash?: string;
    tasksCompleted: Array<{ title: string; testsPassed?: number }>;
    decisions: string[];
    markdownSummary: string;
    repoName?: string;
    combinatorFlowId?: string;
  }): Promise<{ noteId: string }> {
    const repo = input.repoName || 'workspace';
    const res = await this.bridge.ingestNote(
      {
        externalId: `daily-digest:${input.date}:${input.commitHash || 'snapshot'}`,
        title: `📅 End-of-Day Digest [${input.date}] · ${input.tasksCompleted.length} tasks`,
        content: input.markdownSummary,
        summary: `EOD Digest for ${input.date}: ${input.tasksCompleted.length} tasks completed, ${input.decisions.length} decisions logged`,
        type: 'PERIOD',
        privacy: this.privacy,
        status: 'PUBLISHED',
        feedSlug: this.changelogsFeedSlug,
        streamSlug: this.streamSlug,
        tags: ['daily-digest', 'eod-commit', 'summary', `repo:${repo}`],
        origin: 'CODING_AGENT',
        metadata: {
          date: input.date,
          commitHash: input.commitHash,
          tasksCount: input.tasksCompleted.length,
          decisionsCount: input.decisions.length,
        },
      },
      input.combinatorFlowId,
    );

    return { noteId: res.noteId };
  }
}
