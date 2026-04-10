# Open Deck

Open Deck is a web-based multiplayer card table. The MVP focuses on a shared deck, room-based play, and real-time synchronization without enforcing game-specific rules.

## Workspace

This repository is organized as a `pnpm` workspace:

- `frontend`: React client for lobby and tabletop flows
- `backend`: Node/TypeScript service for API and realtime orchestration
- `shared`: shared contracts used by both apps

## Scripts

From the repository root:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Run Locally

Use the helper scripts from the repository root:

```bash
./start_server.sh
./stop_server.sh
```

`./start_server.sh` will:

- install dependencies if needed
- run `typecheck`, `lint`, `test`, and `build`
- start the backend on `http://127.0.0.1:3001`
- start the frontend on `http://127.0.0.1:5173`
- write logs to `.run/backend.log` and `.run/frontend.log`

`./stop_server.sh` will stop the backend and frontend started by the helper script.

## AI Agent Instructions

This project uses enforced development policies located in [`agent/AGENT.md`](./agent/AGENT.md).

All contributors and AI agents must follow these guidelines.
