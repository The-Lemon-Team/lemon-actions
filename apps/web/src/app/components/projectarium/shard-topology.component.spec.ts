import { TestBed } from '@angular/core/testing';
import { RegisteredShardView, ShardAnalyticsSummary } from '../../core/models/project-stand.models';
import { ShardTopologyComponent } from './shard-topology.component';

describe('ShardTopologyComponent', () => {
  const sampleShard: RegisteredShardView = {
    projectSlug: 'lemon-watchers',
    projectName: 'Lemon Watchers',
    shardId: 'shard-watchers-01',
    tier: 'dedicated',
    status: 'ONLINE',
    instanceId: 'inst_watchers_01',
    appName: 'lemon-core-shard',
    apiBaseUrl: 'http://localhost:4320/api',
    pingLatencyMs: 6,
    capabilities: ['MUTEX', 'TIMER', 'CIRCUIT_BREAKER'],
    customFlowTypes: [],
    customReducers: ['generic'],
    analytics: {
      projectSlug: 'lemon-watchers',
      shardId: 'shard-watchers-01',
      tier: 'dedicated',
      status: 'ok',
      lastMetricsAt: '2026-11-27T00:00:00Z',
      lastFlowEventAt: '2026-11-27T00:00:00Z',
      latestSnapshot: {
        flows: { active: 8 },
        optimizer: { reductionRatePct: 62.5 },
        scheduler: { lastTickDurationMs: 3 },
      },
      snapshotHistory: [],
      totalFlowEvents: 45,
      eventsByType: { MUTEX_STATUS: 20 },
      recentAlerts: [
        {
          timestamp: '2026-11-27T00:00:00Z',
          topic: 'lemon.lemon-watchers.flow.circuit_breaker_state',
          severity: 'warn',
          message: 'Circuit Breaker "RSS Feed" tripped to OPEN',
        },
      ],
    },
  };

  const sampleAnalytics: ShardAnalyticsSummary = {
    generatedAt: '2026-11-27T00:00:00Z',
    totalShards: 1,
    healthyShards: 1,
    degradedShards: 0,
    totalFlowEvents: 45,
    shards: [sampleShard.analytics!],
  };

  it('renders shard cards with telemetry, alerts, and emits switch/metrics/retention events', async () => {
    await TestBed.configureTestingModule({
      imports: [ShardTopologyComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShardTopologyComponent);
    fixture.componentInstance.shards = [sampleShard];
    fixture.componentInstance.analytics = sampleAnalytics;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lemon Watchers');
    expect(el.textContent).toContain('shard-watchers-01');
    expect(el.textContent).toContain('62.5%');
    expect(el.textContent).toContain('Circuit Breaker "RSS Feed" tripped to OPEN');

    const switched: any[] = [];
    const metricsPublished: any[] = [];
    const pruned: any[] = [];
    fixture.componentInstance.switchToShard.subscribe((v) => switched.push(v));
    fixture.componentInstance.publishMetrics.subscribe((v) => metricsPublished.push(v));
    fixture.componentInstance.pruneRetention.subscribe((v) => pruned.push(v));

    (el.querySelector('[data-testid="shard-switch-console-lemon-watchers"]') as HTMLButtonElement).click();
    (el.querySelector('[data-testid="shard-publish-metrics-lemon-watchers"]') as HTMLButtonElement).click();
    (el.querySelector('[data-testid="shard-prune-retention-lemon-watchers"]') as HTMLButtonElement).click();

    expect(switched.length).toBe(1);
    expect(switched[0].apiBaseUrl).toBe('http://localhost:4320/api');
    expect(metricsPublished.length).toBe(1);
    expect(pruned.length).toBe(1);
    expect(pruned[0].retentionDays).toBe(30);
  });
});
