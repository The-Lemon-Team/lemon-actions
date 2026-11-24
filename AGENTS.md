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
- **Dynamic Pre-Registration (Ports 4320+)**: Call `lemon_register_app` (MCP) or `POST /api/projectarium/register` before starting any dynamic agent microservice or listener.
- **Port Compliance**: Bind strictly to the returned `allocatedApp.port` (4320+). Never bind to hardcoded ports.
- **Lease & Heartbeat**: Maintain lease tokens (`lemon_heartbeat` / `POST /api/projectarium/heartbeat`); 5 consecutive failed probes trigger automatic eviction and port reclaim.
- **Clean Release**: Call `lemon_release_app` or `POST /api/projectarium/release` upon task completion.

## Angular & SOLID Clean Architecture Rule
All Angular code in this repository must comply with [`.agents/rules/angular-solid-architecture.md`](./.agents/rules/angular-solid-architecture.md):
- **Modern Angular**: Standalone components only, native control flow (`@if`, `@for`, `@switch`), functional `inject()`, `OnPush` change detection.
- **SOLID Compliance**: Strict Smart/Dumb component separation (SRP), directive-based extension (OCP), contract-first interfaces (LSP), focused models (ISP), and reactive bus decoupling (DIP).
- **Template Safety**: Never use `/` in template class bindings (e.g. `[class.bg-black/5]`); use string expressions or helper methods.

## Cross-Repo Rule: Obsidian Work Deferred
- In `lemon-calendarium` / `lemon-seasons`, all Obsidian-related work (`packages/obsidian-plugin`, `packages/obsidian-containers`, `container-sync-server` `:3031`, and Obsidian sync UI/endpoints) is **deferred ("оставляем на потом")** per `lemon-calendarium/.agents/rules/obsidian_deferred.md`. Neglect/skip Obsidian tasks and checks unless the user explicitly asks for Obsidian work.

## Unified Projectarium Workspace Rule (Lemon Seasons)
All project-management changes across all projects must comply with [`.agents/rules/projectarium-workspace.md`](./.agents/rules/projectarium-workspace.md):
- **No Per-Project Feeds/Streams**: Do NOT create separate Lemon Seasons feeds or streams for individual projects (such as `lemon-actions`, `lemon-watchers`, etc.).
- **Single Umbrella**: All project updates, decisions, roadmaps, and new project-management features live under **Lemon Projectarium** inside the private `projectarium` stream (**Projectarium Workspace**, `http://192.168.1.100:5175/projectarium`), using its functional feeds (`projectarium-projects`, `projectarium-todos`, `projectarium-notes`, `projectarium-chronicle`).
- **Tagging Over Siloing**: Identify specific projects via tags/metadata (`stand:<slug>`, `project:<slug>`), never separate feeds.

## Inter-Service Subscriptions & Lemon Stack Bus Rule
All cross-service event integrations must comply with [`.agents/rules/inter-service-bus.md`](./.agents/rules/inter-service-bus.md):
- **No Direct Service-to-Service SSE/Polling**: Never wire backend services together via direct SSE streams (e.g., `/api/media/stream`) or polling loops; SSE is only for live browser/UI feeds.
- **Use `@lemon/stack-bus` (NATS JetStream)**: Publish compact lifecycle facts (`lemon.<projectSlug>.<domain>.<event>`) with `dedupKey` and consume via JetStream or `lemon-core` `OBSERVER` selectors.
- **Direct HTTP Only for Immediate Payload**: Return uploaded media/files synchronously via `POST /upload` / `GET /file`; use the bus for async processing (`media.ready`) and cross-project reactions.


