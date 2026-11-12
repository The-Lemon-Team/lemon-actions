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
}
