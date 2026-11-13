# Agent Rule: Application Registration & Port Shield Standard

## Purpose
To prevent port collisions, port hijacking, and zombie processes across concurrent autonomous agent sessions, all agents running in this repository must comply with the Port Shield protocol.

---

## The Rule

### 1. Core Infrastructure Anchor Exemption (Zero-Deadlock Principle)
* **The Root Stack**: PostgreSQL (`:5433`), Lemon Backend API Gateway (`:3000`), and Angular Web Frontend (`:4201`) are **Root Infrastructure Anchors**.
* **No Chicken-and-Egg Loop**: The Backend API (`:3000`) is the **host of Port Shield itself**. It does NOT make HTTP calls to Port Shield to start up. Anchor services are pre-allocated and immune to dynamic registration.
* If an agent needs to start the core system, it starts PostgreSQL and `npm run start:api` directly without prior HTTP registration.

### 2. Mandatory Pre-Registration for Dynamic Sub-Processes (Ports 4301+)
* Before launching any **dynamic agent server**, preview process, container, HTTP mock, or background listener, the agent **MUST** register the application with the Lemon Port Shield via:
  - **MCP Tool**: `lemon_register_app` with `{ appName, environment: "dev", networkMode: "local" }`
  - **OR REST API**: `POST http://localhost:3000/api/registry/register`
* **Strict Port Binding**: The agent **MUST bind strictly** to the `allocatedPort` returned by the registrar (dynamic pool `4301+`). Never bind to arbitrary or hardcoded ports.

### 3. Lease Token Ownership
* The agent retains the issued `leaseToken` and `instanceId`.
* The instance is tagged with its environment (`dev`, `staging`, `production`) and network mode (`local`, `tailscale-lan`, `tailscale-funnel`).

### 4. Heartbeat & Circuit Breaker
* Lemon Port Shield monitors registered instances. If an instance fails 5 consecutive health checks, it is automatically evicted, its port is reclaimed, and an eviction event is logged to the History Neuron (`workspace.core.registry.history`).
* For long-running agents, issue periodic heartbeats via `lemon_heartbeat` or `POST /api/registry/heartbeat`.

### 5. Clean Decommission on Exit
* When the agent finishes its task, testing, or review, it **MUST** call `lemon_release_app` (or `POST /api/registry/release`) to cleanly free the allocated port and terminate the lease.
