import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { FlowStatus, FlowType, Folder } from '../models/flow.models';
import { ApiService } from './api.service';
import { FlowOrchestratorService } from './flow-orchestrator.service';
import { ProfileService } from './profile.service';

describe('FlowOrchestratorService (Projects -> Sub-Neurons hierarchy)', () => {
  const mockFolders: Folder[] = [
    {
      id: 'p-home',
      name: 'Home',
      parentId: null,
      path: 'home',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'f-supplies',
      name: 'Household Supplies',
      parentId: 'p-home',
      path: 'home.supplies',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'f-routines',
      name: 'Home Routines',
      parentId: 'p-home',
      path: 'home.routines',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p-focus',
      name: 'Focus Modes',
      parentId: null,
      path: 'focus_modes',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockFlows = [
    {
      id: 'fl-1',
      name: 'Coffee Beans',
      type: FlowType.CONTEXT,
      status: FlowStatus.ACTIVE,
      isExclusive: false,
      folderId: 'f-supplies',
      tags: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  let service: FlowOrchestratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FlowOrchestratorService,
        {
          provide: ApiService,
          useValue: {
            getFolders: () => of(mockFolders),
            getFlows: () => of(mockFlows),
            getProfiles: () => of([]),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            currentProfileId: 'default-profile',
            activeProfile$: of({ id: 'default-profile', handle: 'default', displayName: 'Default', createdAt: '' }),
          },
        },
      ],
    });
    service = TestBed.inject(FlowOrchestratorService);
  });

  it('returns empty folderTree$ when no project is selected (All Projects)', async () => {
    const projects = await firstValueFrom(service.projects$);
    const selectedProject = await firstValueFrom(service.selectedProject$);
    const subNeurons = await firstValueFrom(service.folderTree$);

    expect(projects.length).toBe(2);
    expect(selectedProject).toBeNull();
    expect(subNeurons).toEqual([]);
  });

  it('returns only direct sub-neurons of the selected project in folderTree$', async () => {
    service.selectProject('p-home');

    const selectedProject = await firstValueFrom(service.selectedProject$);
    const subNeurons = await firstValueFrom(service.folderTree$);

    expect(selectedProject?.id).toBe('p-home');
    expect(subNeurons.map((n) => n.id)).toEqual(['f-routines', 'f-supplies']);
  });

  it('auto-selects parent project when selecting a sub-neuron directly and resets on All Projects', async () => {
    service.selectFolder('f-supplies');

    expect((await firstValueFrom(service.selectedProject$))?.id).toBe('p-home');
    expect(await firstValueFrom(service.selectedFolderId$)).toBe('f-supplies');

    service.selectProject(null);

    expect(await firstValueFrom(service.selectedProject$)).toBeNull();
    expect(await firstValueFrom(service.selectedFolderId$)).toBeNull();
  });
});
