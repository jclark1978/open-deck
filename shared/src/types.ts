export type RoomCode = string;
export type PlayerId = string;
export type SeatId = string;
export type CardId = string;

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
  playerSession: string;
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

