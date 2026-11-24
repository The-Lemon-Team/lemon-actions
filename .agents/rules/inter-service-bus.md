# Inter-Service Subscriptions & Lemon Stack Bus Rule

## Core Rule: Use the Bus, Never Direct Service-to-Service SSE Subscriptions
- **Do NOT subscribe directly from one backend service to another service's SSE stream** (e.g., opening persistent `EventSource`/streaming `fetch` connections between microservices like `GET /api/media/stream`) or rely on polling/heavy heartbeats for cross-service synchronization.
- **Always use `@lemon/stack-bus` (NATS JetStream `LEMON_STACK_BUS`)** for asynchronous inter-service events and cross-project subscriptions.

## Why Direct Inter-Service SSE Streams Are Harmful
1. **Lost Events on Restart/Disconnect**: In-memory SSE streams (`RxJS Subject`) have no persistence or `replay` — any event emitted while a consumer restarts or briefly disconnects is lost forever.
2. **Tight Coupling & Fallback Polling**: Direct SSE forces services to hardcode peer URLs, auth keys, and fallback polling loops (e.g., 1.5s `GET` intervals), amplifying CPU and database load.
3. **No Deduplication or Project Isolation**: Direct SSE lacks broker-level `msgID` deduplication and unified wildcard routing (`lemon.<projectSlug>.<domain>.<event>`).

## Required Pattern
- **Synchronous Media/Data Delivery**: Direct HTTP `POST /upload` and `GET /file` remain direct for immediate client responses (images, static files) and UI-only progress spinners.
- **Async Inter-Service Lifecycle Events**: Publish compact, meaningful domain facts (`media.created`, `media.ready`, `media.failed`, `media.deleted`, `stand.created`, `app.registered`, etc.) via `StackBusService.forProject(projectSlug)` with a deterministic `dedupKey`.
- **Cross-Project Reactions**: Subscribe via `StackBusService.subscribe$`, durable JetStream consumers, or `lemon-core` `OBSERVER` flow selectors (`config.selector.topics`, e.g., `lemon.media-hub.media.created`, `lemon.projectarium.>`).
- **Lightweight Heartbeats**: Never trigger full-stand DB rewrites on heartbeat; use single-row updates plus coalesced bus events (`dedupKey` windowed).
