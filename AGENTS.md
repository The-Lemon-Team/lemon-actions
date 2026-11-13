# Lemon Actions — Agent Guidelines & Project Rules

## Modal Dialogs Rule
All modal dialogs in this repository must comply with the rule defined in [`.agents/rules/modal-interaction.md`](./.agents/rules/modal-interaction.md):
- **Escape Key (`document:keydown.escape`)**: Closes the open modal.
- **Backdrop / Outside Click**: Closes the modal only when both `mousedown` and `click` originated directly on the backdrop (prevents accidental closure when selecting text inside inputs and dragging mouse outside).
- **Close & Cancel**: Explicit close button in the header and cancel button in the footer.
- **State Reset on Close**: Form fields and transient state must be reset cleanly upon closing without saving.
- **Accessibility**: Include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- **Reusable Directive**: Apply `ModalOverlayDirective` (`appModalOverlay` from `apps/web/src/app/core/directives/modal-overlay.directive.ts`).

## Application Registration & Port Shield Rule
All autonomous agents starting background servers, preview listeners, or microservices must comply with [`.agents/rules/port-allocation.md`](./.agents/rules/port-allocation.md):
- **Root Infrastructure Anchors (Zero-Deadlock)**: Core stack (PostgreSQL `:5433`, Backend API `:3000`, Angular Web `:4201`) are root anchors. The API is the host of Port Shield itself and does NOT register through HTTP to start.
- **Dynamic Pre-Registration (Ports 4301+)**: Call `lemon_register_app` (MCP) or `POST /api/registry/register` before starting any dynamic agent microservice or listener.
- **Port Compliance**: Bind strictly to the returned `allocatedPort` (4301+). Never bind to hardcoded ports.
- **Lease & Heartbeat**: Maintain lease tokens; 5 consecutive failed pings trigger automatic eviction and port reclaim.
- **Clean Release**: Call `lemon_release_app` or `POST /api/registry/release` upon task completion.

## Angular & SOLID Clean Architecture Rule
All Angular code in this repository must comply with [`.agents/rules/angular-solid-architecture.md`](./.agents/rules/angular-solid-architecture.md):
- **Modern Angular**: Standalone components only, native control flow (`@if`, `@for`, `@switch`), functional `inject()`, `OnPush` change detection.
- **SOLID Compliance**: Strict Smart/Dumb component separation (SRP), directive-based extension (OCP), contract-first interfaces (LSP), focused models (ISP), and reactive bus decoupling (DIP).
- **Template Safety**: Never use `/` in template class bindings (e.g. `[class.bg-black/5]`); use string expressions or helper methods.

