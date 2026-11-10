import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';

/**
 * Standard directive for modal backdrops / overlays.
 *
 * Ensures consistent behavior across all modal dialogs:
 * 1. Outside / Backdrop click closes the modal, verifying both mousedown & click
 *    originated on the backdrop element (prevents accidental close when drag-selecting text).
 * 2. Escape key (document:keydown.escape) dismisses the open modal.
 * 3. Ignored if dismissed while clicking on scrollbars or when dismissable=false.
 * 4. Injects ARIA role="dialog" and aria-modal="true".
 */
@Directive({
  selector: '[appModalOverlay]',
  standalone: true,
})
export class ModalOverlayDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private mouseDownTarget: EventTarget | null = null;

  @HostBinding('attr.role') readonly role = 'dialog';
  @HostBinding('attr.aria-modal') readonly ariaModal = 'true';

  /**
   * If false, outside click and Escape won't dismiss (e.g. during active submit).
   * Defaults to true.
   */
  @Input() appModalOverlayDismissable = true;

  @Output() readonly overlayClose = new EventEmitter<void>();

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    this.mouseDownTarget = event.target;
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (!this.appModalOverlayDismissable) {
      return;
    }

    const host = this.elementRef.nativeElement;

    // Check if click was on vertical or horizontal scrollbar
    const isScrollbar =
      event.clientX >= host.clientWidth || event.clientY >= host.clientHeight;
    if (isScrollbar) {
      return;
    }

    // Trigger only if both mousedown and mouseup/click originated directly on the overlay backdrop
    if (event.target === host && this.mouseDownTarget === host) {
      this.overlayClose.emit();
    }

    this.mouseDownTarget = null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (!this.appModalOverlayDismissable) {
      return;
    }
    event.stopPropagation();
    this.overlayClose.emit();
  }
}
