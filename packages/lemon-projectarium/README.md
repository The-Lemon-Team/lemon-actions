# Lemon-Projectarium 🍋🛡️

Unified Project Cockpit & Port Shield Stand Orchestrator for the Lemon Ecosystem.

Lemon-Projectarium consolidates distributed projects, dynamic microservices, port allocation (`4320+`), live health checks, reactive dual-level checklists (Project vs. Application), and immutable chronicle logs into an interactive Google Keep-style dashboard.

---

## Key Features

1. **Smart Upsert Handler ("Upsert on First Touch")**:
   - Single handler `POST /api/projectarium/register` that either boots a brand new project stand (assigning a master `projectToken`, workspace neuron, and context) with its first application attached, or binds new services to an existing project.
2. **Port Shield Protection & Zero-Deadlock Anchor Immunity**:
   - Core stack (`PostgreSQL: 5433`, `API: 3000`, `Angular Web: 4201`) are immune from dynamic pre-registration deadlocks.
   - Dynamic agent apps and stand microservices are dynamically assigned collision-free ports starting at `4320+`.
3. **Three Permanent Default Stands**:
   - **Lemon Seasons** (`workspace.seasons`): Calendar app (:5173), Admin CMS (:3002), Seasons Backend (:3001), Feed app (:8081).
   - **Lemon Actions** (`workspace.actions`): Core combinator (:5433), Lemon actions (:4201), Port Shield (:3000), Lemon Watchers (:4301).
   - **Sportdrop** (`workspace.sportdrop`): Dev env (:4310), Lan port (:4311), Media gateway port (:4312), Funnel tunnel (:443), Prod port (:8443).
4. **Dual-Level Reactive Todo Lists**:
   - Track high-level milestones (`scope: 'PROJECT'`) or service-specific operational tasks (`scope: 'APP'`).
5. **Circuit Breaker Failure Simulation**:
   - Simulated heartbeat drop: `>= 2` failures triggers `DEGRADED`, `>= 5` failures triggers automatic `EVICTED` and port reclamation.

---

## Installation & Usage

```bash
npm install @lemon/projectarium
```

```typescript
import { ProjectariumEngine } from '@lemon/projectarium';

const engine = new ProjectariumEngine();

// First touch - registers project & allocates port for the first app
const response = engine.registerOrAttach({
  projectName: 'My Microservice Project',
  appName: 'Worker 1',
  environment: 'dev',
  networkMode: 'local',
});

console.log(response.projectToken); // Master token for subsequent touches
console.log(response.allocatedApp.port); // e.g. 4320
```

---

## Architecture Standards
- Strict Angular 18+ and SOLID compliance.
- Standalone components only.
- native `@if`, `@for`, `inject()`, `ChangeDetectionStrategy.OnPush`.
- Zero `/` in template class bindings.
