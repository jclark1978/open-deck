import { useState } from "react";

interface CreateJoinFormProps {
  connectionState: "idle" | "connecting" | "connected" | "error";
  errorMessage: string | null;
  onCreateRoom: (displayName: string) => Promise<void>;
  onJoinRoom: (roomCode: string, displayName: string) => Promise<void>;
}

export function CreateJoinForm(props: CreateJoinFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const isBusy = props.connectionState === "connecting";

  return (
    <section className="hero-card form-card">
      <p className="eyebrow">Open Deck</p>
      <h1>Start a room or join one already on the table.</h1>
      <p className="body-copy">
        This first draft wires the real backend flow: room creation, join, bootstrap,
        and live snapshot updates.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Casey"
          />
        </label>
        <label className="field">
          <span>Room code</span>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
        </label>
      </div>
      {props.errorMessage ? <p className="error-banner">{props.errorMessage}</p> : null}
      <div className="actions-row">
        <button
          type="button"
          disabled={isBusy || displayName.trim().length === 0}
          onClick={() => void props.onCreateRoom(displayName.trim())}
        >
          {isBusy ? "Connecting..." : "Create room"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={isBusy || displayName.trim().length === 0 || roomCode.trim().length === 0}
          onClick={() => void props.onJoinRoom(roomCode.trim(), displayName.trim())}
        >
          Join room
        </button>
      </div>
    </section>
  );
}
