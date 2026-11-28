import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { AiStudioAxon } from '../src/axons/ai-studio.axon';
import { AiEventImpulse, AiRequestLog } from '../src/types/ai.types';

function createMockFetch() {
  const requests: Array<{ url: string; method: string; headers: Record<string, string>; body?: any }> = [];
  const logs: AiRequestLog[] = [
    {
      id: 'req-seed-1',
      clientSlug: 'admin',
      taskType: 'TEXT_GENERATE',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      status: 'SUCCESS',
      isFallback: false,
      inputPayload: { prompt: 'Seed prompt' },
      outputPayload: { text: 'Seed response' },
      latencyMs: 120,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      mediaAssetIds: [],
      createdAt: '2026-11-15T10:00:00.000Z',
    },
  ];

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method || 'GET';
    const headers = (init?.headers as Record<string, string>) || {};
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, headers, body });

    if (url.endsWith('/api/ai/status')) {
      return new Response(
        JSON.stringify({
          configured: true,
          service: 'lemon-ai-service',
          imageEngine: 'flux',
          imageModels: ['flux', 'sana'],
          geminiConfigured: true,
          textModels: ['gemini-2.5-flash'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.endsWith('/api/ai/generate-text')) {
      const log: AiRequestLog = {
        id: 'req-text-2',
        clientSlug: 'admin',
        taskType: 'TEXT_GENERATE',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        status: 'SUCCESS',
        isFallback: false,
        inputPayload: body,
        outputPayload: { text: `Generated: ${body.prompt}` },
        latencyMs: 95,
        totalTokens: 42,
        mediaAssetIds: [],
        createdAt: new Date().toISOString(),
      };
      logs.unshift(log);
      return new Response(JSON.stringify({ text: `Generated: ${body.prompt}`, requestId: log.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.endsWith('/api/ai/generate-images')) {
      if (body.prompt === 'FAIL_ME') {
        return new Response('Upstream error', { status: 502, statusText: 'Bad Gateway' });
      }
      const log: AiRequestLog = {
        id: 'req-img-3',
        clientSlug: 'admin',
        taskType: 'IMAGE_GENERATE',
        provider: 'pollinations',
        model: 'flux',
        status: 'SUCCESS',
        isFallback: false,
        inputPayload: body,
        outputPayload: { synthesizedPrompt: body.prompt, count: 1, assetIds: ['asset-99'] },
        latencyMs: 540,
        mediaAssetIds: ['asset-99'],
        createdAt: new Date().toISOString(),
      };
      logs.unshift(log);
      return new Response(
        JSON.stringify({
          requestId: log.id,
          synthesizedPrompt: body.prompt,
          model: 'flux',
          isFallback: false,
          folderPath: body.folderPath || 'covers',
          items: [
            {
              id: 'asset-99',
              url: 'http://127.0.0.1:3005/api/assets/asset-99/file/full',
              thumbnailUrl: 'http://127.0.0.1:3005/api/assets/asset-99/file/thumb',
              filename: 'ai-1.jpg',
              width: 1280,
              height: 720,
              sizeBytes: 1024,
              mimeType: 'image/jpeg',
              tags: ['ai-neural'],
              isFavorite: false,
              usageCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              persisted: true,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/ai/history/stats')) {
      return new Response(
        JSON.stringify({
          totalRequests: logs.length,
          avgLatencyMs: 120,
          tokens: { input: 10, output: 20, total: 72 },
          byStatus: [{ status: 'SUCCESS', count: logs.length }],
          byTask: [{ taskType: 'TEXT_GENERATE', count: logs.length, avgLatencyMs: 110 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.match(/\/api\/ai\/history\/[^/?]+$/)) {
      const id = url.split('/').pop()!;
      const found = logs.find((l) => l.id === id);
      if (!found) return new Response('Not found', { status: 404 });
      return new Response(JSON.stringify(found), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/ai/history')) {
      return new Response(
        JSON.stringify({ items: logs, total: logs.length, limit: 30, offset: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('Not implemented in mock', { status: 404 });
  };

  return { fetchImpl: fetchImpl as unknown as typeof fetch, requests };
}

function createMockCombinator() {
  const ensuredPaths: string[] = [];
  const chronicleEvents: Array<{ flowId: string; eventType: string; payload: any }> = [];
  const batchPayloads: Array<{ flowId: string; payload: any; dedupKey?: string }> = [];

  const mock = {
    neurons: {
      ensureCompositeNeuron: async (cfg: { path: string }) => {
        ensuredPaths.push(cfg.path);
        const slug = cfg.path.replace(/[^a-z0-9]/gi, '_');
        return {
          neuron: { id: `neuron_${slug}`, path: cfg.path },
          flows: {
            context: { id: `ctx_${slug}` },
            observer: { id: `obs_${slug}` },
            batch: cfg.path.endsWith('.images') || cfg.path.endsWith('/images') ? { id: `batch_${slug}` } : undefined,
          },
        };
      },
    },
    chronicle: {
      emit: async (flowId: string, event: { eventType: string; payload: any }) => {
        chronicleEvents.push({ flowId, eventType: event.eventType, payload: event.payload });
        return { id: 'ev-1' };
      },
    },
    batch: {
      push: async (flowId: string, payload: any, dedupKey?: string) => {
        batchPayloads.push({ flowId, payload, dedupKey });
        return { queued: true };
      },
    },
  } as unknown as CoreCombinatorClient;

  return { mock, ensuredPaths, chronicleEvents, batchPayloads };
}

describe('@lemon/ai-neurons', () => {
  it('registers Core Combinator AI topology, emits impulses, and syncs history neuron', async () => {
    const { fetchImpl, requests } = createMockFetch();
    const { mock, ensuredPaths, chronicleEvents, batchPayloads } = createMockCombinator();

    const axon = new AiStudioAxon({
      baseUrl: 'http://127.0.0.1:3006',
      apiKey: 'lai_test_secret',
      combinator: mock,
      fetchImpl,
    });

    const impulses: AiEventImpulse[] = [];
    const sub = axon.impulseBus.impulses$.subscribe((imp) => impulses.push(imp));

    await axon.start({ ensureCombinatorTopology: true, loadHistory: true });

    assert.equal(ensuredPaths.length, 4);
    assert.ok(ensuredPaths.includes('ai_neurons.studio'));
    assert.ok(ensuredPaths.includes('ai_neurons.text'));
    assert.ok(ensuredPaths.includes('ai_neurons.images'));
    assert.ok(ensuredPaths.includes('ai_neurons.history'));
    assert.equal(axon.history.value.items.length, 1);

    const textRes = await axon.generateText({ prompt: 'Hello Umniy Lemon' });
    assert.equal(textRes.text, 'Generated: Hello Umniy Lemon');
    assert.equal(requests.find((r) => r.url.endsWith('/api/ai/generate-text'))?.headers['X-Ai-Api-Key'], 'lai_test_secret');

    const imgRes = await axon.generateImages({ prompt: 'Neon lemon core', count: 1 });
    assert.equal(imgRes.items[0].id, 'asset-99');
    assert.equal(batchPayloads.length, 1);
    assert.ok(chronicleEvents.some((e) => e.eventType === 'AI_TEXT_GENERATED'));
    assert.ok(chronicleEvents.some((e) => e.eventType === 'AI_IMAGES_GENERATED'));
    assert.ok(impulses.some((i) => i.type === 'AI_TEXT_GENERATED'));
    assert.ok(impulses.some((i) => i.type === 'AI_IMAGES_GENERATED'));

    // Wait one microtask tick for live history prepend
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(axon.history.value.items.length, 3);
    assert.equal(axon.history.value.items[0].id, 'req-img-3');

    await assert.rejects(() => axon.generateImages({ prompt: 'FAIL_ME' }));
    assert.ok(impulses.some((i) => i.type === 'AI_TASK_FAILED'));
    assert.ok(chronicleEvents.some((e) => e.eventType === 'FAILURE'));

    sub.unsubscribe();
    axon.stop();
  });
});
