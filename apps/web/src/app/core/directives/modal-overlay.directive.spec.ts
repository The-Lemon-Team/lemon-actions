import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalOverlayDirective } from './modal-overlay.directive';

@Component({
  standalone: true,
  imports: [ModalOverlayDirective],
  template: `
    <div
      appModalOverlay
      [appModalOverlayDismissable]="dismissable"
      (overlayClose)="closed = true"
      style="width: 500px; height: 500px;"
    >
      <div id="content" style="width: 200px; height: 200px;">Modal Dialog Content</div>
    </div>
  `,
})
class TestHostComponent {
  dismissable = true;
  closed = false;
}

describe('ModalOverlayDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should set role="dialog" and aria-modal="true"', () => {
    const overlay = fixture.nativeElement.querySelector('[appModalOverlay]');
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
  });

  it('should emit overlayClose on Escape key', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    expect(component.closed).toBeTrue();
  });

  it('should emit overlayClose on direct backdrop click', () => {
    const overlay = fixture.nativeElement.querySelector('[appModalOverlay]');
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));
    expect(component.closed).toBeTrue();
  });

  it('should NOT emit overlayClose when dragging from inside content to outside', () => {
    const overlay = fixture.nativeElement.querySelector('[appModalOverlay]');
    const content = fixture.nativeElement.querySelector('#content');

    // mousedown inside dialog
    content.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    // mouseup/click released on overlay backdrop
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));

    expect(component.closed).toBeFalse();
  });

  it('should NOT emit overlayClose when dismissable is false', () => {
    component.dismissable = false;
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    expect(component.closed).toBeFalse();
  });
});
