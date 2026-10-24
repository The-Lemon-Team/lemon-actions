# Lemon Actions API

NestJS 10 + Prisma 5 + PostgreSQL 15 (`ltree`). Global prefix `/api`, port 3000, CORS for `http://localhost:4200`.

## Run

```bash
# with Docker (from repo root): api + postgres
docker compose up --build

# locally
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy     # needs a running PostgreSQL 15 (CREATE EXTENSION ltree)
npx prisma db seed            # mock data from the prototype
npm run start:dev
```

Migrations are hand-written in `prisma/migrations` (ltree extension + GIST index on `folders.path`).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{status, db}` |
| GET | `/api/folders` | flat list ordered by path |
| GET | `/api/folders/:id` | |
| GET | `/api/folders/:id/subtree` | folder + descendants (`path <@`) |
| POST | `/api/folders` | `{name, parentId?}`; path = parent.path + sanitized label (`[a-z0-9_]`, de-duplicated with `_2`…) |
| PATCH | `/api/folders/:id` | `{name?, parentId?}`; changing `parentId` moves the subtree (single transaction); `null` = root. Rename does not change path |
| DELETE | `/api/folders/:id` | 409 if it has sub-folders; its flows get `folderId = null` |
| GET | `/api/flows` | filters: `folderId`, `tag` (name, `#` optional), `type`, `status`, `q` (name/description) |
| GET | `/api/flows/metrics` | `{registered, executing, paused, standby}` (executing = ACTIVE+PROCESSING) |
| GET/POST | `/api/flows`, `/api/flows/:id` | POST body: `name, type, description?, isExclusive?, folderId?, tags?: string[], config?, orchestratorRules?` |
| PATCH | `/api/flows/:id` | same fields, all optional; `tags` replaces the set |
| PATCH | `/api/flows/:id/status` | `{status}` — see below |
| DELETE | `/api/flows/:id` | |
| GET | `/api/tags` | `[{id,name,colorHex?,flowCount}]` |
| POST | `/api/events` | `{actionId, eventType, payload}` |
| GET | `/api/events?actionId=` | newest first |

### Status changes, sessions and mutex rule
- Entering ACTIVE/PROCESSING opens a `flow_sessions` row (if none open); entering INACTIVE/PAUSED closes it (`closed_by = 'user'`).
- Exclusivity: if an `isExclusive` flow is activated while another exclusive flow **in the same folder** is running, the default is `409 Conflict`. With `orchestratorRules: {"onConflict": "pause"}` the others are set to PAUSED and their sessions closed (`closed_by = 'flow:<id>'`).

### Flow-type strategy (OCP)
`src/flows/handlers/flow-type.handler.ts` defines `FlowTypeHandler`; one per `FlowType` (config validation, e.g. FSM config). Add a handler to `DEFAULT_FLOW_TYPE_HANDLERS` for a new type — no service changes.

### Event payloads
`eventType` → payload: `STATE_CHANGE {from?, to}` (also updates `actions.current_state`), `TIMER_TICK {elapsedMs}`, `COUNTER_INCREMENT {delta}`, `SLA_BREACH {thresholdMs, elapsedMs}`, `NOTE {text}`. `active_flow_session_ids` is filled with open sessions of flows the action's card subscribes to whose status equals `required_status`. Extend in `src/events/event-payload.validators.ts`.
