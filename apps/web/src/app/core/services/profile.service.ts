import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, combineLatest, map, of, shareReplay, tap } from 'rxjs';
import { AppMode, Profile } from '../models/flow.models';
import { ApiService } from './api.service';

const FALLBACK_PROFILES: Profile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    handle: 'default',
    displayName: 'Мой Дом (Основной)',
    avatarIcon: 'home',
    createdAt: '2026-11-04T08:00:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    handle: 'dacha',
    displayName: 'Загородный Дом (Дача)',
    avatarIcon: 'cottage',
    createdAt: '2026-11-04T09:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);

  private readonly profilesSubject = new BehaviorSubject<Profile[]>(FALLBACK_PROFILES);
  private readonly activeProfileIdSubject = new BehaviorSubject<string>(FALLBACK_PROFILES[0].id);
  private readonly appModeSubject = new BehaviorSubject<AppMode>('home');

  readonly profiles$: Observable<Profile[]> = this.profilesSubject.asObservable();
  readonly activeProfileId$: Observable<string> = this.activeProfileIdSubject.asObservable();
  readonly appMode$: Observable<AppMode> = this.appModeSubject.asObservable();

  readonly activeProfile$: Observable<Profile> = combineLatest([
    this.profiles$,
    this.activeProfileId$,
  ]).pipe(
    map(([profiles, activeId]) => profiles.find((p) => p.id === activeId) ?? profiles[0] ?? FALLBACK_PROFILES[0]),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    this.loadProfiles();
  }

  get currentProfileId(): string {
    return this.activeProfileIdSubject.value;
  }

  loadProfiles(): void {
    this.api
      .getProfiles()
      .pipe(catchError(() => of(this.profilesSubject.value)))
      .subscribe((profiles) => {
        if (profiles.length > 0) {
          this.profilesSubject.next(profiles);
          if (!profiles.some((p) => p.id === this.activeProfileIdSubject.value)) {
            this.activeProfileIdSubject.next(profiles[0].id);
          }
        }
      });
  }

  selectProfile(profileId: string): void {
    if (this.activeProfileIdSubject.value !== profileId) {
      this.activeProfileIdSubject.next(profileId);
    }
  }

  setAppMode(mode: AppMode): void {
    this.appModeSubject.next(mode);
  }

  registerProfile(dto: { handle: string; displayName: string; avatarIcon?: string }): Observable<Profile> {
    const cleanHandle = dto.handle.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    const cleanName = dto.displayName.trim();
    const icon = dto.avatarIcon || 'home';

    return this.api.registerProfile({ handle: cleanHandle, displayName: cleanName, avatarIcon: icon }).pipe(
      catchError(() => {
        const localProfile: Profile = {
          id: `00000000-0000-0000-0000-${String(Date.now()).slice(-12)}`,
          handle: cleanHandle,
          displayName: cleanName,
          avatarIcon: icon,
          createdAt: new Date().toISOString(),
        };
        return of(localProfile);
      }),
      tap((created) => {
        const existing = this.profilesSubject.value;
        const next = existing.some((p) => p.id === created.id)
          ? existing
          : [...existing, created];
        this.profilesSubject.next(next);
        this.activeProfileIdSubject.next(created.id);
      }),
    );
  }
}
