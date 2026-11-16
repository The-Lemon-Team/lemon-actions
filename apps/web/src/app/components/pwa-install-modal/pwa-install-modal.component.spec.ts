import { TestBed } from '@angular/core/testing';
import { PwaInstallModalComponent } from './pwa-install-modal.component';

describe('PwaInstallModalComponent', () => {
  it('renders title, origin hint on HTTP LAN, and emits closed on Escape', async () => {
    await TestBed.configureTestingModule({
      imports: [PwaInstallModalComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(PwaInstallModalComponent);
    fixture.componentRef.setInput('appTitle', 'Lemon Projectarium');
    fixture.componentRef.setInput('appIcon', 'domain');
    fixture.componentRef.setInput('originUrl', 'http://192.168.1.100:8088');
    fixture.componentRef.setInput('isSecureContext', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lemon Projectarium');
    expect(el.textContent).toContain('http://192.168.1.100:8088');
    expect(el.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');

    const closeSpy = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closeSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('resets copiedTarget state when closed', async () => {
    await TestBed.configureTestingModule({
      imports: [PwaInstallModalComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(PwaInstallModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.copyText('http://192.168.1.100:8088', 'origin');
    expect(fixture.componentInstance.copiedTarget()).toBe('origin');

    fixture.componentInstance.onClose();
    expect(fixture.componentInstance.copiedTarget()).toBeNull();
  });
});
