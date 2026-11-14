import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProjectStand } from '../models/project-stand.models';
import { ProjectStandService } from './project-stand.service';

describe('ProjectStandService', () => {
  let service: ProjectStandService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('lemon_actions_project_stands_v1');
    localStorage.removeItem('lemon_actions_projectarium_party_seeded_v1');

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProjectStandService);
    httpMock = TestBed.inject(HttpTestingController);

    // Flush initial constructor fetchFromBackend()
    const initReq = httpMock.expectOne('/api/projectarium/projects');
    initReq.flush([]);
  });

  afterEach(() => {
    httpMock.match((req) => req.url.startsWith('http://localhost:3000/api/'));
    httpMock.verify();
  });

  it('calls backend /ping endpoint and applies real ONLINE/DEGRADED statuses instead of faking UP', () => {
    let stands: ProjectStand[] = [];
    const sub = service.allStands$.subscribe((list) => {
      stands = list;
    });

    const actionsStand = stands.find((s) => s.slug === 'actions');
    expect(actionsStand).toBeTruthy();

    service.pingStandApps(actionsStand!.id);

    const checkingStand = stands.find((s) => s.slug === 'actions')!;
    expect(checkingStand.apps.every((a) => a.status === 'CHECKING')).toBeTrue();

    const pingReq = httpMock.expectOne('/api/projectarium/projects/actions/ping');
    expect(pingReq.request.method).toBe('POST');

    pingReq.flush({
      id: actionsStand!.id,
      name: actionsStand!.name,
      slug: actionsStand!.slug,
      projectToken: 'proj_actions_master_8830ab',
      neuronWorkspace: 'workspace.actions',
      context: { description: actionsStand!.description },
      apps: [
        {
          id: 'app-1',
          appName: 'Core combinator (Dev DB)',
          host: 'localhost',
          port: 5433,
          instanceId: 'inst_1',
          leaseToken: 'lease_1',
          environment: 'dev',
          networkMode: 'local',
          status: 'DEGRADED',
          healthUrl: 'postgresql://localhost:5433/lemon_db',
          lastPingAt: '2026-11-14T19:00:00.000Z',
          pingLatencyMs: 7,
          consecutiveFailures: 1,
        },
        {
          id: 'app-2',
          appName: 'Projectarium UI (Dev)',
          host: 'localhost',
          port: 4203,
          instanceId: 'inst_2',
          leaseToken: 'lease_2',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:4203/projectarium',
          lastPingAt: '2026-11-14T19:00:00.000Z',
          pingLatencyMs: 19,
          consecutiveFailures: 0,
        },
      ],
      todos: [],
      notes: [],
      chronicle: [
        {
          id: 'ev-1',
          type: 'APP_HEARTBEAT',
          description: 'Healthcheck стенда: UP 1/2, DEGRADED 1, DOWN 0',
          timestamp: '2026-11-14T19:00:00.000Z',
          author: 'health-probe',
        },
      ],
      createdAt: actionsStand!.createdAt,
      updatedAt: '2026-11-14T19:00:00.000Z',
    });

    const updatedStand = stands.find((s) => s.slug === 'actions')!;
    expect(updatedStand.apps[0].status).toBe('DEGRADED');
    expect(updatedStand.apps[0].consecutiveFailures).toBe(1);
    expect(updatedStand.apps[1].status).toBe('HEALTHY');
    expect(updatedStand.apps[1].lastLatencyMs).toBe(19);
    sub.unsubscribe();
  });

  it('reverts CHECKING state and logs error if backend /ping fails', () => {
    let stands: ProjectStand[] = [];
    const sub = service.allStands$.subscribe((list) => {
      stands = list;
    });

    const actionsStand = stands.find((s) => s.slug === 'actions')!;
    service.pingStandApps(actionsStand.id);

    const pingReq = httpMock.expectOne('/api/projectarium/projects/actions/ping');
    pingReq.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    const updatedStand = stands.find((s) => s.slug === 'actions')!;
    expect(updatedStand.apps.some((a) => a.status === 'CHECKING')).toBeFalse();
    expect(updatedStand.chronicle[0].badge).toBe('PING_ERROR');
    sub.unsubscribe();
  });
});
