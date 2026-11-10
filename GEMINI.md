# Lemon Actions — Gemini & Antigravity Rules

See [AGENTS.md](./AGENTS.md) and [`.agents/rules/modal-interaction.md`](./.agents/rules/modal-interaction.md) for full project standards and rules.

### Modal Dialogs
All modal dialog components must implement:
1. Outside / Backdrop click dismissal with mousedown origin tracking.
2. Escape key dismissal.
3. Clean state and form reset on dismiss/cancel.
4. Proper accessibility attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
5. The `ModalOverlayDirective` (`appModalOverlay`).
