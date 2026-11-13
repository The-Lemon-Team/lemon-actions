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

@Directive({
  selector: '[appModalOverlay]',
  standalone: true,
})
export class ModalOverlayDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private mouseDownTarget: EventTarget | null = null;

  @HostBinding('attr.role') readonly role = 'dialog';
  @HostBinding('attr.aria-modal') readonly ariaModal = 'true';

  @Input() appModalOverlayDismissable = true;
  @Output() readonly overlayClose = new EventEmitter<void>();

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    this.mouseDownTarget = event.target;
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (!this.appModalOverlayDismissable) return;

    const host = this.elementRef.nativeElement;
    const isScrollbar =
      event.clientX >= host.clientWidth || event.clientY >= host.clientHeight;
    if (isScrollbar) return;

    if (event.target === host && this.mouseDownTarget === host) {
      this.overlayClose.emit();
    }
    this.mouseDownTarget = null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (!this.appModalOverlayDismissable) return;
    event.stopPropagation();
    this.overlayClose.emit();
  }
}
