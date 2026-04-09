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

## AI Agent Instructions

This project uses enforced development policies located in [`agent/AGENT.md`](./agent/AGENT.md).

All contributors and AI agents must follow these guidelines.
