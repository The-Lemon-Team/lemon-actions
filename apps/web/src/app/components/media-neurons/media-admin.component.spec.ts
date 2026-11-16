import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MediaAdminComponent } from './media-admin.component';

describe('MediaAdminComponent', () => {
  it('loads status, folders, clients, and assets and renders moderation header', async () => {
    await TestBed.configureTestingModule({
      imports: [MediaAdminComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MediaAdminComponent);
    fixture.detectChanges();

    const statusReq = httpMock.expectOne((req) => req.url.endsWith('/api/media/status'));
    statusReq.flush({
      baseUrl: 'http://127.0.0.1:3005',
      connected: true,
      authenticated: true,
      sseConnected: true,
      neuronsSynced: true,
      combinatorNeurons: [
        { channel: 'library', neuronId: 'n1', path: '/media-hub/library', flowIds: ['f1'] },
      ],
    });

    const foldersReq = httpMock.expectOne((req) => req.url.endsWith('/api/media/folders'));
    foldersReq.flush([
      {
        id: 'fld-1',
        name: 'Covers',
        path: 'covers',
        defaultVisibility: 'PUBLIC',
        assetsCount: 1,
        createdAt: '2026-11-15T10:00:00.000Z',
        updatedAt: '2026-11-15T10:00:00.000Z',
      },
    ]);

    const clientsReq = httpMock.expectOne((req) => req.url.endsWith('/api/media/clients'));
    clientsReq.flush([
      {
        id: 'cli-1',
        slug: 'lemon-projectarium',
        name: 'Lemon Projectarium',
        apiKeyPrefix: 'lmh_1234',
        scopes: ['media:read'],
        isActive: true,
        grantsCount: 1,
        createdAt: '2026-11-15T10:00:00.000Z',
      },
    ]);

    const assetsReq = httpMock.expectOne(
      (req) => req.url.endsWith('/api/media/assets') && !req.params.has('folderPath'),
    );
    assetsReq.flush({
      total: 1,
      items: [
        {
          id: 'asset-1',
          kind: 'IMAGE',
          title: 'Project Hero Cover',
          description: 'Moderation test cover',
          url: '/api/media/asset-1/file/full',
          thumbnailUrl: '/api/media/asset-1/file/thumb',
          filename: 'hero.webp',
          originalFilename: 'hero.png',
          folderPath: 'covers',
          mimeType: 'image/webp',
          sizeBytes: 2048,
          width: 1280,
          height: 720,
          aspectRatio: '16:9',
          processingStatus: 'READY',
          visibility: 'SCOPED',
          tags: ['hero'],
          isFavorite: false,
          usageCount: 3,
          sourceApp: 'lemon-media-hub',
          model: 'manual-upload',
          grants: [
            {
              id: 'g1',
              clientId: 'cli-1',
              clientSlug: 'lemon-projectarium',
              permission: 'READ',
              grantedAt: '2026-11-15T10:00:00.000Z',
            },
          ],
          createdAt: '2026-11-15T10:00:00.000Z',
          updatedAt: '2026-11-15T10:00:00.000Z',
        },
      ],
    });

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Media Neurons');
    expect(text).toContain('Project Hero Cover');
    expect(text).toContain('Lemon Projectarium');
    expect(text).toContain('/media-hub/library');

    fixture.destroy();
    httpMock.verify();
  });
});
