# Open Deck Implementation Plan

## Goal

Turn the MVP architecture into a sequence of small, reviewable changes that can be handled by one person now and split across future parallel sub-agents later.

This document is intentionally operational:

- what to build first
- what depends on what
- what can be parallelized later
- what each slice should own

## Delivery Principles

- Keep each change scoped to one logical outcome.
- Prefer stable contracts before parallel UI and backend work.
- Do not start parallel work until shared contracts and room rules are clear enough to avoid churn.
- Favor vertical slices that end in something testable.
- Keep MVP simple; parallel-agent readiness should come from clean boundaries, not extra infrastructure.

## Recommended Branch / PR Sequence

Use one feature branch for each slice:

1. `feature/workspace-foundation`
2. `feature/room-engine`
3. `feature/rest-room-flow`
4. `feature/realtime-room-sync`
5. `feature/lobby-ui`
6. `feature/tabletop-ui`
7. `feature/game-actions`
8. `feature/reconnect-polish`
9. `feature/docs-task-boundaries`

Each branch should map to one PR when possible.

## Execution Slices

### Slice 1: Workspace Foundation

Outcome:

- `pnpm` workspace exists
- `frontend`, `backend`, and `shared` packages exist
- TypeScript, linting, formatting, and build scripts are wired
- basic CI validates install, typecheck, lint, test, and build

Owns:

- repo scaffolding
- package boundaries
- root scripts
- CI baseline

Does not own:

- game logic
- UI features
- realtime behavior

Exit criteria:

- repo installs cleanly
- all packages build
- CI can run baseline validation

Future sub-agent owner:

- tooling / CI agent

### Slice 2: Shared Contracts

Outcome:

- shared domain types are defined in one place
- public room state and private viewer state are distinct
- action and event contracts are explicit

Owns:

- identifiers and enums
- room snapshot types
- viewer-private types
- action payload shapes

Does not own:

- business logic implementation
- transport-specific handler behavior

Exit criteria:

- backend and frontend can both import shared contracts
- contract naming is stable enough for downstream work

Future sub-agent owner:

- shared-contracts agent

### Slice 3: Room Engine

Outcome:

- in-memory authoritative room service exists
- room creation, join, reconnect, shuffle, deal, play, and discard transitions work
- state invariants are enforced

Owns:

- room lifecycle rules
- host transfer behavior
- card zone validation
- room versioning

Does not own:

- HTTP routing
- socket transport
- React state

Exit criteria:

- room engine unit tests pass
- invalid actions cannot corrupt state

Future sub-agent owner:

- backend-domain agent

### Slice 4: REST Room Flow

Outcome:

- create room, join room, and fetch room snapshot endpoints work
- bootstrap response returns public snapshot plus viewer-private state

Owns:

- route handlers
- request validation
- bootstrap API contract wiring

Does not own:

- deep room rules
- UI rendering

Exit criteria:

- integration tests cover create, join, and bootstrap behavior

Future sub-agent owner:

- backend-api agent

### Slice 5: Realtime Room Sync

Outcome:

- clients can connect to a room over Socket.IO
- action intents are validated by the backend
- server emits authoritative room snapshots after accepted actions

Owns:

- socket connection setup
- room subscription flow
- event emission and error signaling

Does not own:

- core transition rules beyond room engine calls
- frontend presentation logic

Exit criteria:

- two clients can observe the same room updates in real time

Future sub-agent owner:

- backend-realtime agent

### Slice 6: Lobby UI

Outcome:

- create room and join room flows exist
- display name and session token are handled client-side
- initial room bootstrap works on mobile and desktop widths

Owns:

- form UX
- navigation into room view
- session token persistence

Does not own:

- tabletop action rendering
- backend room logic

Exit criteria:

- user can create or join a room from the browser and land in the room

Future sub-agent owner:

- frontend-lobby agent

### Slice 7: Tabletop UI

Outcome:

- room state renders clearly
- deck count, discard pile, play area, player list, and current hand are visible
- hidden data stays private to the active viewer

Owns:

- room/tabletop layout
- responsive rendering
- server-state presentation

Does not own:

- room mutation rules
- transport internals

Exit criteria:

- two clients see shared state updates correctly
- only the active client sees its own hand

Future sub-agent owner:

- frontend-tabletop agent

### Slice 8: Game Actions

Outcome:

- host can shuffle and deal
- players can play cards
- players can move eligible cards to discard

Owns:

- frontend action triggers
- backend action wiring to room engine
- UX for rejected actions

Does not own:

- new game-specific rules
- animations beyond basic feedback

Exit criteria:

- end-to-end action flow works across multiple clients

Future sub-agent owner:

- full-stack-actions agent

### Slice 9: Reconnect And Resilience

Outcome:

- same session token can reclaim a live seat
- reconnect UX and error states are understandable
- idle room expiration behavior is handled cleanly

Owns:

- reconnect flows
- disconnect/reconnect state handling
- idle-room cleanup behavior

Does not own:

- persistence beyond in-memory scope
- auth systems

Exit criteria:

- reconnect works during the supported room lifetime
- expired or invalid sessions fail safely

Future sub-agent owner:

- resilience agent

### Slice 10: Documentation And Task Boundaries

Outcome:

- docs reflect current architecture and task boundaries
- later contributors can pick up isolated work with low collision risk

Owns:

- docs for structure, contracts, and slice ownership

Exit criteria:

- docs match current implementation reality

Future sub-agent owner:

- docs / coordination agent

## Dependency Order

Strict dependencies:

1. Workspace Foundation
2. Shared Contracts
3. Room Engine
4. REST Room Flow
5. Realtime Room Sync
6. Lobby UI
7. Tabletop UI
8. Game Actions
9. Reconnect And Resilience
10. Documentation And Task Boundaries

## Parallelization Rules For Future Sub-Agents

Safe to parallelize after Slice 2 is stable:

- backend room engine work and frontend shell work can proceed in parallel if both only consume shared contracts

Safe to parallelize after Slice 5 is stable:

- lobby UI and tabletop UI can be split
- backend API cleanup and frontend rendering polish can run separately
- test expansion can run alongside UI refinement

Avoid parallelizing together:

- multiple agents editing shared contract files at the same time
- multiple agents editing the same room engine module
- frontend and backend both redefining action payloads without one owner

## Suggested Sub-Agent Task Types

Keep future sub-agent responsibilities simple and file-oriented:

- `shared-contracts`: owns `shared` types and contract changes
- `backend-domain`: owns room engine and game-state invariants
- `backend-api`: owns REST routes and request/response validation
- `backend-realtime`: owns Socket.IO handlers and connection flow
- `frontend-lobby`: owns create/join UI and bootstrap flow
- `frontend-tabletop`: owns room rendering and responsive layout
- `full-stack-actions`: owns end-to-end user action plumbing once contracts are stable
- `tooling-ci`: owns scripts, lint, test, and GitHub Actions
- `docs-coordination`: owns architecture docs, task maps, and PR summaries

These are planning labels, not required implementation today.

## Definition Of Done For MVP

The MVP is done when:

- a user can create a room
- another user can join by room code
- both users see the same shared table in real time
- host can shuffle and deal
- players can play cards to the table
- discard pile works
- reconnect works while the in-memory room still exists
- core flows are covered by practical tests
- CI validates the main quality gates

## First Build Recommendation

Do not start with multiple sub-agents.

Start with a single implementation pass through:

1. Slice 1: Workspace Foundation
2. Slice 2: Shared Contracts
3. Slice 3: Room Engine

That gives us the stable base needed before parallel work becomes helpful rather than noisy.
