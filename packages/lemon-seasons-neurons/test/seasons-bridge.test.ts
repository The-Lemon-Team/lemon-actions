import {
  SeasonsApiClient,
  computeTodoStats,
  extractTodoListFromNote,
  extractNoteMedia,
} from '../src/client/seasons-api.client';
import { SeasonsSseBus } from '../src/client/seasons-sse.bus';
import { TopologyNeuron } from '../src/neurons/topology.neuron';
import { FeedNeuron } from '../src/neurons/feed.neuron';
import { StreamNeuron } from '../src/neurons/stream.neuron';
import { SeasonsCombinatorBridge } from '../src/bridge/seasons-combinator-bridge';
import { CodingMemoryAxon } from '../src/axons/coding-memory.axon';
import { DailyTimelineAxon } from '../src/axons/daily-timeline.axon';
import { SeasonsMediaAxon } from '../src/axons/seasons-media.axon';

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

  // 7. Проверка TopologyNeuron, StreamNeuron и FeedNeuron + SSE reconciliation
  console.log('\nTest 7: TopologyNeuron, StreamNeuron & FeedNeuron Reactive Reconciliation');
  let topologyVersion = 1;
  const mockReadApi = {
    ...mockSeasonsApi,
    getTopology: async () => ({
      revision: topologyVersion,
      contour: 'admin',
      totals: { streams: 1, feeds: 1, notes: 1 },
      streams: [
        {
          id: 's1',
          slug: 'projectarium',
          title: 'Projectarium',
          privacy: 'private',
          totalNotes: 1,
          tabs: [{ id: 't1', slug: 'projectarium-notes', label: 'Notes', type: 'feed', count: 1 }],
        },
      ],
      feeds: [
        {
          id: 'f1',
          slug: 'projectarium-notes',
          title: 'Notes',
          privacy: 'private',
          totalNotes: 1,
          publishedNotes: 1,
          stagingNotes: 0,
          streamSlugs: ['projectarium'],
        },
      ],
      facets: { dateBuckets: [{ dateKey: '2026-11-18', count: 1 }], authors: [], hashtags: [] },
    }),
    getFeedNotesPage: async () => ({
      total: 1,
      limit: 30,
      offset: 0,
      hasMore: false,
      items: [{ id: 'note-a', title: 'Initial Note', feedSlug: 'projectarium-notes' }],
    }),
    getStreamNotesPage: async () => ({
      total: 1,
      limit: 30,
      offset: 0,
      hasMore: false,
      items: [{ id: 'note-a', title: 'Initial Note', feedSlug: 'projectarium-notes' }],
    }),
    attachMediaAssets: async (noteId: string, items: any[]) => ({ noteId, items }),
  } as unknown as SeasonsApiClient;

  const topoNeuron = new TopologyNeuron({ apiClient: mockReadApi, sseBus });
  await topoNeuron.initialize();
  sseBus.emitPacket({
    kind: 'topology',
    patch: {
      type: 'TOPOLOGY_PATCH',
      revision: 2,
      previousRevision: 1,
      timestamp: Date.now(),
      totals: { streams: 1, feeds: 1, notes: 2 },
      feeds: {
        'projectarium-notes': { totalNotes: 2, publishedNotes: 2, stagingNotes: 0 },
      },
      dateBuckets: { '2026-11-18': 2 },
    },
  });
  if (topoNeuron.getSnapshot()?.revision !== 2 || topoNeuron.getSnapshot()?.totals.notes !== 2) {
    throw new Error('Expected TopologyNeuron to apply TOPOLOGY_PATCH revision 2');
  }

  const streamNeuron = new StreamNeuron({ streamSlug: 'projectarium', apiClient: mockReadApi, sseBus });
  await streamNeuron.connect(true);
  const feedNeuron = streamNeuron.getOrCreateFeedNeuron('projectarium-notes');
  await feedNeuron.connect(true);
  sseBus.emitPacket({
    kind: 'note',
    event: {
      id: 'evt-1',
      type: 'NOTE_CREATED',
      noteId: 'note-b',
      streamSlug: 'projectarium',
      feedSlug: 'projectarium-notes',
      timestamp: Date.now(),
      note: { id: 'note-b', title: 'Live SSE Note' },
    },
  });
  if (feedNeuron.value.items.length !== 2 || streamNeuron.value.items.length !== 2) {
    throw new Error('Expected FeedNeuron & StreamNeuron to reconcile NOTE_CREATED');
  }
  sseBus.emitPacket({
    kind: 'note',
    event: {
      id: 'evt-2',
      type: 'NOTE_LEFT',
      noteId: 'note-a',
      streamSlug: 'projectarium',
      previousFeedSlug: 'projectarium-notes',
      feedSlug: 'other-feed',
      timestamp: Date.now(),
    },
  });
  if (feedNeuron.value.items.some((i) => i.id === 'note-a')) {
    throw new Error('Expected FeedNeuron to evict note-a on NOTE_LEFT');
  }
  topoNeuron.disconnect();
  streamNeuron.disconnect();
  console.log('  ✓ TopologyNeuron, StreamNeuron и FeedNeuron реактивно обработали патчи, NOTE_CREATED и NOTE_LEFT!');

  // 8. Проверка SeasonsMediaAxon (@lemon/media-hub-neurons <-> @lemon/seasons-neurons)
  console.log('\nTest 8: SeasonsMediaAxon Cross-Neuron Media + Note Ingestion');
  const attachedMediaCalls: any[] = [];
  const seasonsWithMediaBridge = new SeasonsCombinatorBridge({
    combinator: mockCombinator,
    seasons: {
      ...mockReadApi,
      ingestNote: mockSeasonsApi.ingestNote,
      attachMediaAssets: async (noteId: string, items: any[]) => {
        attachedMediaCalls.push({ noteId, items });
        return items;
      },
    } as unknown as SeasonsApiClient,
  });
  await seasonsWithMediaBridge.ensureSeasonsCompositeNeurons();

  const mockMediaAxon = {
    apiClient: {
      resolveUrl: (u: string) => (u.startsWith('http') ? u : `http://127.0.0.1:3005${u}`),
    },
    addMedia: async (req: any) => ({
      asset: {
        id: 'asset-media-1',
        kind: 'IMAGE',
        title: req.title || 'Cover Image',
        url: '/api/media/asset-media-1/file/webp',
        thumbnailUrl: '/api/media/asset-media-1/file/thumb',
        filename: req.filename || 'cover.webp',
        originalFilename: req.filename || 'cover.webp',
        folderPath: req.folderPath || 'seasons/notes',
        mimeType: 'image/webp',
        sizeBytes: 2048,
        width: 1280,
        height: 720,
        aspectRatio: '16:9',
        processingStatus: 'READY',
        visibility: 'SCOPED',
        tags: req.tags || [],
        isFavorite: false,
        usageCount: 0,
        sourceApp: 'lemon-seasons',
        model: 'upload',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      waitedForProcessing: true,
      elapsedMs: 12,
    }),
    viewMedia: async (req: { assetId: string }) => ({
      asset: {
        id: req.assetId,
        url: `/api/media/${req.assetId}/file/webp`,
        thumbnailUrl: `/api/media/${req.assetId}/file/thumb`,
        filename: 'cover.webp',
        originalFilename: 'cover.webp',
        mimeType: 'image/webp',
        sizeBytes: 2048,
      },
      variant: 'webp',
      url: `http://127.0.0.1:3005/api/media/${req.assetId}/file/webp?sig=hmac123`,
      relativeUrl: `/api/media/${req.assetId}/file/webp?sig=hmac123`,
      signed: true,
    }),
    deleteMedia: async (req: any) => ({
      assetId: req.assetId,
      success: true,
      deletedAt: new Date().toISOString(),
    }),
  } as any;

  const seasonsMediaAxon = new SeasonsMediaAxon({
    bridge: seasonsWithMediaBridge,
    mediaAxon: mockMediaAxon,
  });

  const mediaIngestRes = await seasonsMediaAxon.ingestNoteWithMedia({
    note: {
      externalId: 'note-with-media-1',
      title: 'Release with Hero Cover',
      content: 'Includes a cover generated via Media Hub',
      feedSlug: 'dev-changelogs',
    },
    mediaFiles: [
      {
        file: new Uint8Array([1, 2, 3]),
        filename: 'hero.png',
        mimeType: 'image/png',
      },
    ],
  });

  const extracted = extractNoteMedia(mediaIngestRes.note);
  if (
    mediaIngestRes.uploadedAssets.length !== 1 ||
    extracted.length !== 1 ||
    extracted[0].mediaAssetId !== 'asset-media-1' ||
    !extracted[0].url.includes('sig=hmac123')
  ) {
    throw new Error('Expected SeasonsMediaAxon to upload media, resolve signed URL, and attach to ingested note');
  }
  console.log('  ✓ SeasonsMediaAxon загрузил ассет в Media Hub, получил signed URL и связал его с заметкой в Seasons!');

  console.log('\n=== All Lemon-Seasons-Neurons Bridge Tests Passed! ===');
}

runSeasonsBridgeTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
