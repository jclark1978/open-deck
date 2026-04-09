import type { BootstrapResponse, PlayerSession, RoomCode } from "@open-deck/shared";

export interface CreateRoomResponse extends BootstrapResponse {
  roomCode: RoomCode;
  playerId: string;
  playerSession: PlayerSession;
}

export interface JoinRoomRequest {
  displayName: string;
  playerSession?: PlayerSession;
}

export interface CreateRoomRequest {
  displayName: string;
}

export function createApiClient(baseUrl = getApiBaseUrl()) {
  return {
    async createRoom(input: CreateRoomRequest): Promise<CreateRoomResponse> {
      return postJson<CreateRoomResponse>(`${baseUrl}/rooms`, input);
    },
    async joinRoom(roomCode: RoomCode, input: JoinRoomRequest): Promise<CreateRoomResponse> {
      return postJson<CreateRoomResponse>(`${baseUrl}/rooms/${roomCode}/join`, input);
    },
    async getBootstrap(
      roomCode: RoomCode,
      playerSession?: PlayerSession
    ): Promise<BootstrapResponse | { publicSnapshot: BootstrapResponse["publicSnapshot"] }> {
      const search = playerSession
        ? `?playerSession=${encodeURIComponent(playerSession)}`
        : "";

      return getJson<BootstrapResponse | { publicSnapshot: BootstrapResponse["publicSnapshot"] }>(
        `${baseUrl}/rooms/${roomCode}${search}`
      );
    }
  };
}

async function postJson<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Request failed"));
  }

  return (await response.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(await readError(response, "Request failed"));
  }

  return (await response.json()) as T;
}

async function readError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBaseUrl();
}

function getDefaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:3001";
  }

  return `${window.location.protocol}//${window.location.hostname}:3001`;
}
