import type {
  ApplyActionResult,
  BootstrapResponse,
  Card,
  CardId,
  PlayerId,
  PlayerSession,
  PublicRoomSnapshot,
  Rank,
  RoomCode,
  RoomPolicy,
  SeatId,
  Suit,
  TableCard,
  ViewerPrivateState
} from "@open-deck/shared";

interface RoomPlayer {
  id: PlayerId;
  seatId: SeatId;
  displayName: string;
  playerSession: PlayerSession;
  hand: Card[];
  isConnected: boolean;
  joinedAt: number;
  disconnectedAt: number | null;
}

interface RoomState {
  roomCode: RoomCode;
  roomVersion: number;
  createdAt: number;
  lastActiveAt: number;
  hostPlayerId: PlayerId;
  nextSeatNumber: number;
  players: RoomPlayer[];
  deck: Card[];
  discardPile: Card[];
  sharedPlayArea: TableCard[];
}

interface CreateRoomInput {
  displayName: string;
  now?: number;
}

interface JoinRoomInput {
  roomCode: RoomCode;
  displayName: string;
  playerSession?: PlayerSession;
  now?: number;
}

interface DisconnectPlayerInput {
  roomCode: RoomCode;
  playerId: PlayerId;
  now?: number;
}

interface RoomActionInput {
  roomCode: RoomCode;
  actorId: PlayerId;
  now?: number;
}

interface DealCardsInput extends RoomActionInput {
  count: number;
}

interface DrawCardInput extends RoomActionInput {
  source: "draw" | "discard";
}

interface CardActionInput extends RoomActionInput {
  cardId: CardId;
}

interface PositionedCardActionInput extends CardActionInput {
  position: {
    x: number;
    y: number;
  };
}

type IdFactory = () => string;
type RandomSource = () => number;

const DEFAULT_ROOM_POLICY: RoomPolicy = {
  maxPlayers: 6,
  idleRoomTtlMs: 30 * 60 * 1000,
  hostReconnectGraceMs: 60 * 1000
};

const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export class RoomService {
  private readonly rooms = new Map<RoomCode, RoomState>();

  constructor(
    private readonly policy: RoomPolicy = DEFAULT_ROOM_POLICY,
    private readonly createId: IdFactory = () => crypto.randomUUID(),
    private readonly random: RandomSource = Math.random
  ) {}

  createRoom(input: CreateRoomInput): BootstrapResponse {
    const now = input.now ?? Date.now();
    const player = this.createPlayer(input.displayName, now);
    const roomCode = this.generateRoomCode();
    const room: RoomState = {
      roomCode,
      roomVersion: 0,
      createdAt: now,
      lastActiveAt: now,
      hostPlayerId: player.id,
      nextSeatNumber: 2,
      players: [player],
      deck: createDeck(),
      discardPile: [],
      sharedPlayArea: []
    };

    this.rooms.set(roomCode, room);

    return {
      publicSnapshot: toPublicSnapshot(room),
      viewer: toViewerPrivateState(player)
    };
  }

  joinRoom(input: JoinRoomInput): BootstrapResponse | null {
    const room = this.rooms.get(input.roomCode);
    const now = input.now ?? Date.now();

    if (!room) {
      return null;
    }

    room.lastActiveAt = now;

    if (input.playerSession) {
      const existingPlayer = room.players.find(
        (player) => player.playerSession === input.playerSession
      );

      if (existingPlayer) {
        existingPlayer.displayName = input.displayName;
        existingPlayer.isConnected = true;
        existingPlayer.disconnectedAt = null;

        return {
          publicSnapshot: toPublicSnapshot(room),
          viewer: toViewerPrivateState(existingPlayer)
        };
      }
    }

    if (room.players.length >= this.policy.maxPlayers) {
      return null;
    }

    const newPlayer = this.createPlayer(input.displayName, now, room.nextSeatNumber);
    room.nextSeatNumber += 1;
    room.players.push(newPlayer);

    return {
      publicSnapshot: toPublicSnapshot(room),
      viewer: toViewerPrivateState(newPlayer)
    };
  }

  getPublicSnapshot(roomCode: RoomCode): PublicRoomSnapshot | null {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return null;
    }

    return toPublicSnapshot(room);
  }

  getViewerState(
    roomCode: RoomCode,
    playerSession: PlayerSession
  ): ViewerPrivateState | null {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return null;
    }

    const player = room.players.find(
      (candidate) => candidate.playerSession === playerSession
    );

    if (!player) {
      return null;
    }

    return toViewerPrivateState(player);
  }

  getViewerStateByPlayerId(
    roomCode: RoomCode,
    playerId: PlayerId
  ): ViewerPrivateState | null {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return null;
    }

    const player = room.players.find((candidate) => candidate.id === playerId);

    if (!player) {
      return null;
    }

    return toViewerPrivateState(player);
  }

  disconnectPlayer(input: DisconnectPlayerInput): PublicRoomSnapshot | null {
    const room = this.rooms.get(input.roomCode);
    const now = input.now ?? Date.now();

    if (!room) {
      return null;
    }

    const player = room.players.find((candidate) => candidate.id === input.playerId);

    if (!player) {
      return null;
    }

    player.isConnected = false;
    player.disconnectedAt ??= now;
    room.lastActiveAt = now;
    this.transferHostIfNeeded(room, now);

    return toPublicSnapshot(room);
  }

  removePlayer(input: DisconnectPlayerInput): PublicRoomSnapshot | null {
    const room = this.rooms.get(input.roomCode);
    const now = input.now ?? Date.now();

    if (!room) {
      return null;
    }

    const playerIndex = room.players.findIndex(
      (candidate) => candidate.id === input.playerId
    );

    if (playerIndex === -1) {
      return null;
    }

    const [player] = room.players.splice(playerIndex, 1);
    room.lastActiveAt = now;

    room.discardPile.push(...player.hand);
    player.hand = [];

    if (room.hostPlayerId === player.id) {
      this.transferHostIfNeeded(room, now, true);
    }

    if (room.players.length === 0) {
      this.rooms.delete(room.roomCode);
      return null;
    }

    return toPublicSnapshot(room);
  }

  shuffleDeck(input: RoomActionInput): ApplyActionResult {
    const room = this.rooms.get(input.roomCode);

    if (!room) {
      return rejectAction("shuffle_deck", "not_found");
    }

    const actor = room.players.find((player) => player.id === input.actorId);

    if (!actor) {
      return rejectAction("shuffle_deck", "player_not_in_room");
    }

    if (room.hostPlayerId !== input.actorId) {
      return rejectAction("shuffle_deck", "not_host");
    }

    room.deck = shuffleCards(room.deck, this.random);
    return commitAction(room, input.now, "shuffle_deck");
  }

  resetTable(input: RoomActionInput): ApplyActionResult {
    const room = this.rooms.get(input.roomCode);

    if (!room) {
      return rejectAction("reset_table", "not_found");
    }

    const actor = room.players.find((player) => player.id === input.actorId);

    if (!actor) {
      return rejectAction("reset_table", "player_not_in_room");
    }

    if (room.hostPlayerId !== input.actorId) {
      return rejectAction("reset_table", "not_host");
    }

    const cardsToReturn = [
      ...room.deck,
      ...room.discardPile,
      ...room.sharedPlayArea,
      ...room.players.flatMap((player) => player.hand)
    ].map(({ id, rank, suit }) => ({
      id,
      rank,
      suit
    }));

    room.deck = shuffleCards(cardsToReturn, this.random);
    room.discardPile = [];
    room.sharedPlayArea = [];

    for (const player of room.players) {
      player.hand = [];
    }

    return commitAction(room, input.now, "reset_table");
  }

  dealCards(input: DealCardsInput): ApplyActionResult {
    const room = this.rooms.get(input.roomCode);

    if (!room) {
      return rejectAction("deal_cards", "not_found");
    }

    const actor = room.players.find((player) => player.id === input.actorId);

    if (!actor) {
      return rejectAction("deal_cards", "player_not_in_room");
    }

    if (room.hostPlayerId !== input.actorId) {
      return rejectAction("deal_cards", "not_host");
    }

    if (!Number.isInteger(input.count) || input.count <= 0) {
      return rejectAction("deal_cards", "invalid_count");
    }

    // The tabletop UI no longer exposes manual shuffle, so dealing reshuffles
    // the remaining deck before cards are distributed.
    room.deck = shuffleCards(room.deck, this.random);

    const activePlayers = room.players.filter((player) => player.isConnected);
    const neededCards = activePlayers.length * input.count;

    if (room.deck.length < neededCards) {
      return rejectAction("deal_cards", "insufficient_cards");
    }

    for (let round = 0; round < input.count; round += 1) {
      for (const player of activePlayers) {
        const dealtCard = room.deck.shift();

        if (!dealtCard) {
          return rejectAction("deal_cards", "insufficient_cards");
        }

        player.hand.push(dealtCard);
      }
    }

    return commitAction(room, input.now, "deal_cards");
  }

  drawCard(input: DrawCardInput): ApplyActionResult {
    const room = this.rooms.get(input.roomCode);

    if (!room) {
      return rejectAction("draw_card", "not_found");
    }

    const actor = room.players.find((player) => player.id === input.actorId);

    if (!actor) {
      return rejectAction("draw_card", "player_not_in_room");
    }

    const drawnCard =
      input.source === "discard" ? room.discardPile.pop() : room.deck.shift();

    if (!drawnCard) {
      return rejectAction("draw_card", "insufficient_cards");
    }

    actor.hand.push(drawnCard);
    return commitAction(room, input.now, "draw_card");
  }

  playCard(input: PositionedCardActionInput): ApplyActionResult {
    const room = this.rooms.get(input.roomCode);

    if (!room) {
      return rejectAction("play_card", "not_found");
    }

    const actor = room.players.find((player) => player.id === input.actorId);

    if (!actor) {
      return rejectAction("play_card", "player_not_in_room");
    }

    const cardIndex = actor.hand.findIndex((card) => card.id === input.cardId);

    if (cardIndex === -1) {
      return rejectAction("play_card", "card_not_in_hand");
    }

    const [card] = actor.hand.splice(cardIndex, 1);
    room.sharedPlayArea.push({
      ...card,
      ...toTablePosition(input.position, getNextTableZIndex(room))
    });

    return commitAction(room, input.now, "play_card");
  }

  moveTableCard(input: PositionedCardActionInput): ApplyActionResult {
    const room = this.rooms.get(input.roomCode);

    if (!room) {
      return rejectAction("move_table_card", "not_found");
    }

    const actor = room.players.find((player) => player.id === input.actorId);

    if (!actor) {
      return rejectAction("move_table_card", "player_not_in_room");
    }

    const tableCard = room.sharedPlayArea.find((card) => card.id === input.cardId);

    if (!tableCard) {
      return rejectAction("move_table_card", "card_not_in_play_area");
    }

    Object.assign(tableCard, toTablePosition(input.position, getNextTableZIndex(room)));

    return commitAction(room, input.now, "move_table_card");
  }

  moveToDiscard(input: CardActionInput): ApplyActionResult {
    const room = this.rooms.get(input.roomCode);

    if (!room) {
      return rejectAction("move_to_discard", "not_found");
    }

    const actor = room.players.find((player) => player.id === input.actorId);

    if (!actor) {
      return rejectAction("move_to_discard", "player_not_in_room");
    }

    const handCardIndex = actor.hand.findIndex((card) => card.id === input.cardId);

    if (handCardIndex !== -1) {
      const [card] = actor.hand.splice(handCardIndex, 1);
      room.discardPile.push(card);
      return commitAction(room, input.now, "move_to_discard");
    }

    const cardIndex = room.sharedPlayArea.findIndex((card) => card.id === input.cardId);

    if (cardIndex === -1) {
      return rejectAction("move_to_discard", "card_not_in_play_area");
    }

    const [card] = room.sharedPlayArea.splice(cardIndex, 1);
    room.discardPile.push(card);

    return commitAction(room, input.now, "move_to_discard");
  }

  cleanupExpiredRooms(now = Date.now()): RoomCode[] {
    const expiredRoomCodes: RoomCode[] = [];

    for (const room of this.rooms.values()) {
      if (now - room.lastActiveAt > this.policy.idleRoomTtlMs) {
        expiredRoomCodes.push(room.roomCode);
      }
    }

    for (const roomCode of expiredRoomCodes) {
      this.rooms.delete(roomCode);
    }

    return expiredRoomCodes;
  }

  getRoomStateForTest(roomCode: RoomCode): Readonly<RoomState> | null {
    return this.rooms.get(roomCode) ?? null;
  }

  private createPlayer(
    displayName: string,
    now: number,
    seatNumber = 1
  ): RoomPlayer {
    return {
      id: `player_${this.createId()}`,
      seatId: `seat_${seatNumber}`,
      displayName,
      playerSession: `session_${this.createId()}`,
      hand: [],
      isConnected: true,
      joinedAt: now,
      disconnectedAt: null
    };
  }

  private generateRoomCode(): RoomCode {
    let roomCode = "";

    while (!roomCode || this.rooms.has(roomCode)) {
      roomCode = this.createId().replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    }

    return roomCode;
  }

  private transferHostIfNeeded(
    room: RoomState,
    now: number,
    forceTransfer = false
  ): void {
    const currentHost = room.players.find((player) => player.id === room.hostPlayerId);

    if (!currentHost) {
      const nextHost = pickNextHost(room.players);

      if (nextHost) {
        room.hostPlayerId = nextHost.id;
      }

      return;
    }

    const isWithinGracePeriod =
      currentHost.isConnected ||
      (currentHost.disconnectedAt !== null &&
        now - currentHost.disconnectedAt <= this.policy.hostReconnectGraceMs);

    if (!forceTransfer && isWithinGracePeriod) {
      return;
    }

    const nextHost = pickNextHost(
      room.players.filter((player) => player.id !== currentHost.id)
    );

    if (nextHost) {
      room.hostPlayerId = nextHost.id;
    }
  }
}

function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${rank}_of_${suit}`,
      suit,
      rank
    }))
  );
}

function shuffleCards(cards: Card[], random: RandomSource): Card[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function toPublicSnapshot(room: RoomState): PublicRoomSnapshot {
  return {
    roomCode: room.roomCode,
    roomVersion: room.roomVersion,
    hostPlayerId: room.hostPlayerId,
    deckCount: room.deck.length,
    discardCount: room.discardPile.length,
    discardTopCard: room.discardPile.at(-1) ?? null,
    sharedPlayArea: room.sharedPlayArea.map((card) => ({ ...card })),
    players: room.players.map((player) => ({
      id: player.id,
      seatId: player.seatId,
      displayName: player.displayName,
      isHost: player.id === room.hostPlayerId,
      isConnected: player.isConnected,
      handCount: player.hand.length
    }))
  };
}

function toViewerPrivateState(player: RoomPlayer): ViewerPrivateState {
  return {
    playerId: player.id,
    seatId: player.seatId,
    playerSession: player.playerSession,
    hand: [...player.hand]
  };
}

function commitAction(
  room: RoomState,
  now: number | undefined,
  action: ApplyActionResult["action"]
): ApplyActionResult {
  room.roomVersion += 1;
  room.lastActiveAt = now ?? Date.now();

  return {
    ok: true,
    action,
    publicSnapshot: toPublicSnapshot(room)
  };
}

function rejectAction(
  action: ApplyActionResult["action"],
  reason: Exclude<ApplyActionResult, { ok: true }>["reason"]
): ApplyActionResult {
  return {
    ok: false,
    action,
    reason
  };
}

function pickNextHost(players: RoomPlayer[]): RoomPlayer | null {
  const connectedPlayers = players.filter((player) => player.isConnected);
  const pool = connectedPlayers.length > 0 ? connectedPlayers : players;

  if (pool.length === 0) {
    return null;
  }

  return [...pool].sort((left, right) => left.joinedAt - right.joinedAt)[0];
}

function getNextTableZIndex(room: RoomState) {
  return room.sharedPlayArea.reduce((highest, card) => Math.max(highest, card.zIndex), 0) + 1;
}

function toTablePosition(
  position: { x: number; y: number },
  zIndex: number
) {
  return {
    x: clamp(position.x, 0.08, 0.92),
    y: clamp(position.y, 0.1, 0.9),
    zIndex
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
