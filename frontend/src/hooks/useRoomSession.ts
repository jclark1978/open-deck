import { useEffect, useRef, useState } from "react";

import type { BootstrapResponse, GameErrorEvent, PublicRoomSnapshot } from "@open-deck/shared";

import { createApiClient } from "../lib/api";
import { createRoomSocket } from "../lib/socket";
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  type StoredSession
} from "../lib/session-storage";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

interface RoomSessionState {
  connectionState: ConnectionState;
  displayName: string;
  errorMessage: string | null;
  publicSnapshot: PublicRoomSnapshot | null;
  viewer: BootstrapResponse["viewer"] | null;
}

const api = createApiClient();

export function useRoomSession() {
  const socketRef = useRef(createRoomSocket());
  const [state, setState] = useState<RoomSessionState>({
    connectionState: "idle",
    displayName: "",
    errorMessage: null,
    publicSnapshot: null,
    viewer: null
  });

  useEffect(() => {
    const socket = socketRef.current;

    const removeSnapshotListener = socket.onSnapshot((event) => {
      setState((currentState) => ({
        ...currentState,
        connectionState: "connected",
        publicSnapshot: event.publicSnapshot,
        viewer: event.viewer ?? currentState.viewer,
        errorMessage: null
      }));
    });

    const removeErrorListener = socket.onError((event: GameErrorEvent) => {
      setState((currentState) => ({
        ...currentState,
        connectionState: "error",
        errorMessage: toUiError(event)
      }));
    });

    const removeConnectListener = socket.onConnect(() => {
      setState((currentState) => ({
        ...currentState,
        connectionState:
          currentState.publicSnapshot || currentState.viewer ? "connected" : "connecting"
      }));
    });

    const storedSession = loadStoredSession();

    if (storedSession) {
      void restoreSession(storedSession);
    }

    return () => {
      removeSnapshotListener();
      removeErrorListener();
      removeConnectListener();
      socket.disconnect();
    };
  }, []);

  async function createRoom(displayName: string) {
    setState((currentState) => ({
      ...currentState,
      connectionState: "connecting",
      errorMessage: null
    }));

    try {
      const created = await api.createRoom({ displayName });
      persistSession({
        displayName,
        playerSession: created.viewer.playerSession,
        roomCode: created.roomCode
      });
      connectToRoom(created, displayName);
    } catch (error) {
      setFailedState(error);
    }
  }

  async function joinRoom(roomCode: string, displayName: string) {
    setState((currentState) => ({
      ...currentState,
      connectionState: "connecting",
      errorMessage: null
    }));

    try {
      const joined = await api.joinRoom(roomCode, {
        displayName,
        playerSession: loadStoredSession()?.roomCode === roomCode ? loadStoredSession()?.playerSession : undefined
      });
      persistSession({
        displayName,
        playerSession: joined.viewer.playerSession,
        roomCode: joined.roomCode
      });
      connectToRoom(joined, displayName);
    } catch (error) {
      setFailedState(error);
    }
  }

  function leaveRoom() {
    socketRef.current.disconnect();
    clearStoredSession();
    setState({
      connectionState: "idle",
      displayName: "",
      errorMessage: null,
      publicSnapshot: null,
      viewer: null
    });
  }

  async function restoreSession(storedSession: StoredSession) {
    setState((currentState) => ({
      ...currentState,
      connectionState: "connecting",
      displayName: storedSession.displayName,
      errorMessage: null
    }));

    try {
      const bootstrapped = await api.getBootstrap(
        storedSession.roomCode,
        storedSession.playerSession
      );

      if (!("viewer" in bootstrapped)) {
        clearStoredSession();
        setState((currentState) => ({
          ...currentState,
          connectionState: "idle",
          publicSnapshot: bootstrapped.publicSnapshot,
          viewer: null,
          errorMessage: null
        }));
        return;
      }

      connectToRoom(
        {
          publicSnapshot: bootstrapped.publicSnapshot,
          viewer: bootstrapped.viewer,
          roomCode: bootstrapped.publicSnapshot.roomCode,
          playerId: bootstrapped.viewer.playerId,
          playerSession: bootstrapped.viewer.playerSession
        },
        storedSession.displayName
      );
    } catch {
      clearStoredSession();
      setState((currentState) => ({
        ...currentState,
        connectionState: "idle",
        errorMessage: null,
        publicSnapshot: null,
        viewer: null
      }));
    }
  }

  function connectToRoom(
    bootstrap: BootstrapResponse & {
      roomCode: string;
      playerId: string;
      playerSession: string;
    },
    displayName: string
  ) {
    const socket = socketRef.current;

    socket.disconnect();
    socket.connect();
    socket.joinRoom(bootstrap.roomCode, bootstrap.viewer.playerSession);

    setState({
      connectionState: "connecting",
      displayName,
      errorMessage: null,
      publicSnapshot: bootstrap.publicSnapshot,
      viewer: bootstrap.viewer
    });
  }

  function persistSession(storedSession: StoredSession) {
    saveStoredSession(storedSession);
  }

  function setFailedState(error: unknown) {
    setState((currentState) => ({
      ...currentState,
      connectionState: "error",
      errorMessage: error instanceof Error ? error.message : "Something went wrong"
    }));
  }

  return {
    connectionState: state.connectionState,
    displayName: state.displayName,
    errorMessage: state.errorMessage,
    publicSnapshot: state.publicSnapshot,
    viewer: state.viewer,
    createRoom,
    joinRoom,
    leaveRoom
  };
}

function toUiError(event: GameErrorEvent) {
  switch (event.reason) {
    case "invalid_session":
      return "Your room session is no longer valid.";
    case "not_host":
      return "Only the host can do that right now.";
    case "player_not_in_room":
      return "That player is no longer in the room.";
    default:
      return "The server rejected that action.";
  }
}
