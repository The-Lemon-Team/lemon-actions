import {
  SeasonsApiClient,
  computeTodoStats,
  extractTodoListFromNote,
} from '../src/client/seasons-api.client';
import { SeasonsSseBus } from '../src/client/seasons-sse.bus';
import { SeasonsCombinatorBridge } from '../src/bridge/seasons-combinator-bridge';
import { CodingMemoryAxon } from '../src/axons/coding-memory.axon';
import { DailyTimelineAxon } from '../src/axons/daily-timeline.axon';

async function runSeasonsBridgeTests() {
  console.log('=== Running Lemon-Seasons-Neurons Bridge Verification Tests ===\n');

  const seasonsDb = {
    streams: new Map<string, any>(),
    feeds: new Map<string, any>(),
    notes: [] as any[],
  };

  const combinatorDb = {
    chronicleEvents: [] as any[],
    subscribers: [] as Array<(packet: any) => void>,
  };

  // Mock SeasonsApiClient
  const mockSeasonsApi = {
    baseUrl: 'http://localhost:5000',
    ensureStream: async (input: any) => {
      const existing = seasonsDb.streams.get(input.slug);
      if (existing) return existing;
      const created = { id: `stream-${input.slug}`, ...input };
      seasonsDb.streams.set(input.slug, created);
      return created;
    },
    ensureFeed: async (input: any) => {
      const created = { id: `feed-${input.slug}`, ...input };
      seasonsDb.feeds.set(input.slug, created);
      return created;
    },
    attachFeedToStream: async (streamId: string, feedId: string) => {
      for (const s of seasonsDb.streams.values()) {
        if (s.id === streamId && !s.feedIds?.includes(feedId)) {
          s.feedIds = [...(s.feedIds || []), feedId];
        }
      }
      return { success: true };
    },
    ingestNote: async (input: any) => {
      const apiHelper = new SeasonsApiClient({ baseUrl: 'http://localhost:5000' });
      const prepared = (apiHelper as any).prepareIngestPayload(input);
      const note = { id: `note-${seasonsDb.notes.length + 1}`, ...prepared, createdAt: new Date().toISOString() };
      seasonsDb.notes.push(note);
      return { success: true, action: 'CREATED' as const, isNew: true, noteId: note.id, note };
    },
    getNotesPage: async (q: any) => {
      let filtered = seasonsDb.notes;
      if (q.feedSlug) filtered = filtered.filter((n) => n.feedSlug === q.feedSlug);
      return { total: filtered.length, limit: 30, offset: 0, hasMore: false, items: filtered };
    },
  } as unknown as SeasonsApiClient;

  // Mock CoreCombinatorClient
  const mockCombinator = {
    baseUrl: 'http://localhost:3000',
    chronicle: {
      emit: async (flowId: string, event: any) => {
        const ev = { id: `chronicle-${combinatorDb.chronicleEvents.length + 1}`, flowId, ...event };
        combinatorDb.chronicleEvents.push(ev);
        return ev;
      },
    },
    stream: {
      subscribe: (_filter: any, callback: (packet: any) => void) => {
        combinatorDb.subscribers.push(callback);
        return () => {
          const idx = combinatorDb.subscribers.indexOf(callback);
          if (idx >= 0) combinatorDb.subscribers.splice(idx, 1);
        };
      },
    },
    batch: {
      push: async () => ({ enqueued: 1, pendingTotal: 1 }),
      onFlush: (_flowId: string, _cb: any) => () => {},
    },
    neurons: {
      ensureCompositeNeuron: async (def: any) => ({
        neuron: { id: 'neuron-daily-1', name: def.name, path: def.path },
        flows: {
          batch: { id: 'batch-flow-1', name: 'Day Influx' },
          timer: { id: 'timer-flow-1', name: 'Evening Timer' },
          mutex: { id: 'mutex-flow-1', name: 'Review Mutex' },
          observer: { id: 'observer-flow-1', name: 'Timeline Observer' },
        },
      }),
    },
  } as any;

  // 1. Инициализация Bridge
  console.log('Test 1: SeasonsCombinatorBridge Topology Initialization');
  const bridge = new SeasonsCombinatorBridge({
    combinator: mockCombinator,
    seasons: mockSeasonsApi,
    defaultStreamSlug: 'developer-workspace',
  });

  const topology = await bridge.ensureTopology({
    streamSlug: 'developer-workspace',
    streamTitle: 'Workspace Stream',
    feeds: [
      { slug: 'dev-changelogs', title: 'Developer Changelogs' },
      { slug: 'daily-notes', title: 'Daily History' },
    ],
  });

  if (seasonsDb.feeds.size !== 2 || !seasonsDb.streams.has('developer-workspace')) {
    throw new Error('Expected topology (stream + 2 feeds) to be registered');
  }
  console.log('  ✓ Топология Stream ("developer-workspace") и 2 Feeds успешно зарегистрирована в Lemon Seasons!');

  // 2. Тестирование прямой вставки заметок с зеркалированием в Combinator Chronicle
  console.log('\nTest 2: Note Ingestion with Mirror Chronicle Snapshot');
  const ingestResult = await bridge.ingestNote(
    {
      title: 'Architectural Spike: Core Combinator Gating',
      content: 'Refactored Activation Gate to support consensus quorums.',
      type: 'SINGLE',
      feedSlug: 'dev-changelogs',
      tags: ['#architecture', '#combinator'],
    },
    'flow-mutex-123',
  );

  if (seasonsDb.notes.length !== 1 || ingestResult.noteId !== 'note-1') {
    throw new Error('Expected note to be created in Seasons DB');
  }
  if (
    combinatorDb.chronicleEvents.length !== 1 ||
    combinatorDb.chronicleEvents[0].eventType !== 'SEASONS_NOTE_INGESTED'
  ) {
    throw new Error('Expected mirror SEASONS_NOTE_INGESTED event in Core Combinator Chronicle');
  }
  console.log('  ✓ Заметка сохранена в Seasons и зеркалирована в FlowChronicle ядра!');

  // 3. Тестирование привязки Нейрона к Фиду (Neuron-to-Feed Binding)
  console.log('\nTest 3: Reactive Feed-Neuron Binding on BATCH_FLUSH');
  bridge.bindNeuronToFeed({
    folderId: 'folder-news-watcher',
    streamSlug: 'developer-workspace',
    feedSlug: 'daily-notes',
  });

  // Эмулируем импульс BATCH_FLUSH от Core Combinator
  const fakePacket = {
    id: 'impulse-batch-1',
    type: 'BATCH_FLUSH',
    folderId: 'folder-news-watcher',
    flowId: 'batch-flow-1',
    flowName: 'News Buffer',
    flowType: 'BATCH',
    timestamp: new Date().toISOString(),
    payload: {
      batchId: 'batch-999',
      itemsCount: 2,
      items: [{ payload: { title: 'First pulse' } }, { payload: { title: 'Second pulse' } }],
    },
  };

  for (const sub of combinatorDb.subscribers) {
    await sub(fakePacket);
  }

  const batchNote = seasonsDb.notes.find((n) => n.externalId?.includes('batch-flow-1') || n.title?.includes('Batch Flush'));
  if (!batchNote) {
    throw new Error('Expected BATCH_FLUSH impulse to be automatically converted into a Seasons Note');
  }
  console.log('  ✓ Импульс BATCH_FLUSH автоматически трансформирован в структурированную Note в Lemon Seasons!');

  // 4. Проверка CodingMemoryAxon (Память решений и сессий кодинга)
  console.log('\nTest 4: CodingMemoryAxon (Decisions & Done Changelogs)');
  const codingAxon = new CodingMemoryAxon({ bridge });
  await codingAxon.ensureTopology();

  await codingAxon.recordDecision({
    sessionId: 'session-code-1',
    repoName: 'lemon-actions',
    title: 'Separated Core from UI',
    markdown: 'Moved application modules out of core flows.',
  });

  await codingAxon.recordSessionCompleted({
    sessionId: 'session-code-1',
    repoName: 'lemon-actions',
    taskTitle: 'Core Combinator SDK Extraction',
    changelogMarkdown: 'Created @lemon/core-combinator-sdk and validated 12 tests.',
    testsPassedCount: 12,
  });

  const doneNote = seasonsDb.notes.find((n) => n.type === 'DONE');
  if (!doneNote || !doneNote.title.includes('Core Combinator SDK Extraction')) {
    throw new Error('Expected DONE note created for completed coding session');
  }
  console.log('  ✓ CodingMemoryAxon зафиксировал архитектурное решение и финальную DONE-заметку сессии!');

  // 5. Проверка DailyTimelineAxon
  console.log('\nTest 5: DailyTimelineAxon (Daily History & Batch Segment)');
  const dailyAxon = new DailyTimelineAxon({ bridge });
  const neuron = await dailyAxon.init();
  if (!neuron.flows.batch || !neuron.flows.timer) {
    throw new Error('Expected DailyTimelineAxon to configure composite neuron with BATCH and TIMER');
  }
  console.log('  ✓ DailyTimelineAxon сконфигурировал композитный нейрон в Core Combinator и фид истории в Seasons!');

  // 6. Проверка syncTodoListNote и SSE URL (/api/v1/events/stream)
  console.log('\nTest 6: Note TodoList Projection & SeasonsSseBus URL');
  await bridge.syncTodoListNote({
    externalId: 'todos:projectarium:stand-1',
    title: 'Projectarium Todo List',
    streamSlug: 'projectarium',
    feedSlug: 'projectarium-todos',
    todoList: [
      { id: 't1', title: 'Wire Seasons Proxy', completed: true, priority: 'HIGH' },
      { id: 't2', title: 'Build Bubble UI', completed: false, priority: 'MEDIUM' },
    ],
  });

  const todoNote = seasonsDb.notes.find((n) => n.externalId === 'todos:projectarium:stand-1');
  const extractedTodos = extractTodoListFromNote(todoNote);
  const stats = computeTodoStats(extractedTodos);
  if (extractedTodos.length !== 2 || stats.completed !== 1 || !todoNote.content.includes('- [x] Wire Seasons Proxy')) {
    throw new Error('Expected todoList to be stored in metadata and rendered as markdown checklist');
  }

  const sseBus = new SeasonsSseBus({ baseUrl: 'http://127.0.0.1:3002', token: 'tok-123' });
  const streamUrl = sseBus.buildStreamUrl({ streamSlug: 'projectarium' });
  if (!streamUrl.includes('/api/v1/events/stream') || !streamUrl.includes('token=tok-123') || !streamUrl.includes('streams=projectarium')) {
    throw new Error(`Unexpected SSE stream URL: ${streamUrl}`);
  }
  console.log('  ✓ TodoList корректно упакован в Note.metadata + Markdown checklist, SSE URL исправлен на /api/v1/events/stream!');

  console.log('\n=== All Lemon-Seasons-Neurons Bridge Tests Passed! ===');
}

runSeasonsBridgeTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
