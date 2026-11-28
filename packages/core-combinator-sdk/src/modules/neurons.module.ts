import {
  CompositeNeuronDefinition,
  CompositeNeuronInstance,
  FlowView,
  FolderDto,
  NeuronContextView,
  NeuronMetricsView,
} from '../types';

function normalizeLtreePath(rawPath: string): string {
  const cleaned = rawPath
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split(/[./]+/)
    .map((seg) =>
      seg
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, ''),
    )
    .filter(Boolean)
    .join('.');
  return cleaned || 'neuron';
}

export class NeuronsModule {
  constructor(
    private readonly http: {
      get: <T>(path: string, params?: Record<string, any>) => Promise<T>;
      post: <T>(path: string, body?: any) => Promise<T>;
      patch: <T>(path: string, body?: any) => Promise<T>;
    },
  ) {}

  async getContext(folderId: string): Promise<NeuronContextView> {
    return this.http.get<NeuronContextView>(`/folders/${folderId}/context`);
  }

  async getMetrics(folderId: string): Promise<NeuronMetricsView> {
    return this.http.get<NeuronMetricsView>(`/folders/${folderId}/metrics`);
  }

  /**
   * Idempotently discovers or registers a composite neuron (Folder)
   * with its requested flows (CONTEXT, MUTEX, TIMER, CIRCUIT_BREAKER, BATCH, OBSERVER, FSM, PROJECTION).
   */
  async ensureCompositeNeuron(
    def: CompositeNeuronDefinition,
  ): Promise<CompositeNeuronInstance> {
    const normalizedPath = normalizeLtreePath(def.path);
    const segments = normalizedPath.split('.');

    // 1. Find or create folder hierarchy deterministically along `normalizedPath`
    const allFolders = await this.http.get<FolderDto[]>('/folders', {
      profileId: def.profileId,
      scope: normalizedPath,
    });
    let folder = allFolders.find((f) => f.path === normalizedPath);

    if (!folder) {
      if (def.parentId || segments.length === 1) {
        folder = await this.http.post<FolderDto>('/folders', {
          name: def.name,
          slug: segments[segments.length - 1],
          parentId: def.parentId ?? null,
          profileId: def.profileId ?? null,
        });
      } else {
        const rootFolders = await this.http.get<FolderDto[]>('/folders', {
          profileId: def.profileId,
          scope: segments[0],
        });
        const byPath = new Map(rootFolders.map((f) => [f.path, f]));
        let parentId: string | null = null;
        let currentPath = '';

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          currentPath = currentPath ? `${currentPath}.${seg}` : seg;
          const isLeaf = i === segments.length - 1;
          let existing = byPath.get(currentPath);
          if (!existing) {
            existing = await this.http.post<FolderDto>('/folders', {
              name: isLeaf ? def.name : seg,
              slug: seg,
              parentId,
              profileId: def.profileId ?? null,
            });
            byPath.set(existing.path, existing);
          }
          parentId = existing.id;
          if (isLeaf) {
            folder = existing;
          }
        }
      }
    }

    if (!folder) {
      throw new Error(`Failed to resolve or create folder for neuron path "${normalizedPath}"`);
    }

    // 2. Fetch existing flows in folder
    const existingFlows = await this.http.get<FlowView[]>('/flows', {
      folderId: folder.id,
    });

    const flows: CompositeNeuronInstance['flows'] = {};

    // Helper to find or create flow
    const ensureFlow = async (
      type: string,
      name: string,
      config: any,
      isExclusive = false,
      orchestratorRules?: any,
    ): Promise<FlowView> => {
      let flow = existingFlows.find((f) => f.type === type || f.name === name);
      if (!flow) {
        flow = await this.http.post<FlowView>('/flows', {
          name,
          type,
          isExclusive,
          folderId: folder.id,
          profileId: def.profileId ?? null,
          config,
          orchestratorRules,
        });
      }
      return flow;
    };

    if (def.flows.context) {
      flows.context = await ensureFlow(
        'CONTEXT',
        def.flows.context.name || `${def.name} Context`,
        def.flows.context.config,
      );
    }

    if (def.flows.circuitBreaker) {
      flows.circuitBreaker = await ensureFlow(
        'CIRCUIT_BREAKER',
        def.flows.circuitBreaker.name || `${def.name} Circuit Breaker`,
        {
          state: 'CLOSED',
          failureThreshold: def.flows.circuitBreaker.failureThreshold ?? 3,
          cooldownSeconds: def.flows.circuitBreaker.cooldownSeconds ?? 60,
          successThreshold: def.flows.circuitBreaker.successThreshold ?? 1,
        },
      );
    }

    if (def.flows.batch) {
      flows.batch = await ensureFlow(
        'BATCH',
        def.flows.batch.name || `${def.name} Batch Influx`,
        {
          maxBatchSize: def.flows.batch.maxBatchSize ?? 10,
          maxWaitSeconds: def.flows.batch.maxWaitSeconds ?? 60,
          idleTimeoutSeconds: def.flows.batch.idleTimeoutSeconds ?? 10,
          deduplicationKey: def.flows.batch.deduplicationKey,
          pendingCount: 0,
        },
      );
    }

    if (def.flows.timer) {
      flows.timer = await ensureFlow(
        'TIMER',
        def.flows.timer.name || `${def.name} Pulse Timer`,
        {
          intervalSeconds: def.flows.timer.intervalSeconds ?? 60,
        },
      );
    }

    if (def.flows.mutex) {
      flows.mutex = await ensureFlow(
        'MUTEX',
        def.flows.mutex.name || `${def.name} Worker Mutex`,
        null,
        def.flows.mutex.isExclusive ?? true,
        {
          onConflict: def.flows.mutex.onConflict ?? 'queue',
          leaseTimeoutSeconds: def.flows.mutex.leaseTimeoutSeconds ?? 60,
          gate: def.flows.mutex.gate,
        },
      );
    }

    if (def.flows.observer) {
      flows.observer = await ensureFlow(
        'OBSERVER',
        def.flows.observer.name || `${def.name} Telemetry`,
        null,
      );
    }

    if (def.flows.fsm) {
      flows.fsm = await ensureFlow(
        'FSM',
        def.flows.fsm.name || `${def.name} Lifecycle`,
        def.flows.fsm.config,
      );
    }

    if (def.flows.projection) {
      flows.projection = await ensureFlow(
        'PROJECTION',
        def.flows.projection.name || `${def.name} Live Projection`,
        def.flows.projection.config,
      );
    }

    return { neuron: folder, flows };
  }
}
