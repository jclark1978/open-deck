import type { PublicRoomSnapshot, ViewerPrivateState } from "@open-deck/shared";

interface RoomViewProps {
  connectionState: "idle" | "connecting" | "connected" | "error";
  displayName: string;
  publicSnapshot: PublicRoomSnapshot;
  viewer: ViewerPrivateState | null;
  onLeaveRoom: () => void;
}

export function RoomView(props: RoomViewProps) {
  return (
    <main className="room-shell">
      <section className="hero-card room-card">
        <div className="room-header">
          <div>
            <p className="eyebrow">Room {props.publicSnapshot.roomCode}</p>
            <h1>Shared table snapshot</h1>
            <p className="body-copy">
              Connected as {props.displayName}. Live updates should flow into this view as
              other players join and act.
            </p>
          </div>
          <div className="connection-panel">
            <span className={`connection-pill connection-${props.connectionState}`}>
              {props.connectionState}
            </span>
            <button type="button" className="secondary-button" onClick={props.onLeaveRoom}>
              Leave room
            </button>
          </div>
        </div>

        <section className="overview-grid">
          <StatCard label="Deck" value={`${props.publicSnapshot.deckCount} cards`} />
          <StatCard label="Discard" value={`${props.publicSnapshot.discardCount} cards`} />
          <StatCard
            label="Table"
            value={`${props.publicSnapshot.sharedPlayArea.length} cards in play`}
          />
          <StatCard label="Hand" value={`${props.viewer?.hand.length ?? 0} private cards`} />
        </section>

        <section className="panel-grid">
          <article className="panel-card">
            <h2>Players</h2>
            <ul className="plain-list">
              {props.publicSnapshot.players.map((player) => (
                <li key={player.id} className="player-row">
                  <div>
                    <strong>{player.displayName}</strong>
                    <span className="player-meta">
                      {player.isHost ? "Host" : "Player"} • {player.handCount} cards
                    </span>
                  </div>
                  <span className={player.isConnected ? "status-on" : "status-off"}>
                    {player.isConnected ? "Connected" : "Away"}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel-card">
            <h2>Shared table</h2>
            {props.publicSnapshot.sharedPlayArea.length === 0 ? (
              <p className="muted-copy">No cards have been played yet.</p>
            ) : (
              <ul className="card-list">
                {props.publicSnapshot.sharedPlayArea.map((card) => (
                  <li key={card.id} className="mini-card">
                    {card.rank} {formatSuit(card.suit)}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel-card">
            <h2>Your hand</h2>
            {props.viewer?.hand.length ? (
              <ul className="card-list">
                {props.viewer.hand.map((card) => (
                  <li key={card.id} className="mini-card private-card">
                    {card.rank} {formatSuit(card.suit)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">
                No private cards yet. Action controls land in the next slice.
              </p>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <article className="stat-card">
      <p>{props.label}</p>
      <strong>{props.value}</strong>
    </article>
  );
}

function formatSuit(suit: string) {
  return suit.slice(0, 1).toUpperCase() + suit.slice(1);
}
