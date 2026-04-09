import { describe, expect, it } from "vitest";

import { RoomService } from "./services/room-service";

function createDeterministicRoomService() {
  let nextId = 0;

  return new RoomService(
    {
      maxPlayers: 6,
      idleRoomTtlMs: 10_000,
      hostReconnectGraceMs: 500
    },
    () => `id${(nextId += 1)}`,
    () => 0
  );
}

describe("RoomService", () => {
  it("creates a room with a valid deck and host", () => {
    const service = createDeterministicRoomService();
    const room = service.createRoom({ displayName: "Host", now: 100 });

    expect(room.publicSnapshot.deckCount).toBe(52);
    expect(room.publicSnapshot.players).toHaveLength(1);
    expect(room.publicSnapshot.hostPlayerId).toBe(room.viewer.playerId);
    expect(room.viewer.hand).toEqual([]);
  });

  it("joins a room and reconnects only with a valid session", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });
    const joined = service.joinRoom({
      roomCode: created.publicSnapshot.roomCode,
      displayName: "Guest",
      now: 200
    });

    expect(joined).not.toBeNull();
    expect(joined?.publicSnapshot.players).toHaveLength(2);

    service.disconnectPlayer({
      roomCode: created.publicSnapshot.roomCode,
      playerId: joined!.viewer.playerId,
      now: 300
    });

    const reconnect = service.joinRoom({
      roomCode: created.publicSnapshot.roomCode,
      displayName: "Guest Rejoined",
      playerSession: joined!.viewer.playerSession,
      now: 350
    });

    expect(reconnect?.viewer.playerId).toBe(joined!.viewer.playerId);
    expect(reconnect?.publicSnapshot.players).toHaveLength(2);

    const impostorJoin = service.joinRoom({
      roomCode: created.publicSnapshot.roomCode,
      displayName: "Guest Rejoined",
      playerSession: "session_wrong",
      now: 360
    });

    expect(impostorJoin?.publicSnapshot.players).toHaveLength(3);
    expect(impostorJoin?.viewer.playerId).not.toBe(joined!.viewer.playerId);
  });

  it("shuffles the deck without changing the card set", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });
    const before = service.getRoomStateForTest(created.publicSnapshot.roomCode)?.deck.map(
      (card) => card.id
    );

    const shuffled = service.shuffleDeck({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      now: 200
    });

    const after = service.getRoomStateForTest(created.publicSnapshot.roomCode)?.deck.map(
      (card) => card.id
    );

    expect(shuffled.ok).toBe(true);
    expect(after).not.toEqual(before);
    expect([...after!].sort()).toEqual([...before!].sort());
  });

  it("deals cards to connected players and rejects non-host actions", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });
    const joined = service.joinRoom({
      roomCode: created.publicSnapshot.roomCode,
      displayName: "Guest",
      now: 200
    });

    const rejected = service.dealCards({
      roomCode: created.publicSnapshot.roomCode,
      actorId: joined!.viewer.playerId,
      count: 2,
      now: 250
    });

    expect(rejected).toEqual({
      ok: false,
      action: "deal_cards",
      reason: "not_host"
    });

    const dealt = service.dealCards({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      count: 2,
      now: 300
    });

    expect(dealt.ok).toBe(true);
    expect(
      service.getViewerState(created.publicSnapshot.roomCode, created.viewer.playerSession)?.hand
    ).toHaveLength(2);
    expect(
      service.getViewerState(created.publicSnapshot.roomCode, joined!.viewer.playerSession)?.hand
    ).toHaveLength(2);
    expect(service.getPublicSnapshot(created.publicSnapshot.roomCode)?.deckCount).toBe(48);
  });

  it("plays a card to the shared area and then moves it to discard", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });

    service.dealCards({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      count: 1,
      now: 200
    });

    const playerCard = service.getViewerState(
      created.publicSnapshot.roomCode,
      created.viewer.playerSession
    )!.hand[0];

    const played = service.playCard({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      cardId: playerCard.id,
      now: 300
    });

    expect(played.ok).toBe(true);
    expect(
      service.getViewerState(created.publicSnapshot.roomCode, created.viewer.playerSession)?.hand
    ).toHaveLength(0);
    expect(service.getPublicSnapshot(created.publicSnapshot.roomCode)?.sharedPlayArea).toHaveLength(
      1
    );

    const discarded = service.moveToDiscard({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      cardId: playerCard.id,
      now: 400
    });

    expect(discarded.ok).toBe(true);
    expect(service.getPublicSnapshot(created.publicSnapshot.roomCode)?.sharedPlayArea).toHaveLength(
      0
    );
    expect(service.getPublicSnapshot(created.publicSnapshot.roomCode)?.discardCount).toBe(1);
  });

  it("keeps cards in exactly one zone after play and discard operations", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });

    service.dealCards({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      count: 2,
      now: 200
    });

    const viewer = service.getViewerState(
      created.publicSnapshot.roomCode,
      created.viewer.playerSession
    )!;
    const firstCard = viewer.hand[0];

    service.playCard({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      cardId: firstCard.id,
      now: 300
    });
    service.moveToDiscard({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      cardId: firstCard.id,
      now: 400
    });

    const roomState = service.getRoomStateForTest(created.publicSnapshot.roomCode)!;
    const allCards = [
      ...roomState.deck,
      ...roomState.discardPile,
      ...roomState.sharedPlayArea,
      ...roomState.players.flatMap((player) => player.hand)
    ].map((card) => card.id);
    const uniqueCards = new Set(allCards);

    expect(allCards).toHaveLength(52);
    expect(uniqueCards.size).toBe(52);
  });

  it("does not increment the room version for invalid actions", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });
    const beforeVersion = service.getPublicSnapshot(created.publicSnapshot.roomCode)?.roomVersion;

    const rejected = service.playCard({
      roomCode: created.publicSnapshot.roomCode,
      actorId: created.viewer.playerId,
      cardId: "missing-card",
      now: 200
    });

    expect(rejected).toEqual({
      ok: false,
      action: "play_card",
      reason: "card_not_in_hand"
    });
    expect(service.getPublicSnapshot(created.publicSnapshot.roomCode)?.roomVersion).toBe(
      beforeVersion
    );
  });

  it("transfers host when the disconnected host exceeds the grace period", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });
    const joined = service.joinRoom({
      roomCode: created.publicSnapshot.roomCode,
      displayName: "Guest",
      now: 200
    });

    const stillHost = service.disconnectPlayer({
      roomCode: created.publicSnapshot.roomCode,
      playerId: created.viewer.playerId,
      now: 300
    });

    expect(stillHost?.hostPlayerId).toBe(created.viewer.playerId);

    const afterGrace = service.disconnectPlayer({
      roomCode: created.publicSnapshot.roomCode,
      playerId: created.viewer.playerId,
      now: 900
    });

    expect(afterGrace?.hostPlayerId).toBe(joined!.viewer.playerId);
  });

  it("expires idle rooms based on policy", () => {
    const service = createDeterministicRoomService();
    const created = service.createRoom({ displayName: "Host", now: 100 });

    expect(service.cleanupExpiredRooms(5_000)).toEqual([]);
    expect(service.getPublicSnapshot(created.publicSnapshot.roomCode)).not.toBeNull();

    expect(service.cleanupExpiredRooms(10_200)).toEqual([
      created.publicSnapshot.roomCode
    ]);
    expect(service.getPublicSnapshot(created.publicSnapshot.roomCode)).toBeNull();
  });
});
