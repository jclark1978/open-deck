import type { PublicRoomSnapshot } from "@open-deck/shared";

export interface BackendAppInfo {
  name: string;
  stage: "foundation";
  snapshotShape: PublicRoomSnapshot | null;
}

// Slice 1 keeps the backend intentionally light and reserves room logic for Slice 3.
export const backendAppInfo: BackendAppInfo = {
  name: "open-deck-backend",
  stage: "foundation",
  snapshotShape: null
};

