> This document defines the product direction. If implementation decisions conflict with this, pause and ask for clarification.

## Initial Concept
I’m building a web-based, mobile-responsive application that acts as a shared, virtual deck of cards. The goal is to recreate the experience of sitting around a table with a physical deck, but in a fully online, multiplayer environment.

Users can create or join a room where they see a shared tabletop and interact with a live deck of cards in real time. The system does not enforce specific game rules. Instead, it provides the core mechanics of a deck of cards, allowing players to define and play any game they choose, including custom or house rules.

The application handles card logistics such as shuffling, dealing a configurable number of cards to each player, managing one or more decks, and optionally supporting shared spaces like a discard pile. All card states and interactions are synchronized across players so that everyone sees the same game state at all times.

The focus is on flexibility, simplicity, and real-time collaboration, making it easy for any group to jump in and play any card game without needing a physical deck.

This should be built to best-practice frontend, backend, and api logic .

## System Scope

This application should follow a standard modern web architecture:

- Frontend: Web-based, mobile-responsive UI
- Backend: API-driven service handling game state and logic
- Real-time communication: Required (e.g., WebSockets or similar)
- Data persistence: Minimal at first (focus on in-memory or simple storage)

The system should prioritize simplicity first, then scale as needed.

## Out of Scope (for now)

- User accounts / authentication
- Payments or monetization
- Complex game rule enforcement
- Advanced animations or 3D rendering

Focus on core multiplayer card mechanics first.

## Core Features (MVP)

- Create / join game room
- Shared deck of cards
- Shuffle deck
- Deal cards to players
- Play cards to shared table
- Optional discard pile
- Real-time synchronization across all players

## Non-Functional Requirements

- Real-time updates must feel instantaneous
- UI must be mobile-friendly
- Code should be modular and maintainable
- System should support multiple simultaneous rooms

## AI Agent Instructions

- Maintain this document as the source of truth for the project
- Update the "Updates" section whenever:
  - Core functionality changes
  - New features are added
  - Architecture decisions are made

Updates should be:
- Clear
- Concise
- Focused on what changed and why

## Updates

- Architecture direction aligned with MVP planning:
  - authoritative Node/TypeScript backend with REST bootstrap plus Socket.IO realtime updates
  - React frontend using server-driven state with minimal client-side game logic
  - strict separation between public room state and private player hand data
- MVP rules clarified:
  - reconnect is based on a generated session token, not display name alone
  - one standard 52-card deck is in scope for MVP, with multi-deck support deferred
  - host transfer, room expiry, and reconnect behavior should be defined explicitly in implementation
- Planning should remain friendly to future parallel sub-agents by keeping frontend, backend, shared contracts, tests, and CI concerns clearly separated without over-engineering the initial build.
- Added a docs-only implementation plan to sequence work into small PR-sized slices and clarify future sub-agent ownership boundaries without changing MVP scope.
- Workspace foundation created:
  - `frontend`, `backend`, and `shared` package boundaries now exist
  - baseline TypeScript, lint, test, build, and CI scaffolding are in place
  - shared contract imports are wired so future slices can build on stable package boundaries
- Shared contracts and room engine created:
  - shared room, player, card, policy, bootstrap, and action result types now exist
  - backend now has an in-memory authoritative room service for create, join, reconnect, disconnect, shuffle, deal, play, discard, and idle cleanup
  - room engine tests cover host permissions, reconnect behavior, host transfer timing, room expiration, invalid actions, and card-zone invariants
- Backend transport layer created:
  - REST endpoints now support room creation, room join, and room bootstrap snapshot fetch
  - Socket.IO now supports room session join and authoritative action-driven snapshot updates
  - backend transport tests cover bootstrap flow and realtime snapshot propagation across multiple clients
- First frontend draft created:
  - frontend now supports create room, join room, session restore, bootstrap fetch, and live room snapshot subscription
  - UI now renders a real create/join form and a read-only room view with players, deck, discard, table, and private hand state
  - action controls are still pending, but the app now has an end-to-end visible draft connected to the real backend
