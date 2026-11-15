# Lemon Actions — Gemini & Antigravity Rules

See [AGENTS.md](./AGENTS.md) and [`.agents/rules/modal-interaction.md`](./.agents/rules/modal-interaction.md) for full project standards and rules.

### Modal Dialogs
All modal dialog components must implement:
1. Outside / Backdrop click dismissal with mousedown origin tracking.
2. Escape key dismissal.
3. Clean state and form reset on dismiss/cancel.
4. Proper accessibility attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
5. The `ModalOverlayDirective` (`appModalOverlay`).

### Port Allocation & Lemon-Projectarium Port Shield
Autonomous agents starting servers must pre-register via `POST /api/projectarium/register` or the MCP server (`lemon_register_app`) and bind strictly to the allocated port according to [`.agents/rules/port-allocation.md`](./.agents/rules/port-allocation.md).
Root anchors (`:5433` DB, `:3000` API, `:4201` Web) are exempt from HTTP pre-registration to prevent circular bootstrap deadlocks.

### Angular & SOLID Standards
All Angular components must follow [`.agents/rules/angular-solid-architecture.md`](./.agents/rules/angular-solid-architecture.md):
- Standalone components only, native `@if`/`@for`, `inject()`, `ChangeDetectionStrategy.OnPush`.
- Strict SOLID decomposition, Smart/Dumb architecture, safe template class syntax (no `/` in property bindings).

