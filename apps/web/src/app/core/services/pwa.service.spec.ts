import { TestBed } from '@angular/core/testing';
import { BeforeInstallPromptEvent, PwaService } from './pwa.service';

describe('PwaService', () => {
  let service: PwaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PwaService);
  });

  it('captures beforeinstallprompt and triggers native install prompt', async () => {
    service.init();
    expect(service.canNativeInstall()).toBeFalse();

    const promptSpy = jasmine.createSpy('prompt').and.returnValue(Promise.resolve());
    const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
    Object.defineProperty(event, 'prompt', { value: promptSpy });
    Object.defineProperty(event, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(service.canNativeInstall()).toBeTrue();

    const outcome = await service.triggerInstall();
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    expect(service.canNativeInstall()).toBeFalse();
  });

  it('opens install guide modal when native prompt is unavailable', async () => {
    service.init();
    expect(service.showInstallGuide()).toBeFalse();

    const outcome = await service.triggerInstall();
    expect(outcome).toBe('manual');
    expect(service.showInstallGuide()).toBeTrue();

    service.closeInstallGuide();
    expect(service.showInstallGuide()).toBeFalse();
  });

  it('marks app as standalone on appinstalled event', () => {
    service.init();
    window.dispatchEvent(new Event('appinstalled'));
    expect(service.isStandalone()).toBeTrue();
    expect(service.showInstallButton()).toBeFalse();
  });
});
