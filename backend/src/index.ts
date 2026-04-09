import type { PublicRoomSnapshot } from "@open-deck/shared";

export { RoomService } from "./services/room-service.js";
export { createApp } from "./server.js";

export interface BackendAppInfo {
  name: string;
  stage: "foundation" | "room-engine" | "transport";
  snapshotShape: PublicRoomSnapshot | null;
}

export const backendAppInfo: BackendAppInfo = {
  name: "open-deck-backend",
  stage: "transport",
  snapshotShape: null
};
