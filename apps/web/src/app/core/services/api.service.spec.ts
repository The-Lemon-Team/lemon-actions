import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';

describe('ApiService (Shard Selection & Persistence)', () => {
  const storageKey = 'lemon_active_shard_v1';

  beforeEach(() => {
    localStorage.removeItem(storageKey);
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('persists active shard in localStorage and builds dynamic streamUrl', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const api = TestBed.inject(ApiService);
    expect(api.getActiveShard()).toBeNull();

    api.setActiveShard({
      shardId: 'shard-lemon-watchers-01',
      projectSlug: 'lemon-watchers',
      projectName: 'Lemon Watchers',
      tier: 'dedicated',
      apiBaseUrl: 'http://192.168.1.100:4320/api',
    });

    expect(api.base).toBe('http://192.168.1.100:4320/api');
    expect(api.streamUrl()).toBe(
      'http://192.168.1.100:4320/api/flows/stream?projectSlug=lemon-watchers',
    );
    expect(localStorage.getItem(storageKey)).toContain('shard-lemon-watchers-01');

    // Reset TestBed to verify restoration from localStorage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const restoredApi = TestBed.inject(ApiService);
    expect(restoredApi.getActiveShard()?.shardId).toBe('shard-lemon-watchers-01');
    expect(restoredApi.base).toBe('http://192.168.1.100:4320/api');

    restoredApi.setActiveShard(null);
    expect(restoredApi.getActiveShard()).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
