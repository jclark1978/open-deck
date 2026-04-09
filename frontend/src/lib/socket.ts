import { io, type Socket } from "socket.io-client";

import type {
  GameActionEvent,
  GameErrorEvent,
  PlayerSession,
  RoomCode,
  RoomSnapshotEvent
} from "@open-deck/shared";

export function createRoomSocket(baseUrl = getSocketBaseUrl()) {
  const socket = io(baseUrl, {
    autoConnect: false,
    transports: ["websocket"]
  });

  return {
    connect() {
      socket.connect();
    },
    disconnect() {
      socket.disconnect();
    },
    joinRoom(roomCode: RoomCode, playerSession: PlayerSession) {
      socket.emit("room:join", { roomCode, playerSession });
    },
    onSnapshot(handler: (event: RoomSnapshotEvent) => void) {
      socket.on("room:snapshot", handler);
      return () => socket.off("room:snapshot", handler);
    },
    onError(handler: (event: GameErrorEvent) => void) {
      socket.on("game:error", handler);
      return () => socket.off("game:error", handler);
    },
    onConnect(handler: () => void) {
      socket.on("connect", handler);
      return () => socket.off("connect", handler);
    }
  };
}

function getSocketBaseUrl() {
  return import.meta.env.VITE_SOCKET_BASE_URL ?? getDefaultSocketBaseUrl();
}

function getDefaultSocketBaseUrl() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:3001";
  }

  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export type RoomSocket = ReturnType<typeof createRoomSocket>;
export type RoomClientSocket = Socket;
export type RoomGameActionEvent = GameActionEvent;
