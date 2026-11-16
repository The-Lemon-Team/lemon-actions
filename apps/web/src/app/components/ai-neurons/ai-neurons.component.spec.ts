import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AiNeuronsComponent } from './ai-neurons.component';

describe('AiNeuronsComponent', () => {
  it('loads status, stats, clients, and history and renders AI-neurons workspace', async () => {
    await TestBed.configureTestingModule({
      imports: [AiNeuronsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AiNeuronsComponent);
    fixture.detectChanges();

    const statusReq = httpMock.expectOne((req) => req.url.endsWith('/api/ai/status'));
    statusReq.flush({
      baseUrl: 'http://127.0.0.1:3006',
      connected: true,
      authenticated: true,
      hasApiKey: true,
      configured: true,
      geminiConfigured: true,
      imageEngine: 'flux',
      textModels: ['gemini-2.5-flash'],
      imageModels: ['flux', 'sana'],
      neuronsSynced: true,
      combinatorNeurons: [
        { channel: 'studio', neuronId: 'n1', path: '/ai-neurons/studio', flowIds: ['f1'] },
      ],
    });

    const statsReq = httpMock.expectOne((req) => req.url.endsWith('/api/ai/history/stats'));
    statsReq.flush({
      totalRequests: 1,
      avgLatencyMs: 145,
      tokens: { input: 12, output: 30, total: 42 },
      byStatus: [{ status: 'SUCCESS', count: 1 }],
      byTask: [{ taskType: 'TEXT_GENERATE', count: 1, avgLatencyMs: 145 }],
    });

    const clientsReq = httpMock.expectOne((req) => req.url.endsWith('/api/ai/clients'));
    clientsReq.flush([
      {
        id: 'cli-1',
        slug: 'lemon-seasons',
        name: 'Lemon Seasons',
        apiKeyPrefix: 'lai_dev_seas...',
        allowedTasks: ['TEXT_GENERATE', 'IMAGE_GENERATE'],
        isActive: true,
        createdAt: '2026-11-15T10:00:00.000Z',
      },
    ]);

    const historyReq = httpMock.expectOne((req) => req.url.endsWith('/api/ai/history'));
    historyReq.flush({
      total: 1,
      limit: 24,
      offset: 0,
      items: [
        {
          id: 'log-1',
          clientSlug: 'lemon-seasons',
          taskType: 'TEXT_GENERATE',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          status: 'SUCCESS',
          isFallback: false,
          inputPayload: { prompt: 'Summarize AI-neurons design' },
          outputPayload: { text: 'AI-neurons wraps Umniy Lemon cleanly.' },
          latencyMs: 145,
          totalTokens: 42,
          mediaAssetIds: [],
          createdAt: '2026-11-15T10:05:00.000Z',
        },
      ],
    });

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('AI-neurons');
    expect(text).toContain('Umniy Lemon');
    expect(text).toContain('Lemon Seasons');
    expect(text).toContain('/ai-neurons/studio');
    expect(text).toContain('Summarize AI-neurons design');

    fixture.destroy();
    httpMock.verify();
  });

  it('submits text generation request and refreshes history', async () => {
    await TestBed.configureTestingModule({
      imports: [AiNeuronsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AiNeuronsComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.endsWith('/api/ai/status')).flush({
      baseUrl: 'http://127.0.0.1:3006',
      connected: true,
      authenticated: true,
      hasApiKey: true,
      configured: true,
      geminiConfigured: true,
      imageEngine: 'flux',
      textModels: ['gemini-2.5-flash'],
      imageModels: ['flux'],
      neuronsSynced: true,
      combinatorNeurons: [],
    });
    httpMock.expectOne((r) => r.url.endsWith('/api/ai/history/stats')).flush({
      totalRequests: 0,
      avgLatencyMs: 0,
      tokens: { input: 0, output: 0, total: 0 },
      byStatus: [],
      byTask: [],
    });
    httpMock.expectOne((r) => r.url.endsWith('/api/ai/clients')).flush([]);
    httpMock.expectOne((r) => r.url.endsWith('/api/ai/history')).flush({
      total: 0,
      limit: 24,
      offset: 0,
      items: [],
    });

    fixture.componentInstance.onGenerateText({ prompt: 'Create tagline' });

    const genReq = httpMock.expectOne((r) => r.url.endsWith('/api/ai/generate-text'));
    expect(genReq.request.method).toBe('POST');
    expect(genReq.request.body).toEqual({ prompt: 'Create tagline' });
    genReq.flush({ text: 'Umniy Lemon powers AI-neurons!', requestId: 'req-99' });

    httpMock.expectOne((r) => r.url.endsWith('/api/ai/history')).flush({
      total: 1,
      limit: 24,
      offset: 0,
      items: [
        {
          id: 'req-99',
          clientSlug: 'admin',
          taskType: 'TEXT_GENERATE',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          status: 'SUCCESS',
          isFallback: false,
          inputPayload: { prompt: 'Create tagline' },
          outputPayload: { text: 'Umniy Lemon powers AI-neurons!' },
          latencyMs: 88,
          totalTokens: 20,
          mediaAssetIds: [],
          createdAt: '2026-11-15T10:10:00.000Z',
        },
      ],
    });
    httpMock.expectOne((r) => r.url.endsWith('/api/ai/history/stats')).flush({
      totalRequests: 1,
      avgLatencyMs: 88,
      tokens: { input: 10, output: 10, total: 20 },
      byStatus: [{ status: 'SUCCESS', count: 1 }],
      byTask: [{ taskType: 'TEXT_GENERATE', count: 1, avgLatencyMs: 88 }],
    });

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Umniy Lemon powers AI-neurons!');

    fixture.destroy();
    httpMock.verify();
  });
});
