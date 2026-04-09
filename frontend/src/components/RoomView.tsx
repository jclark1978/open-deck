import { useEffect, useState } from "react";

import type { PublicRoomSnapshot, ViewerPrivateState } from "@open-deck/shared";

type RoomActionName = "shuffle_deck" | "deal_cards" | "play_card" | "move_to_discard";

interface RoomActions {
  pendingAction?: RoomActionName | null;
  onShuffleDeck?: () => void;
  onDealCards?: (count: number) => void;
  onPlayCard?: (cardId: string) => void;
  onMoveToDiscard?: (cardId: string) => void;
}

interface RoomViewProps {
  connectionState: "idle" | "connecting" | "connected" | "error";
  displayName: string;
  publicSnapshot: PublicRoomSnapshot;
  viewer: ViewerPrivateState | null;
  actions?: RoomActions;
  onLeaveRoom: () => void;
}

export function RoomView(props: RoomViewProps) {
  const [selectedHandCardId, setSelectedHandCardId] = useState("");
  const [selectedTableCardId, setSelectedTableCardId] = useState("");
  const [dealCount, setDealCount] = useState(1);

  useEffect(() => {
    const firstCardId = props.viewer?.hand[0]?.id ?? "";

    setSelectedHandCardId((currentSelectedCardId) => {
      if (!props.viewer?.hand.length) {
        return "";
      }

      const selectedCardStillExists = props.viewer.hand.some(
        (card) => card.id === currentSelectedCardId
      );

      return selectedCardStillExists ? currentSelectedCardId : firstCardId;
    });
  }, [props.viewer?.hand]);

  useEffect(() => {
    const firstTableCardId = props.publicSnapshot.sharedPlayArea[0]?.id ?? "";

    setSelectedTableCardId((currentSelectedCardId) => {
      if (!props.publicSnapshot.sharedPlayArea.length) {
        return "";
      }

      const selectedCardStillExists = props.publicSnapshot.sharedPlayArea.some(
        (card) => card.id === currentSelectedCardId
      );

      return selectedCardStillExists ? currentSelectedCardId : firstTableCardId;
    });
  }, [props.publicSnapshot.sharedPlayArea]);

  const isHost = props.viewer?.playerId === props.publicSnapshot.hostPlayerId;
  const selectedCard =
    props.viewer?.hand.find((card) => card.id === selectedHandCardId) ??
    props.viewer?.hand[0] ??
    null;
  const selectedTableCard =
    props.publicSnapshot.sharedPlayArea.find((card) => card.id === selectedTableCardId) ??
    props.publicSnapshot.sharedPlayArea[0] ??
    null;
  const pendingAction = props.actions?.pendingAction ?? null;
  const isBusy = pendingAction !== null;

  const canUseHostActions = isHost && !isBusy;
  const canPlayFromHand = Boolean(selectedCard) && !isBusy;
  const canDiscardFromTable = Boolean(selectedTableCard) && !isBusy;

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

        <section className="control-grid" aria-label="Room actions">
          <article className="panel-card action-card">
            <div className="panel-heading">
              <div>
                <h2>Host controls</h2>
                <p className="muted-copy">
                  {isHost
                    ? "Manage the shared deck for the room."
                    : "Only the host can shuffle and deal."}
                </p>
              </div>
              {pendingAction === "shuffle_deck" || pendingAction === "deal_cards" ? (
                <span className="action-status">Working</span>
              ) : null}
            </div>

            <div className="action-stack">
              <button
                type="button"
                onClick={props.actions?.onShuffleDeck}
                disabled={!canUseHostActions || !props.actions?.onShuffleDeck}
              >
                {pendingAction === "shuffle_deck" ? "Shuffling..." : "Shuffle deck"}
              </button>

              <div className="deal-row">
                <label className="deal-field">
                  <span>Cards to deal</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={dealCount}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setDealCount(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
                    }}
                    disabled={!canUseHostActions}
                  />
                </label>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => props.actions?.onDealCards?.(dealCount)}
                  disabled={!canUseHostActions || !props.actions?.onDealCards}
                >
                  {pendingAction === "deal_cards" ? "Dealing..." : "Deal cards"}
                </button>
              </div>
            </div>
          </article>

          <article className="panel-card action-card">
            <div className="panel-heading">
              <div>
                <h2>Card actions</h2>
                <p className="muted-copy">
                  Play a card from your hand, or move a shared table card into the discard pile.
                </p>
              </div>
              {pendingAction === "play_card" || pendingAction === "move_to_discard" ? (
                <span className="action-status">Working</span>
              ) : null}
            </div>

            <div className="action-stack">
              {props.viewer?.hand.length ? (
                <>
                <label className="deal-field">
                  <span>Card from your hand</span>
                  <select
                    value={selectedCard?.id ?? ""}
                    onChange={(event) => setSelectedHandCardId(event.target.value)}
                    disabled={!canPlayFromHand}
                  >
                    {props.viewer.hand.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.rank} {formatSuit(card.suit)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="action-button-row">
                  <button
                    type="button"
                    onClick={() => selectedCard && props.actions?.onPlayCard?.(selectedCard.id)}
                    disabled={!canPlayFromHand || !props.actions?.onPlayCard}
                  >
                    {pendingAction === "play_card" ? "Playing..." : "Play card"}
                  </button>
                </div>
                </>
              ) : (
                <p className="muted-copy">Your hand is empty, so there is nothing to play yet.</p>
              )}

              <label className="deal-field">
                <span>Card from the table</span>
                <select
                  value={selectedTableCard?.id ?? ""}
                  onChange={(event) => setSelectedTableCardId(event.target.value)}
                  disabled={!canDiscardFromTable}
                >
                  {props.publicSnapshot.sharedPlayArea.length ? (
                    props.publicSnapshot.sharedPlayArea.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.rank} {formatSuit(card.suit)}
                      </option>
                    ))
                  ) : (
                    <option value="">No shared cards in play</option>
                  )}
                </select>
              </label>

              <div className="action-button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    selectedTableCard && props.actions?.onMoveToDiscard?.(selectedTableCard.id)
                  }
                  disabled={!canDiscardFromTable || !props.actions?.onMoveToDiscard}
                >
                  {pendingAction === "move_to_discard" ? "Discarding..." : "Move to discard"}
                </button>
              </div>
            </div>
          </article>
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
                No private cards yet. Ask the host to deal cards, then you can play from here.
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
