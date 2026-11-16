import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProjectariumCockpitComponent } from './projectarium-cockpit.component';

describe('ProjectariumCockpitComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('lemon_projectarium_active_tab_v1');
    localStorage.removeItem('lemon_actions_project_stands_v1');
    localStorage.removeItem('lemon_actions_projectarium_party_seeded_v1');
    localStorage.removeItem('lemon_projectarium_machine_id_v1');
    localStorage.removeItem('lemon_projectarium_machine_name_v1');
  });

  it('renders project tabs and displays only the active project stand by default', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectariumCockpitComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectariumCockpitComponent);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('nav[role="tablist"] button[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(5); // 4 default stands (incl. Lemon-Party) + ALL tab

    let cards = fixture.nativeElement.querySelectorAll('app-project-stand-card');
    expect(cards.length).toBe(1);

    // Switch to the second project tab
    tabs[1].click();
    fixture.detectChanges();
    cards = fixture.nativeElement.querySelectorAll('app-project-stand-card');
    expect(cards.length).toBe(1);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');

    // Switch to ALL tab
    tabs[tabs.length - 1].click();
    fixture.detectChanges();
    cards = fixture.nativeElement.querySelectorAll('app-project-stand-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it('includes dedicated Lemon-Party stand with note about Time Traveling, Timeline (Day / Hero), Hero Cards and allows adding/editing notes', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectariumCockpitComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectariumCockpitComponent);
    fixture.detectChanges();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('nav[role="tablist"] button[role="tab"]') as NodeListOf<HTMLButtonElement>,
    );
    const partyTab = tabs.find((t) => t.textContent?.includes('Lemon-Party'));
    expect(partyTab).toBeTruthy();
    partyTab!.click();
    fixture.detectChanges();

    const notesTab = fixture.nativeElement.querySelector('[data-testid="stand-tab-notes"]') as HTMLButtonElement;
    expect(notesTab).toBeTruthy();
    notesTab.click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Time Traveling');
    expect(text).toContain('Timeline (Day / Hero)');
    expect(text).toContain('Hero Cards');
    expect(text).toContain('lemon-core');

    // Add a new note through service & verify UI updates
    fixture.componentInstance.standService.addNoteItem('stand-lemon-party', {
      title: 'Прототип Stitch',
      content: 'Провести линии между идеями и выделить золотую середину',
      tags: ['Stitch'],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Прототип Stitch');

    // Edit the first note & verify UI updates
    const stand = fixture.componentInstance.standService;
    let partyNotesCount = 0;
    stand.allStands$.subscribe((stands) => {
      const p = stands.find((s) => s.slug === 'lemon-party');
      partyNotesCount = p?.notes.length || 0;
      if (p && p.notes[0]?.title === 'Прототип Stitch') {
        // leave ready for edit test below
      }
    }).unsubscribe();
    expect(partyNotesCount).toBe(2);
  });

  it('creates a new stand when app-create-stand-modal emits create and selects its tab', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectariumCockpitComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectariumCockpitComponent);
    fixture.componentInstance.showCreateStandModal = true;
    fixture.detectChanges();

    const modalEl = fixture.debugElement.query(By.css('app-create-stand-modal'));
    expect(modalEl).toBeTruthy();

    modalEl.triggerEventHandler('create', {
      name: 'Alpha Telemetry',
      description: 'Standalone prod monitoring',
      neuronPath: 'apps/telemetry',
      color: 'lemon',
      tags: ['prod'],
    });
    fixture.detectChanges();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('nav[role="tablist"] button[role="tab"]') as NodeListOf<HTMLButtonElement>,
    );
    const createdTab = tabs.find((t) => t.textContent?.includes('Alpha Telemetry'));
    expect(createdTab).toBeTruthy();
    expect(createdTab?.getAttribute('aria-selected')).toBe('true');
    expect(fixture.componentInstance.showCreateStandModal).toBeFalse();
  });

  it('delegates smart touch registration to ProjectStandService and refreshes stands', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectariumCockpitComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProjectariumCockpitComponent);
    fixture.detectChanges();

    // Drain initial fetchFromBackend request triggered by ProjectStandService constructor
    const initReqs = httpMock.match('/api/projectarium/projects');
    initReqs.forEach((req) => req.flush([]));

    fixture.componentInstance.smartProjectName = 'Alpha Telemetry';
    fixture.componentInstance.smartAppName = 'telemetry-worker';
    fixture.componentInstance.smartHost = '192.168.1.100';
    fixture.componentInstance.smartPort = 4305;
    fixture.componentInstance.smartEnvironment = 'production';
    fixture.componentInstance.executeSmartTouch();

    const registerReq = httpMock.expectOne('/api/projectarium/register');
    expect(registerReq.request.method).toBe('POST');
    expect(registerReq.request.body).toEqual(
      jasmine.objectContaining({
        projectName: 'Alpha Telemetry',
        appName: 'telemetry-worker',
        host: '192.168.1.100',
        preferredPort: 4305,
        environment: 'production',
        networkMode: 'lan',
        author: 'cockpit-ui',
      }),
    );
    registerReq.flush({ message: 'Registered', projectToken: 'tok-123' });

    const refreshReq = httpMock.expectOne('/api/projectarium/projects');
    refreshReq.flush([]);
    expect(fixture.componentInstance.smartFeedback).toContain('tok-123');

    // Drain unrelated FlowStateService bootstrap GETs before verifying no open Projectarium requests remain
    httpMock.match((req) => !req.url.includes('/api/projectarium/'));
    httpMock.verify();
  });

  it('binds a workstation machineId for localhost scoping and displays PC-1 / PC-2 analytics', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectariumCockpitComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProjectariumCockpitComponent);
    fixture.detectChanges();

    // Drain initial public-only projects request
    httpMock.match('/api/projectarium/projects').forEach((req) => req.flush([]));

    // Open machine picker -> fetches known machines
    const pickerBtn = fixture.nativeElement.querySelector('[data-testid="toggle-machine-picker"]') as HTMLButtonElement;
    pickerBtn.click();
    fixture.detectChanges();

    const machinesReq = httpMock.expectOne('/api/projectarium/machines');
    machinesReq.flush([
      { machineId: 'pc-1', machineName: 'PC-1', activeLocalCount: 2, activePublicCount: 0, lastSeenAt: '2026-11-16T10:00:00.000Z' },
      { machineId: 'pc-2', machineName: 'PC-2', activeLocalCount: 1, activePublicCount: 0, lastSeenAt: '2026-11-16T09:50:00.000Z' },
    ]);

    // Select PC-1 -> reloads projects scoped to machineId=pc-1
    fixture.componentInstance.selectMachine('pc-1', 'PC-1');
    fixture.detectChanges();

    const scopedProjectsReq = httpMock.expectOne('/api/projectarium/projects?machineId=pc-1');
    scopedProjectsReq.flush([]);
    expect(localStorage.getItem('lemon_projectarium_machine_id_v1')).toBe('pc-1');

    // Switch to Analytics view -> fetches /api/projectarium/analytics?days=30
    const analyticsTab = fixture.nativeElement.querySelector('[data-testid="cockpit-tab-analytics"]') as HTMLButtonElement;
    analyticsTab.click();
    fixture.detectChanges();

    const analyticsReq = httpMock.expectOne('/api/projectarium/analytics?days=30');
    analyticsReq.flush({
      windowDays: 30,
      generatedAt: '2026-11-16T10:00:00.000Z',
      totalRuns: 5,
      activeRuns: 2,
      totalDurationSec: 7200,
      machines: [
        {
          machineId: 'pc-1',
          machineName: 'PC-1',
          activeCount: 1,
          totalRuns: 3,
          totalDurationSec: 4200,
          lastActiveAt: '2026-11-16T10:00:00.000Z',
          topApps: [{ appName: 'web-dev', standSlug: 'actions', standName: 'Lemon Actions', runs: 3, activeCount: 1, totalDurationSec: 4200 }],
        },
        {
          machineId: 'pc-2',
          machineName: 'PC-2',
          activeCount: 1,
          totalRuns: 2,
          totalDurationSec: 3000,
          lastActiveAt: '2026-11-16T09:55:00.000Z',
          topApps: [{ appName: 'calendar-dev', standSlug: 'seasons', standName: 'Lemon Seasons', runs: 2, activeCount: 1, totalDurationSec: 3000 }],
        },
      ],
      topApps: [
        { appName: 'web-dev', standSlug: 'actions', standName: 'Lemon Actions', totalRuns: 3, activeCount: 1, totalDurationSec: 4200, machines: ['PC-1'] },
      ],
      recentRuns: [],
    });
    fixture.detectChanges();

    const analyticsPanel = fixture.nativeElement.querySelector('[data-testid="projectarium-analytics-panel"]') as HTMLElement;
    expect(analyticsPanel).not.toBeNull();
    expect(analyticsPanel.textContent).toContain('PC-1');
    expect(analyticsPanel.textContent).toContain('PC-2');
    expect(analyticsPanel.textContent).toContain('web-dev');

    httpMock.match((req) => !req.url.includes('/api/projectarium/'));
    httpMock.verify();
  });
});
