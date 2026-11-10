# Lemon Actions — Agent Guidelines & Project Rules

## Modal Dialogs Rule
All modal dialogs in this repository must comply with the rule defined in [`.agents/rules/modal-interaction.md`](./.agents/rules/modal-interaction.md):
- **Escape Key (`document:keydown.escape`)**: Closes the open modal.
- **Backdrop / Outside Click**: Closes the modal only when both `mousedown` and `click` originated directly on the backdrop (prevents accidental closure when selecting text inside inputs and dragging mouse outside).
- **Close & Cancel**: Explicit close button in the header and cancel button in the footer.
- **State Reset on Close**: Form fields and transient state must be reset cleanly upon closing without saving.
- **Accessibility**: Include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- **Reusable Directive**: Apply `ModalOverlayDirective` (`appModalOverlay` from `apps/web/src/app/core/directives/modal-overlay.directive.ts`).
