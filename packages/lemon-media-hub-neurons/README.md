# `@lemon/media-hub-neurons`

Reactive Neuron, SSE Impulse Bus, Action Flow, and Core Combinator Bridge layer for **Lemon Media Hub**.

## Analogies with `seasons-neurons` & Core Combinator

| Seasons / Core Combinator | `lemon-media-hub-neurons` | Role |
|---|---|---|
| `SeasonsApiClient` | `MediaHubApiClient` | Typed HTTP client (Admin JWT, `X-Media-Api-Key`, uploads, folders, signed URLs) |
| `SeasonsSseBus` | `MediaSseBus` | Multiplexed SSE impulse bus (`GET /api/media/stream`) with reconnect + typed selectors |
| `TopologyNeuron` | `MediaTopologyNeuron` | Reactive folder catalog + live asset count updates |
| `FeedNeuron` | `FolderNeuron` | Paginated folder view + live add/update/move/delete SSE reconciliation |
| `StreamNeuron` | `MediaLibraryNeuron` | Library coordinator spawning child `FolderNeuron` & `MediaAssetNeuron` instances |
| *(Single item view)* | `MediaAssetNeuron` | Single-asset live watcher (processing status, signed URL renewal, delete awareness) |
| `SeasonsCombinatorBridge` | `MediaCombinatorBridge` | Registers `/media-hub/library`, `/media-hub/ingest`, `/media-hub/delete`, `/media-hub/view` composite neurons in `@lemon/core-combinator-sdk` |
| `CodingMemoryAxon` | `MediaLifecycleAxon` | High-level facade uniting addition, deletion, viewing, and folder streams |

## Dedicated Media Action Flows

- **Addition (`MediaIngestFlow`)**: `ingest()` / `connectSource()` with `dedupKey` coalescing, bounded concurrency, optional `waitForReady` via `MEDIA_READY` SSE impulse, and Core Combinator `BATCH`/`MUTEX`/`CIRCUIT_BREAKER`/`CHRONICLE` integration.
- **Deletion (`MediaDeleteFlow`)**: `remove()` / `removeMany()` / `connectSource()` serialized via mutex-like RxJS `concatMap`, triggers server cleanup + `MEDIA_DELETED` SSE eviction.
- **Viewing (`MediaViewFlow`)**: `resolveView()` / `watchAsset$()` with ACL-aware URL resolution (`PUBLIC` direct vs cached/auto-renewed HMAC signed URLs invalidated on `MEDIA_ACCESS_CHANGED`), plus buffered usage telemetry batching (`bufferTime` -> `POST /api/assets/:id/usage`).
