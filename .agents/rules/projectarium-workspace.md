# Lemon Projectarium Workspace & Unified Feeds Rule

## Single Umbrella Principle (No Per-Project Feeds or Streams)
- **Do NOT create separate Lemon Seasons feeds or streams for individual projects** (such as `lemon-actions`, `lemon-watchers`, `lemon-seasons`, `sportdrop`, `lemon-party`, etc.) when tracking project work, architecture decisions, tasks, or changes.
- All project-management activity, cross-project changes, architectural decisions, roadmaps, and new project-management features across all repositories run under the unified **Lemon Projectarium** umbrella.

## Canonical Namespace in Lemon Seasons
All Projectarium content lives inside the private **`projectarium`** stream (**Projectarium Workspace**, `http://192.168.1.100:5175/projectarium`), organized by functional feeds rather than per-project feeds:
- `projectarium-projects` — **Projectarium Projects**: dedicated feed for project-level overviews, cross-project changes, milestones, and project-management capabilities.
- `projectarium-todos` — **Projectarium Todo Lists**: dual-level checklists (`PROJECT` and `APP` scopes).
- `projectarium-notes` — **Projectarium Notes & Stories**: architectural notes, decisions, and stories.
- `projectarium-chronicle` — **Projectarium Chronicle**: stand, deployment, and port-shield event timelines.

## Project Identification
- Distinguish individual projects inside `Projectarium Workspace` via tags/hashtags and metadata (`stand:<slug>`, `project:<slug>`, e.g. `stand:actions`, `stand:lemon-watchers`, `stand:seasons`, `stand:sportdrop`, `stand:lemon-party`) rather than creating separate feeds or streams.
