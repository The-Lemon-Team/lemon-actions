import assert from 'node:assert/strict';
import test from 'node:test';
import { Subject, firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import {
  FolderNeuron,
  MediaAsset,
  MediaCombinatorBridge,
  MediaDeleteFlow,
  MediaFolder,
  MediaHubApiClient,
  MediaIngestFlow,
  MediaLibraryNeuron,
  MediaSseBus,
  MediaTopologyNeuron,
  MediaViewFlow,
} from '../src';

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  const id = overrides.id ?? 'asset-1';
  return {
    id,
    kind: 'IMAGE',
    title: 'Sample',
    description: null,
    url: `/api/media/${id}/file/full`,
    thumbnailUrl: `/api/media/${id}/file/thumb`,
    filename: `${id}.png`,
    originalFilename: `${id}.png`,
    folderId: 'fld-1',
    folderPath: 'covers',
    mimeType: 'image/webp',
    sizeBytes: 1234,
    width: 100,
    height: 100,
    aspectRatio: '1:1',
    processingStatus: 'READY',
    visibility: 'PRIVATE',
    tags: ['test'],
    isFavorite: false,
    usageCount: 0,
    sourceApp: 'lemon-media-hub',
    model: 'manual-upload',
    variants: [{ id: 'v1', variantType: 'FULL_WEBP', mimeType: 'image/webp', sizeBytes: 1234, width: 100, height: 100, url: `/api/media/${id}/file/full` }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeFolder(overrides: Partial<MediaFolder> = {}): MediaFolder {
  return {
    id: overrides.id ?? 'fld-1',
    name: overrides.name ?? 'Covers',
    path: overrides.path ?? 'covers',
    parentId: null,
    icon: 'image',
    color: '#3b82f6',
    defaultVisibility: 'PRIVATE',
    assetsCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('MediaSseBus multiplexes folder, kind, asset, and semantic streams', async () => {
  const apiClient = new MediaHubApiClient({ baseUrl: 'http://localhost:3999' });
  const bus = new MediaSseBus({ apiClient });

  const folderEventsPromise = firstValueFrom(bus.selectFolder$('covers').pipe(take(2), toArray()));
  const deletePromise = firstValueFrom(bus.mediaDeleted$.pipe(take(1)));

  bus.emitPacket({
    id: 'ev-1',
    type: 'MEDIA_ADDED',
    timestamp: new Date().toISOString(),
    assetId: 'a1',
    folderPath: 'covers',
    kind: 'IMAGE',
    asset: makeAsset({ id: 'a1', folderPath: 'covers' }),
  });

  bus.emitPacket({
    id: 'ev-other',
    type: 'MEDIA_ADDED',
    timestamp: new Date().toISOString(),
    assetId: 'a-other',
    folderPath: 'audio',
    kind: 'AUDIO',
    asset: makeAsset({ id: 'a-other', folderPath: 'audio', kind: 'AUDIO' }),
  });

  bus.emitPacket({
    id: 'ev-2',
    type: 'MEDIA_DELETED',
    timestamp: new Date().toISOString(),
    assetId: 'a1',
    folderPath: 'covers',
    kind: 'IMAGE',
  });

  const folderEvents = await folderEventsPromise;
  const delEvent = await deletePromise;

  assert.equal(folderEvents.length, 2);
  assert.equal(folderEvents[0].type, 'MEDIA_ADDED');
  assert.equal(folderEvents[1].type, 'MEDIA_DELETED');
  assert.equal(delEvent.assetId, 'a1');
});

test('FolderNeuron, MediaLibraryNeuron, and MediaTopologyNeuron reconcile live SSE impulses', async () => {
  const initialAsset = makeAsset({ id: 'a1', folderPath: 'covers' });
  const initialFolder = makeFolder({ id: 'fld-1', path: 'covers', assetsCount: 1 });

  const mockClient = {
    baseUrl: 'http://localhost:3999',
    listFolders: async () => [initialFolder],
    listAssets: async () => ({ items: [initialAsset], total: 1 }),
  } as unknown as MediaHubApiClient;

  const bus = new MediaSseBus({ apiClient: mockClient });
  const topology = new MediaTopologyNeuron({ apiClient: mockClient, sseBus: bus });
  const library = new MediaLibraryNeuron({ apiClient: mockClient, sseBus: bus });
  const folderNeuron: FolderNeuron = library.getOrCreateFolderNeuron('covers');

  await topology.initialize();
  await library.connect(true);
  await folderNeuron.connect(true);

  assert.equal(folderNeuron.value.items.length, 1);
  assert.equal(topology.findByPath('covers')?.assetsCount, 1);

  const added = makeAsset({ id: 'a2', folderPath: 'covers', title: 'Live Added' });
  bus.emitPacket({
    id: 'e1',
    type: 'MEDIA_ADDED',
    timestamp: new Date().toISOString(),
    assetId: 'a2',
    folderPath: 'covers',
    kind: 'IMAGE',
    asset: added,
  });

  assert.equal(folderNeuron.value.items.length, 2);
  assert.equal(folderNeuron.value.items[0].id, 'a2');
  assert.equal(library.value.total, 2);
  assert.equal(topology.findByPath('covers')?.assetsCount, 2);

  // Simulate moving a1 to another folder -> FolderNeuron('covers') should evict it
  bus.emitPacket({
    id: 'e2',
    type: 'MEDIA_UPDATED',
    timestamp: new Date().toISOString(),
    assetId: 'a1',
    folderPath: 'avatars',
    kind: 'IMAGE',
    asset: { ...initialAsset, folderPath: 'avatars' },
    payload: { previousFolderPath: 'covers' },
  });

  assert.equal(folderNeuron.value.items.length, 1);
  assert.equal(folderNeuron.value.items[0].id, 'a2');
  assert.equal(topology.findByPath('covers')?.assetsCount, 1);

  // Simulate delete of a2
  bus.emitPacket({
    id: 'e3',
    type: 'MEDIA_DELETED',
    timestamp: new Date().toISOString(),
    assetId: 'a2',
    folderPath: 'covers',
    kind: 'IMAGE',
  });

  assert.equal(folderNeuron.value.items.length, 0);
  assert.equal(topology.findByPath('covers')?.assetsCount, 0);

  library.disconnect();
  topology.disconnect();
});

test('MediaIngestFlow deduplicates concurrent uploads and bridges to CoreCombinator', async () => {
  let uploadCalls = 0;
  const chronicleEvents: any[] = [];
  const ensuredPaths: string[] = [];

  const mockClient = {
    baseUrl: 'http://localhost:3999',
    upload: async (req: any) => {
      uploadCalls += 1;
      await new Promise((r) => setTimeout(r, 25));
      return makeAsset({ id: `up-${uploadCalls}`, filename: req.filename });
    },
  } as unknown as MediaHubApiClient;

  const mockCombinator = {
    neurons: {
      ensureCompositeNeuron: async (def: any) => {
        ensuredPaths.push(def.path);
        return {
          neuron: { id: `fld-${ensuredPaths.length}`, path: def.path },
          flows: {
            context: { id: `ctx-${def.path}` },
            batch: { id: `batch-${def.path}` },
            observer: { id: `obs-${def.path}` },
            mutex: { id: `mtx-${def.path}` },
          },
        };
      },
    },
    chronicle: {
      emit: async (flowId: string, ev: any) => {
        chronicleEvents.push({ flowId, ev });
      },
    },
    batch: {
      push: async () => ({ ok: true }),
    },
  } as any;

  const bridge = new MediaCombinatorBridge({
    apiClient: mockClient,
    combinator: mockCombinator,
  });
  await bridge.ensureMediaTopology();

  const ingestFlow = new MediaIngestFlow({ apiClient: mockClient, bridge });
  const source$ = new Subject<any>();
  ingestFlow.connectSource(source$);

  const req = {
    file: new Uint8Array([1, 2, 3]),
    filename: 'cover.png',
    dedupKey: 'same-hash',
  };

  const [r1, r2] = await Promise.all([ingestFlow.ingest(req), ingestFlow.ingest(req)]);
  assert.equal(uploadCalls, 1);
  assert.equal(r1.asset.id, r2.asset.id);
  assert.deepEqual(ensuredPaths, [
    '/media-hub/library',
    '/media-hub/ingest',
    '/media-hub/delete',
    '/media-hub/view',
  ]);
  assert.ok(chronicleEvents.some((c) => c.ev.eventType === 'MEDIA_ADDED'));

  ingestFlow.destroy();
});

test('MediaDeleteFlow serializes deletions and emits delete events', async () => {
  const deletedOrder: string[] = [];
  const mockClient = {
    deleteAsset: async (id: string) => {
      await new Promise((r) => setTimeout(r, 15));
      deletedOrder.push(id);
      return { success: true };
    },
  } as unknown as MediaHubApiClient;

  const deleteFlow = new MediaDeleteFlow({ apiClient: mockClient });
  const emittedPromise = firstValueFrom(deleteFlow.deleted$.pipe(take(2), toArray()));

  const results = await deleteFlow.removeMany(['m1', 'm2'], 'cleanup');
  const emitted = await emittedPromise;

  assert.deepEqual(deletedOrder, ['m1', 'm2']);
  assert.equal(results.length, 2);
  assert.equal(emitted[0].reason, 'cleanup');

  deleteFlow.destroy();
});

test('MediaViewFlow caches signed URLs, invalidates on access change, and batches usage', async () => {
  let signedCalls = 0;
  let usageCalls = 0;

  const privateAsset = makeAsset({ id: 'priv-1', visibility: 'PRIVATE' });
  const mockClient = {
    baseUrl: 'http://localhost:3999',
    resolveUrl: (rel: string) => `http://localhost:3999${rel}`,
    getAsset: async () => privateAsset,
    createSignedUrl: async (id: string) => {
      signedCalls += 1;
      return {
        assetId: id,
        variant: 'full',
        relativeUrl: `/api/media/${id}/file/full?exp=9999999999&sig=sig-${signedCalls}`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };
    },
    incrementUsage: async () => {
      usageCalls += 1;
      return { success: true };
    },
  } as unknown as MediaHubApiClient;

  const bus = new MediaSseBus({ apiClient: mockClient });
  const viewFlow = new MediaViewFlow({
    apiClient: mockClient,
    sseBus: bus,
    usageBatchWindowMs: 80,
  });

  const flushedPromise = firstValueFrom(viewFlow.usageFlushed$.pipe(take(1)));

  const first = await viewFlow.resolveView({ assetId: 'priv-1' });
  const second = await viewFlow.resolveView({ assetId: 'priv-1' });

  assert.equal(first.signed, true);
  assert.equal(signedCalls, 1);
  assert.equal(first.url, second.url);

  // Access change impulse must evict cached signed URL
  bus.emitPacket({
    id: 'ev-acl',
    type: 'MEDIA_ACCESS_CHANGED',
    timestamp: new Date().toISOString(),
    assetId: 'priv-1',
    visibility: 'SCOPED',
  });

  const third = await viewFlow.resolveView({ assetId: 'priv-1' });
  assert.equal(signedCalls, 2);
  assert.notEqual(third.url, first.url);

  const flushed = await flushedPromise;
  assert.equal(flushed.countsByAsset['priv-1'], 3);
  assert.equal(usageCalls, 3);

  viewFlow.destroy();
});
