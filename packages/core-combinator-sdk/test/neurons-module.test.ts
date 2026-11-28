import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NeuronsModule } from '../src/modules/neurons.module';

interface StoredFolder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  profileId: string | null;
}

interface StoredFlow {
  id: string;
  name: string;
  type: string;
  folderId: string;
  profileId: string | null;
}

function createStatefulMockHttp() {
  const folders: StoredFolder[] = [];
  const flows: StoredFlow[] = [];
  const postFoldersLog: Array<{ name: string; slug?: string; parentId: string | null }> = [];

  const http = {
    get: async <T>(path: string, params: Record<string, any> = {}): Promise<T> => {
      if (path === '/folders') {
        const scope = params.scope as string | undefined;
        const matched = folders.filter((f) => {
          if (params.profileId && f.profileId !== params.profileId) return false;
          if (!scope) return true;
          return f.path === scope || f.path.startsWith(`${scope}.`);
        });
        return matched as unknown as T;
      }
      if (path === '/flows') {
        const matched = flows.filter((f) => !params.folderId || f.folderId === params.folderId);
        return matched as unknown as T;
      }
      throw new Error(`Unexpected GET ${path}`);
    },
    post: async <T>(path: string, body: any = {}): Promise<T> => {
      if (path === '/folders') {
        postFoldersLog.push({ name: body.name, slug: body.slug, parentId: body.parentId ?? null });
        const parent = body.parentId ? folders.find((f) => f.id === body.parentId) ?? null : null;
        const label = String(body.slug || body.name)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const basePath = parent ? `${parent.path}.${label}` : label;
        let finalPath = basePath;
        for (let i = 2; folders.some((f) => f.path === finalPath && f.profileId === (body.profileId ?? null)); i++) {
          finalPath = parent ? `${parent.path}.${label}_${i}` : `${label}_${i}`;
        }
        const created: StoredFolder = {
          id: `fld-${folders.length + 1}`,
          name: body.name,
          path: finalPath,
          parentId: parent?.id ?? null,
          profileId: body.profileId ?? null,
        };
        folders.push(created);
        return created as unknown as T;
      }
      if (path === '/flows') {
        const created: StoredFlow = {
          id: `flow-${flows.length + 1}`,
          name: body.name,
          type: body.type,
          folderId: body.folderId,
          profileId: body.profileId ?? null,
        };
        flows.push(created);
        return created as unknown as T;
      }
      throw new Error(`Unexpected POST ${path}`);
    },
    patch: async <T>(_path: string, body: any): Promise<T> => body as T,
  };

  return { http, folders, flows, postFoldersLog };
}

describe('NeuronsModule.ensureCompositeNeuron', () => {
  it('normalizes slashes/dashes into ltree segments with slug and avoids duplicate root folders', async () => {
    const { http, folders, flows, postFoldersLog } = createStatefulMockHttp();
    const neurons = new NeuronsModule(http);

    const first = await neurons.ensureCompositeNeuron({
      name: 'Media Ingest Flow',
      path: '/media-hub/ingest-flow',
      flows: {
        context: { config: { mode: 'ingest' } },
        observer: {},
      },
    });

    assert.equal(first.neuron.path, 'media_hub.ingest_flow');
    assert.equal(folders.length, 2);
    assert.deepEqual(
      folders.map((f) => ({ path: f.path, parentId: f.parentId, name: f.name })),
      [
        { path: 'media_hub', parentId: null, name: 'media_hub' },
        { path: 'media_hub.ingest_flow', parentId: 'fld-1', name: 'Media Ingest Flow' },
      ],
    );
    assert.deepEqual(
      postFoldersLog.map((p) => p.slug),
      ['media_hub', 'ingest_flow'],
    );
    assert.equal(flows.length, 2);

    // Re-ensuring the exact same neuron should be completely idempotent (0 new folders/flows)
    const repeat = await neurons.ensureCompositeNeuron({
      name: 'Media Ingest Flow',
      path: 'media_hub.ingest_flow',
      flows: {
        context: { config: { mode: 'ingest' } },
        observer: {},
      },
    });
    assert.equal(repeat.neuron.id, first.neuron.id);
    assert.equal(folders.length, 2);
    assert.equal(flows.length, 2);

    // Adding a sibling under /media-hub/library reuses the single media_hub parent folder
    const sibling = await neurons.ensureCompositeNeuron({
      name: 'Media Library',
      path: '/media-hub/library',
      flows: {
        context: { config: { mode: 'library' } },
      },
    });
    assert.equal(sibling.neuron.path, 'media_hub.library');
    assert.equal(sibling.neuron.parentId, 'fld-1');
    assert.equal(folders.length, 3);
    assert.equal(folders.filter((f) => f.path.startsWith('media_hub_')).length, 0);
  });
});
