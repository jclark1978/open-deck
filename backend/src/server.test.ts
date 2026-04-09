import { afterEach, describe, expect, it } from "vitest";
import { io as createSocketClient, type Socket } from "socket.io-client";

import type { BootstrapResponse, RoomSnapshotEvent } from "@open-deck/shared";

import { createApp } from "./server";

const appsToClose: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  while (appsToClose.length > 0) {
    const app = appsToClose.pop();

    if (!app) {
      continue;
    }

    await new Promise<void>((resolve, reject) => {
      app.io.close(() => {
        if (!app.httpServer.listening) {
          resolve();
          return;
        }

        app.httpServer.close((closeError) => {
          if (closeError && closeError.message !== "Server is not running.") {
            reject(closeError);
            return;
          }

          resolve();
        });
      });
    });
  }
});

describe("createApp", () => {
  it("creates a room, joins it, and fetches a bootstrap snapshot", async () => {
    const baseUrl = await startApp();

    const created = await postJson<BootstrapResponse & { roomCode: string }>(`${baseUrl}/rooms`, {
      displayName: "Host"
    });

    expect(created.publicSnapshot.players).toHaveLength(1);

    const joined = await postJson<BootstrapResponse & { roomCode: string }>(
      `${baseUrl}/rooms/${created.roomCode}/join`,
      { displayName: "Guest" }
    );

    expect(joined.publicSnapshot.players).toHaveLength(2);

    const bootstrapped = await getJson<{
      publicSnapshot: BootstrapResponse["publicSnapshot"];
      viewer: BootstrapResponse["viewer"];
    }>(
      `${baseUrl}/rooms/${created.roomCode}?playerSession=${joined.viewer.playerSession}`
    );

    expect(bootstrapped.publicSnapshot.roomCode).toBe(created.roomCode);
    expect(bootstrapped.viewer.playerId).toBe(joined.viewer.playerId);
  });

  it("broadcasts authoritative room snapshots over Socket.IO after a valid action", async () => {
    const baseUrl = await startApp();
    const created = await postJson<BootstrapResponse & { roomCode: string }>(`${baseUrl}/rooms`, {
      displayName: "Host"
    });
    const joined = await postJson<BootstrapResponse & { roomCode: string }>(
      `${baseUrl}/rooms/${created.roomCode}/join`,
      { displayName: "Guest" }
    );

    const hostSocket = createClient(baseUrl);
    const guestSocket = createClient(baseUrl);

    const hostSnapshotPromise = onceSnapshot(hostSocket, created.roomCode, created.viewer.playerSession);
    const guestSnapshotPromise = onceSnapshot(guestSocket, created.roomCode, joined.viewer.playerSession);

    const [hostInitial, guestInitial] = await Promise.all([
      hostSnapshotPromise,
      guestSnapshotPromise
    ]);

    expect(hostInitial.viewer?.playerId).toBe(created.viewer.playerId);
    expect(guestInitial.viewer?.playerId).toBe(joined.viewer.playerId);

    const hostUpdatePromise = nextSnapshot(hostSocket);
    const guestUpdatePromise = nextSnapshot(guestSocket);

    hostSocket.emit("game:action", {
      roomCode: created.roomCode,
      playerSession: created.viewer.playerSession,
      action: {
        type: "deal_cards",
        count: 1
      }
    });

    const [hostUpdate, guestUpdate] = await Promise.all([
      hostUpdatePromise,
      guestUpdatePromise
    ]);

    expect(hostUpdate.publicSnapshot.roomVersion).toBe(1);
    expect(guestUpdate.publicSnapshot.roomVersion).toBe(1);
    expect(hostUpdate.viewer?.hand).toHaveLength(1);
    expect(guestUpdate.viewer?.hand).toHaveLength(1);

    hostSocket.close();
    guestSocket.close();
  });
});

async function startApp() {
  const app = createApp();
  appsToClose.push(app);

  await new Promise<void>((resolve, reject) => {
    app.httpServer.listen(0, () => resolve());
    app.httpServer.once("error", reject);
  });

  const address = app.httpServer.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a numeric server port");
  }

  return `http://127.0.0.1:${address.port}`;
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
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function createClient(baseUrl: string) {
  return createSocketClient(baseUrl, {
    transports: ["websocket"]
  });
}

function onceSnapshot(
  socket: Socket,
  roomCode: string,
  playerSession: string
) {
  const snapshotPromise = nextSnapshot(socket);
  socket.emit("room:join", { roomCode, playerSession });
  return snapshotPromise;
}

function nextSnapshot(socket: Socket) {
  return new Promise<RoomSnapshotEvent>((resolve) => {
    socket.once("room:snapshot", resolve);
  });
}
