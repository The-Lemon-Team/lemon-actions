import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { ProfileService } from './core/services/profile.service';

describe('AppComponent', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should navigate and set appMode when onModeChange is called', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const profileService = TestBed.inject(ProfileService);

    spyOn(router, 'navigate');
    spyOn(profileService, 'setAppMode');

    component.onModeChange('actions');

    expect(profileService.setAppMode).toHaveBeenCalledWith('actions');
    expect(router.navigate).toHaveBeenCalledWith(['/actions']);
  });
});
