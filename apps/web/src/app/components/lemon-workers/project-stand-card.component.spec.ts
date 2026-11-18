import { TestBed } from '@angular/core/testing';
import { ProjectStandCardComponent } from './project-stand-card.component';
import { ProjectStand, StandAppItem } from '../../core/models/project-stand.models';

function buildStand(apps: StandAppItem[]): ProjectStand {
  return {
    id: 'stand-1',
    name: 'Test Stand',
    slug: 'test-stand',
    description: 'Stand for status badge tests',
    color: 'default',
    isPinned: false,
    neuronPath: '/workspace/test',
    tags: [],
    environments: ['dev', 'staging'],
    activeEnvironment: 'ALL',
    apps,
    chronicle: [],
    todos: [],
    notes: [],
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
  };
}

function buildApp(overrides: Partial<StandAppItem>): StandAppItem {
  return {
    id: 'app-1',
    appName: 'Lemon API',
    role: 'Backend',
    port: 4321,
    url: 'http://localhost:4321',
    instanceId: 'inst-1',
    leaseToken: 'lease-1',
    environment: 'dev',
    networkMode: 'local',
    status: 'HEALTHY',
    lastLatencyMs: 14,
    lastCheckedAt: '2026-11-14T10:00:00.000Z',
    consecutiveFailures: 0,
    icon: 'dns',
    ...overrides,
  };
}

describe('ProjectStandCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectStandCardComponent],
    }).compileComponents();
  });

  it('shows UP status and only real remove action without mock simulation/recovery buttons', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    fixture.componentRef.setInput('stand', buildStand([buildApp({ status: 'HEALTHY', lastLatencyMs: 14 })]));
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="app-health-badge"]') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('UP · 14ms');

    expect(fixture.nativeElement.querySelector('button[aria-label="Имитировать сбой сервиса"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Восстановить сервис"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Удалить сервис"]')).not.toBeNull();
  });

  it('shows DEGRADED count without mock recovery or simulate-failure buttons', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    fixture.componentRef.setInput(
      'stand',
      buildStand([buildApp({ status: 'DEGRADED', consecutiveFailures: 2 })]),
    );
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="app-health-badge"]') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('DEGRADED (2/5)');

    expect(fixture.nativeElement.querySelector('button[aria-label="Имитировать сбой сервиса"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Восстановить сервис"]')).toBeNull();
  });

  it('shows DOWN status without mock recovery or simulate-failure buttons when evicted', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    fixture.componentRef.setInput(
      'stand',
      buildStand([buildApp({ status: 'EVICTED', consecutiveFailures: 5 })]),
    );
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="app-health-badge"]') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('DOWN');

    expect(fixture.nativeElement.querySelector('button[aria-label="Имитировать сбой сервиса"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Восстановить сервис"]')).toBeNull();
  });

  it('shows CHECKING... badge while active probe is in progress', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    fixture.componentRef.setInput(
      'stand',
      buildStand([buildApp({ status: 'CHECKING', consecutiveFailures: 0 })]),
    );
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="app-health-badge"]') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('CHECKING...');
  });

  it('displays explicit host:port addresses and clickable HTTP links for remote and local apps', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    fixture.componentRef.setInput(
      'stand',
      buildStand([
        buildApp({
          id: 'app-remote',
          appName: 'Calendar - app',
          host: '192.168.1.100',
          port: 5174,
          url: 'http://192.168.1.100:5174/',
          networkMode: 'lan',
        }),
        buildApp({
          id: 'app-db',
          appName: 'Lemon-seasons DB',
          host: '192.168.1.100',
          port: 5435,
          url: 'postgresql://192.168.1.100:5435/lemon_calendarium',
          networkMode: 'lan',
        }),
      ]),
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('192.168.1.100:5174');
    expect(text).toContain('192.168.1.100:5435');

    const link = fixture.nativeElement.querySelector('a[href="http://192.168.1.100:5174/"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
  });

  it('displays notes tab and emits addNote / updateNote events', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    const stand = buildStand([]);
    stand.notes = [
      {
        id: 'n-1',
        title: 'Идея для Lemon-Universe',
        content: 'Time Traveling + Hero Cards',
        author: 'Team',
        tags: ['Time Traveling'],
        createdAt: '2026-11-14T10:00:00.000Z',
        updatedAt: '2026-11-14T10:00:00.000Z',
      },
    ];
    fixture.componentRef.setInput('stand', stand);
    fixture.detectChanges();

    const addedEvents: any[] = [];
    const updatedEvents: any[] = [];
    fixture.componentInstance.addNote.subscribe((ev) => addedEvents.push(ev));
    fixture.componentInstance.updateNote.subscribe((ev) => updatedEvents.push(ev));

    const notesTab = fixture.nativeElement.querySelector('[data-testid="stand-tab-notes"]') as HTMLButtonElement;
    notesTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Time Traveling + Hero Cards');

    // Open add note form and submit
    const toggleAddBtn = fixture.nativeElement.querySelector('[data-testid="toggle-add-note"]') as HTMLButtonElement;
    toggleAddBtn.click();
    fixture.detectChanges();

    fixture.componentInstance.newNoteTitle = 'Новая заметка';
    fixture.componentInstance.newNoteContent = 'Проверить FSM переходы';
    fixture.componentInstance.newNoteTagsText = 'FSM, Time Traveling';
    fixture.componentInstance.submitNewNote();
    fixture.detectChanges();

    expect(addedEvents.length).toBe(1);
    expect(addedEvents[0].note.content).toBe('Проверить FSM переходы');
    expect(addedEvents[0].note.tags).toEqual(['FSM', 'Time Traveling']);

    // Edit existing note
    const editBtn = fixture.nativeElement.querySelector('[data-testid="edit-note-btn"]') as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    fixture.componentInstance.editNoteContent = 'Обновлённый текст заметки';
    fixture.componentInstance.saveEditNote('n-1');
    fixture.detectChanges();

    expect(updatedEvents.length).toBe(1);
    expect(updatedEvents[0].noteId).toBe('n-1');
    expect(updatedEvents[0].patch.content).toBe('Обновлённый текст заметки');
  });

  it('expands list containers without scroll clipping when expanded is true', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    fixture.componentRef.setInput('stand', buildStand([]));
    fixture.detectChanges();

    expect(fixture.componentInstance.appsListContainerClass).toContain('max-h-[34rem]');
    expect(fixture.componentInstance.appsListContainerClass).toContain('overflow-y-auto');

    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.appsListContainerClass).toBe('flex flex-col gap-2');
    expect(fixture.componentInstance.secondaryListContainerClass).toBe('flex flex-col gap-1.5');
    expect(fixture.componentInstance.notesListContainerClass).toBe('flex flex-col gap-2');
  });

  it('separates public/shared URLs from machine-bound localhost apps in local-apps-section', () => {
    const fixture = TestBed.createComponent(ProjectStandCardComponent);
    fixture.componentRef.setInput('selectedMachineId', 'pc-1');
    fixture.componentRef.setInput('selectedMachineName', 'PC-1');
    fixture.componentRef.setInput(
      'stand',
      buildStand([
        buildApp({
          id: 'app-prod',
          appName: 'Prod Gateway',
          host: '192.168.1.100',
          port: 8090,
          url: 'http://192.168.1.100:8090/health',
          environment: 'production',
          networkMode: 'lan',
        }),
        buildApp({
          id: 'app-local-1',
          appName: 'Local Dev UI',
          host: 'localhost',
          port: 4320,
          url: 'http://localhost:4320/health',
          environment: 'dev',
          networkMode: 'local',
          machineId: 'pc-1',
          machineName: 'PC-1',
        }),
      ]),
    );
    fixture.detectChanges();

    const localSection = fixture.nativeElement.querySelector('[data-testid="local-apps-section"]') as HTMLElement | null;
    expect(localSection).not.toBeNull();
    expect(localSection!.textContent).toContain('PC-1');
    expect(localSection!.textContent).toContain('Local Dev UI');
    expect(localSection!.textContent).not.toContain('Prod Gateway');
  });
});
