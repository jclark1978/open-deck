# Open Deck MVP Plan

## Summary

Build a `pnpm` workspace with three packages: `frontend`, `backend`, and `shared`. The MVP is a mobile-responsive multiplayer card table where players join by room code and display name, a host controls deck-level actions, and the backend is authoritative for all shared game state via REST bootstrap plus Socket.IO realtime events. Initial storage is in-memory only, with best-effort reconnect while the room process is alive.

The plan should stay intentionally simple for MVP, but the package boundaries and contracts should be clean enough that future parallel sub-agents can work independently on frontend, backend, shared contracts, testing, and CI without stepping on each other.

## Key Implementation Changes

### System Shape

- `frontend`: React app for lobby and tabletop flows.
- `backend`: Node/TypeScript API plus Socket.IO server.
- `shared`: room, player, card, and event types shared by both apps.
- Keep the codebase intentionally modular now so later sub-agents can own one package or one vertical slice without overlap.

### Frontend

- Build two primary screens: `Lobby` and `Room/Tabletop`.
- Lobby supports create room, join room by code, and entering a display name.
- Tabletop shows:
  - shared deck count
  - shared discard pile
  - single shared play area
  - player hand for the current player
  - player list with host marker and connection status if available
- Host-only controls for shuffle and deal.
- Any player can play a card from their hand to the shared play area and move eligible cards to discard if the server allows it.
- Use server-driven state; keep local client state limited to connection, pending actions, and transient UI concerns.
- Store a lightweight `playerSession` token client-side and use it for reconnect and room bootstrap.
- Treat room state as two views:
  - public room state safe to broadcast to everyone in the room
  - private viewer state containing only the current player's hidden hand and session-scoped metadata

### Backend

- Expose REST endpoints for:
  - `POST /rooms` to create a room and host seat
  - `POST /rooms/:roomCode/join` to join a room or reclaim a seat using a valid prior session token
  - `GET /rooms/:roomCode` to fetch the latest room snapshot
- Add a room service that owns all in-memory state and core transitions:
  - room creation and expiry policy
  - player join/leave/reconnect
  - host transfer rules when the current host disconnects or leaves
  - deck creation and shuffle
  - deal cards to active players
  - play card to shared area
  - move card to discard
- Use Socket.IO rooms keyed by `roomCode`.
- Client sends action intents; server validates actor permissions, applies state changes, increments a room version, and broadcasts authoritative updates.
- Best-effort reconnect is based on the generated `playerSession` token. Display name is not an identity mechanism and must never be used by itself to reclaim a seat.
- The backend is the only place where card location, ownership, visibility, and action permissions are decided.
- Prefer a snapshot-first realtime model for MVP:
  - client sends intent
  - server validates and mutates state
  - server emits the latest authoritative room snapshot
  - server includes private viewer data only for the relevant client session
- Keep socket handlers thin and push game rules into the room service so backend-focused sub-agents can work in one clear layer.

### Shared Contracts

Define shared types up front and treat them as the public contract between frontend and backend:

- `RoomCode`, `PlayerId`, `SeatId`, `CardId`
- `Suit`, `Rank`, `Card`, `Deck`, `Pile`
- `PlayerSummary`, `PlayerHand`
- `PublicRoomSnapshot`, `ViewerPrivateState`, `BootstrapResponse`
- `GameAction` union:
  - `shuffle_deck`
  - `deal_cards`
  - `play_card`
  - `move_to_discard`
- `ServerEvent` union:
  - `room:snapshot`
  - `game:error`
- `PublicRoomSnapshot` should include enough data for shared rendering:
  - room code
  - room version
  - host player id
  - connected players
  - deck count
  - discard pile top and count
  - shared play area cards
  - per-player public metadata
- `ViewerPrivateState` should include only session-scoped private data:
  - player id
  - seat id if used
  - player hand
  - reconnect token/session metadata needed by the client
- `BootstrapResponse` should return both:
  - `publicSnapshot`
  - `viewer`
- Preserve a strict separation between broadcast-safe state and hidden player state to reduce accidental leakage and simplify testing.

### State Invariants

- A card can exist in exactly one zone at a time:
  - deck
  - one player's hand
  - shared play area
  - discard pile
- Player hands are private to that player session.
- Shared play area and discard pile are public to all players in the room.
- Every state-changing action must be validated against:
  - actor identity
  - actor permissions
  - card ownership
  - current room state
- Invalid actions must not mutate room version or any card location.

### Room Lifecycle Rules

- Room codes should be short and human-friendly.
- Initial MVP should define an explicit max player count for simplicity.
- Rooms exist only in memory for MVP.
- Rooms should expire after a defined idle timeout.
- Reconnect is supported only while the room still exists in memory and the player still has a valid `playerSession`.
- If the host disconnects temporarily, keep host ownership for a reconnect grace period.
- If the host leaves permanently or misses the reconnect grace window, transfer host to the longest-present connected player.
- If all players leave and the idle timeout expires, delete the room.

### Gameplay Defaults

- MVP uses one standard 52-card deck.
- The room engine should be written so multiple decks can be added later without redesign, but multi-deck support is out of MVP scope.
- Dealing requires an explicit card count supplied by the host action.
- Server validates deal count against active players and remaining deck size.
- Dealing behavior for players who already hold cards must be explicit:
  - default MVP behavior: deal additional cards to each active player
- Turn order, scoring, rule enforcement, and game-specific restrictions remain out of scope.

### Delivery Slices

Implement in this order so each slice is independently reviewable:

1. Workspace setup, scripts, shared types, and CI baseline.
2. In-memory room engine with unit tests.
3. REST room creation/join/snapshot flow.
4. Socket.IO connection, room subscription, and authoritative action handling.
5. Lobby UI and room bootstrap.
6. Tabletop UI with live state rendering.
7. Host controls and player card-play actions.
8. Reconnect polish and basic error handling.
9. Lightweight documentation updates for agent/task ownership boundaries.

## Public APIs / Interfaces / Types

- REST:
  - `POST /rooms`
    - request: `{ displayName: string }`
    - response: `{ roomCode: string, playerSession: string, playerId: string, publicSnapshot: PublicRoomSnapshot, viewer: ViewerPrivateState }`
  - `POST /rooms/:roomCode/join`
    - request: `{ displayName: string, playerSession?: string }`
    - response: same shape as create
  - `GET /rooms/:roomCode`
    - request may include session context
    - response: `{ publicSnapshot: PublicRoomSnapshot, viewer?: ViewerPrivateState }`
- Socket.IO client events:
  - `room:join`
  - `game:action`
- Socket.IO server events:
  - `room:snapshot`
  - `game:error`
- Private player identity uses a lightweight generated `playerSession` token returned on create/join and stored client-side for best-effort reconnect. This is not a full auth system.

## Test Plan

- Unit tests for room engine:
  - room creation initializes valid deck and host
  - join adds players and rejects duplicate invalid joins
  - reconnect with valid room and session reclaims seat
  - reconnect with matching display name but wrong session is rejected
  - shuffle changes deck order while preserving card set
  - deal removes cards from deck and assigns correct hand counts
  - host-only actions reject non-host callers
  - play card removes from hand and adds to shared play area
  - discard move updates the correct piles
  - card cannot exist in more than one zone
  - invalid actions do not increment room version
  - host transfer follows the room lifecycle rules
- Integration tests for backend:
  - create room returns snapshot and session token
  - join room returns updated snapshot
  - socket client receives authoritative updates after valid action
  - invalid actions return rejection and do not mutate version
  - reconnect client receives current snapshot for reclaimed seat
  - public snapshot never includes another player's private hand
- Frontend acceptance checks:
  - create and join room from mobile-width and desktop-width layouts
  - room state updates across two browser clients
  - host controls appear only for host
  - player hand only shows private cards for the active client
- CI baseline:
  - install
  - typecheck
  - lint
  - test
  - build frontend and backend

## Assumptions And Defaults

- React frontend, Node/TypeScript backend, `pnpm` workspace.
- Socket.IO is the realtime transport.
- Host-only deck controls in MVP.
- Join flow is room code plus display name, no accounts.
- Single shared play area, no per-player table zones.
- Best-effort reconnect only while room state exists in memory.
- One standard 52-card deck for the first pass; room engine should be written so multiple decks can be added later without redesign.
- No durable database in MVP.
- No game-specific rules, turn enforcement, scoring, or moderation beyond host control.
- No advanced animation or freeform drag placement in MVP.
- Plan package and file boundaries so future parallel sub-agents can split work across:
  - frontend UI/state integration
  - backend room engine and API/realtime handlers
  - shared contracts
  - tests
  - CI and developer tooling
- Favor stable interfaces and small vertical slices over premature abstraction.

## Parallel-Agent Planning Notes

- Future sub-agent work is a good design constraint as long as it does not add needless complexity to the MVP.
- The safest way to prepare for that future is:
  - keep `frontend`, `backend`, and `shared` clearly separated
  - define shared contracts early and change them intentionally
  - keep socket transport logic separate from room rules
  - keep tests near the layers they protect
  - prefer small reviewable slices that can become separate task assignments later
- Do not design an elaborate agent orchestration system into the product itself. For now, just keep ownership boundaries clear enough that parallel contributors can work without collisions.
