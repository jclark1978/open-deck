import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

import { Server as SocketIOServer } from "socket.io";

import type {
  GameAction,
  GameActionEvent,
  GameErrorEvent,
  PlayerSession,
  RoomJoinEvent,
  RoomSnapshotEvent
} from "@open-deck/shared";

import { RoomService } from "./services/room-service.js";

interface CreateAppOptions {
  roomService?: RoomService;
}

interface ParsedBody {
  displayName?: unknown;
  playerSession?: unknown;
}

interface SocketContext {
  playerSession?: PlayerSession;
  roomCode?: string;
}

export function createApp(options: CreateAppOptions = {}) {
  const roomService = options.roomService ?? new RoomService();
  const sessionSockets = new Map<PlayerSession, Set<string>>();
  const io = new SocketIOServer({
    cors: {
      origin: "*"
    }
  });

  const httpServer = createServer(async (request, response) => {
    await handleRequest(request, response, roomService);
  });

  io.attach(httpServer);

  io.on("connection", (socket) => {
    const context: SocketContext = {};

    socket.on("room:join", (payload: RoomJoinEvent) => {
      const viewer = roomService.getViewerState(payload.roomCode, payload.playerSession);
      const publicSnapshot = roomService.getPublicSnapshot(payload.roomCode);

      if (!viewer || !publicSnapshot) {
        const errorEvent: GameErrorEvent = {
          action: "shuffle_deck",
          reason: "invalid_session"
        };
        socket.emit("game:error", errorEvent);
        return;
      }

      context.playerSession = payload.playerSession;
      context.roomCode = payload.roomCode;

      socket.join(payload.roomCode);
      addSessionSocket(sessionSockets, payload.playerSession, socket.id);

      const snapshotEvent: RoomSnapshotEvent = {
        publicSnapshot,
        viewer
      };
      socket.emit("room:snapshot", snapshotEvent);
    });

    socket.on("game:action", (payload: GameActionEvent) => {
      const viewer = roomService.getViewerState(payload.roomCode, payload.playerSession);

      if (!viewer) {
        const errorEvent: GameErrorEvent = {
          action: payload.action.type,
          reason: "invalid_session"
        };
        socket.emit("game:error", errorEvent);
        return;
      }

      const result = applyGameAction(roomService, payload.roomCode, viewer.playerId, payload.action);

      if (!result.ok) {
        const errorEvent: GameErrorEvent = {
          action: result.action,
          reason: result.reason
        };
        socket.emit("game:error", errorEvent);
        return;
      }

      emitRoomSnapshots(io, roomService, sessionSockets, payload.roomCode);
    });

    socket.on("disconnect", () => {
      if (context.playerSession) {
        removeSessionSocket(sessionSockets, context.playerSession, socket.id);
      }
    });
  });

  return {
    httpServer,
    io,
    roomService
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  roomService: RoomService
) {
  applyCorsHeaders(response);

  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (method === "POST" && url.pathname === "/rooms") {
    const body = await parseJsonBody(request);

    if (typeof body.displayName !== "string" || body.displayName.trim().length === 0) {
      return writeJson(response, 400, { error: "displayName is required" });
    }

    const created = roomService.createRoom({
      displayName: body.displayName.trim()
    });

    return writeJson(response, 201, {
      roomCode: created.publicSnapshot.roomCode,
      playerSession: created.viewer.playerSession,
      playerId: created.viewer.playerId,
      publicSnapshot: created.publicSnapshot,
      viewer: created.viewer
    });
  }

  const joinMatch = url.pathname.match(/^\/rooms\/([^/]+)\/join$/);

  if (method === "POST" && joinMatch) {
    const body = await parseJsonBody(request);

    if (typeof body.displayName !== "string" || body.displayName.trim().length === 0) {
      return writeJson(response, 400, { error: "displayName is required" });
    }

    const joined = roomService.joinRoom({
      roomCode: joinMatch[1],
      displayName: body.displayName.trim(),
      playerSession:
        typeof body.playerSession === "string" ? body.playerSession : undefined
    });

    if (!joined) {
      return writeJson(response, 404, { error: "room unavailable" });
    }

    return writeJson(response, 200, {
      roomCode: joined.publicSnapshot.roomCode,
      playerSession: joined.viewer.playerSession,
      playerId: joined.viewer.playerId,
      publicSnapshot: joined.publicSnapshot,
      viewer: joined.viewer
    });
  }

  const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);

  if (method === "GET" && roomMatch) {
    const publicSnapshot = roomService.getPublicSnapshot(roomMatch[1]);

    if (!publicSnapshot) {
      return writeJson(response, 404, { error: "room not found" });
    }

    const playerSession = url.searchParams.get("playerSession");
    const viewer = playerSession
      ? roomService.getViewerState(roomMatch[1], playerSession)
      : null;

    return writeJson(response, 200, {
      publicSnapshot,
      ...(viewer ? { viewer } : {})
    });
  }

  return writeJson(response, 404, { error: "not found" });
}

async function parseJsonBody(request: IncomingMessage): Promise<ParsedBody> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as ParsedBody;
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

function applyCorsHeaders(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function applyGameAction(
  roomService: RoomService,
  roomCode: string,
  actorId: string,
  action: GameAction
) {
  switch (action.type) {
    case "shuffle_deck":
      return roomService.shuffleDeck({ roomCode, actorId });
    case "deal_cards":
      return roomService.dealCards({ roomCode, actorId, count: action.count });
    case "play_card":
      return roomService.playCard({ roomCode, actorId, cardId: action.cardId });
    case "move_to_discard":
      return roomService.moveToDiscard({ roomCode, actorId, cardId: action.cardId });
  }
}

function emitRoomSnapshots(
  io: SocketIOServer,
  roomService: RoomService,
  sessionSockets: Map<PlayerSession, Set<string>>,
  roomCode: string
) {
  const publicSnapshot = roomService.getPublicSnapshot(roomCode);

  if (!publicSnapshot) {
    return;
  }

  for (const player of publicSnapshot.players) {
    const viewer = roomService.getViewerStateByPlayerId(roomCode, player.id);

    if (!viewer) {
      continue;
    }

    const socketIds = sessionSockets.get(viewer.playerSession);

    if (!socketIds) {
      continue;
    }

    for (const socketId of socketIds) {
      io.to(socketId).emit("room:snapshot", {
        publicSnapshot,
        viewer
      } satisfies RoomSnapshotEvent);
    }
  }
}

function addSessionSocket(
  sessionSockets: Map<PlayerSession, Set<string>>,
  playerSession: PlayerSession,
  socketId: string
) {
  const socketIds = sessionSockets.get(playerSession) ?? new Set<string>();
  socketIds.add(socketId);
  sessionSockets.set(playerSession, socketIds);
}

function removeSessionSocket(
  sessionSockets: Map<PlayerSession, Set<string>>,
  playerSession: PlayerSession,
  socketId: string
) {
  const socketIds = sessionSockets.get(playerSession);

  if (!socketIds) {
    return;
  }

  socketIds.delete(socketId);

  if (socketIds.size === 0) {
    sessionSockets.delete(playerSession);
  }
}

export type OpenDeckApp = ReturnType<typeof createApp>;
