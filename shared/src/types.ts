export type RoomCode = string;
export type PlayerId = string;
export type SeatId = string;
export type CardId = string;
export type PlayerSession = string;

export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: CardId;
  suit: Suit;
  rank: Rank;
}

export interface PlayerSummary {
  id: PlayerId;
  seatId: SeatId;
  displayName: string;
  isHost: boolean;
  isConnected: boolean;
  handCount: number;
}

export interface PublicRoomSnapshot {
  roomCode: RoomCode;
  roomVersion: number;
  hostPlayerId: PlayerId;
  deckCount: number;
  discardCount: number;
  discardTopCard: Card | null;
  sharedPlayArea: Card[];
  players: PlayerSummary[];
}

export interface ViewerPrivateState {
  playerId: PlayerId;
  seatId: SeatId;
  playerSession: PlayerSession;
  hand: Card[];
}

export interface BootstrapResponse {
  publicSnapshot: PublicRoomSnapshot;
  viewer: ViewerPrivateState;
}

export type GameAction =
  | { type: "shuffle_deck" }
  | { type: "deal_cards"; count: number }
  | { type: "play_card"; cardId: CardId }
  | { type: "move_to_discard"; cardId: CardId };

export type GameActionType = GameAction["type"];

export interface RoomJoinEvent {
  roomCode: RoomCode;
  playerSession: PlayerSession;
}

export interface GameActionEvent {
  roomCode: RoomCode;
  playerSession: PlayerSession;
  action: GameAction;
}

export interface RoomSnapshotEvent {
  publicSnapshot: PublicRoomSnapshot;
  viewer?: ViewerPrivateState;
}

export interface GameErrorEvent {
  action: GameActionType;
  reason:
    | "not_found"
    | "not_host"
    | "invalid_count"
    | "insufficient_cards"
    | "card_not_in_hand"
    | "card_not_in_play_area"
    | "player_not_in_room"
    | "invalid_session";
}

export interface RoomPolicy {
  maxPlayers: number;
  idleRoomTtlMs: number;
  hostReconnectGraceMs: number;
}

export interface ApplyActionSuccess {
  ok: true;
  action: GameActionType;
  publicSnapshot: PublicRoomSnapshot;
}

export interface ApplyActionError {
  ok: false;
  action: GameActionType;
  reason:
    | "not_found"
    | "not_host"
    | "invalid_count"
    | "insufficient_cards"
    | "card_not_in_hand"
    | "card_not_in_play_area"
    | "player_not_in_room";
}

export type ApplyActionResult = ApplyActionSuccess | ApplyActionError;
