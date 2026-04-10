import { useEffect, useMemo, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";

import type {
  Card,
  GameAction,
  PublicRoomSnapshot,
  TableCard,
  ViewerPrivateState
} from "@open-deck/shared";

type RoomActionName = GameAction["type"];
type DragSource = "discard" | "draw" | "hand" | "table";
type DropTarget = "hand" | "table" | "discard" | null;
type HandSortMode = "manual" | "rank_desc" | "rank_asc" | "suit_desc" | "suit_asc";

interface DragState {
  cardId: string | null;
  source: DragSource;
}

interface RoomActions {
  pendingAction?: RoomActionName | null;
  onDealCards?: (count: number) => void;
  onResetTable?: () => void;
  onDrawCard?: (source: "draw" | "discard") => void;
  onPlayCard?: (cardId: string, position: { x: number; y: number }) => void;
  onMoveTableCard?: (cardId: string, position: { x: number; y: number }) => void;
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
  const [dealCount, setDealCount] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<DropTarget>(null);
  const [handOrderIds, setHandOrderIds] = useState<string[]>([]);
  const [handSortMode, setHandSortMode] = useState<HandSortMode>("manual");
  const [handMenuOpen, setHandMenuOpen] = useState(false);
  const [hostMenuOpen, setHostMenuOpen] = useState(false);

  const isHost = props.viewer?.playerId === props.publicSnapshot.hostPlayerId;
  const pendingAction = props.actions?.pendingAction ?? null;
  const isBusy = pendingAction !== null;
  const otherPlayers = props.publicSnapshot.players.filter(
    (player) => player.id !== props.viewer?.playerId
  );
  const topPlayers = otherPlayers.slice(0, 3);
  const sidePlayers = otherPlayers.slice(3);

  const handDropEnabled =
    (dragState?.source === "draw" || dragState?.source === "discard") && !isBusy
      ? Boolean(props.actions?.onDrawCard)
      : false;
  const tableDropEnabled =
    (dragState?.source === "hand" || dragState?.source === "table") &&
    !isBusy &&
    Boolean(props.actions?.onPlayCard || props.actions?.onMoveTableCard);
  const discardDropEnabled =
    (dragState?.source === "table" || dragState?.source === "hand") &&
    !isBusy &&
    Boolean(props.actions?.onMoveToDiscard);

  const discardTopCard = props.publicSnapshot.discardTopCard;
  const viewerHand = props.viewer?.hand ?? [];
  const sharedCards = props.publicSnapshot.sharedPlayArea;
  const orderedViewerHand = useMemo(
    () => orderCardsByIds(viewerHand, deriveHandOrder(viewerHand, handOrderIds, handSortMode)),
    [handOrderIds, handSortMode, viewerHand]
  );
  const handBaseCardWidth = 84;
  const handBaseSpacing = 34;
  const handAvailableWidth = 980;
  const handNaturalWidth =
    orderedViewerHand.length > 0
      ? handBaseCardWidth + (orderedViewerHand.length - 1) * handBaseSpacing + 24
      : 0;
  const handCardScale =
    handNaturalWidth > 0 ? Math.max(0.72, Math.min(1, handAvailableWidth / handNaturalWidth)) : 1;
  const handCardSpacing = handBaseSpacing * handCardScale;
  const handCardWidth = handBaseCardWidth * handCardScale;
  const handClusterWidth =
    orderedViewerHand.length > 0
      ? handCardWidth + (orderedViewerHand.length - 1) * handCardSpacing
      : 0;
  const handStartX = -handClusterWidth / 2;

  useEffect(() => {
    setHandOrderIds((currentOrder) => deriveHandOrder(viewerHand, currentOrder, handSortMode));
  }, [handSortMode, viewerHand]);

  const dragPreview = useMemo(() => {
    if (!dragState) {
      return null;
    }

    if (dragState.source === "draw" || dragState.source === "discard") {
      return null;
    }

    if (dragState.source === "hand") {
      return orderedViewerHand.find((card) => card.id === dragState.cardId) ?? null;
    }

    return (
      props.publicSnapshot.sharedPlayArea.find((card) => card.id === dragState.cardId) ?? null
    );
  }, [dragState, orderedViewerHand, props.publicSnapshot.sharedPlayArea]);

  function beginDrag(cardId: string | null, source: DragSource) {
    if (isBusy) {
      return;
    }

    setHandMenuOpen(false);
    setHostMenuOpen(false);
    setDragState({ cardId, source });
  }

  function endDrag() {
    setDragState(null);
    setHoverTarget(null);
  }

  function toggleHostMenu() {
    setHandMenuOpen(false);
    setHostMenuOpen((currentValue) => !currentValue);
  }

  function handleHandDragOver(event: ReactDragEvent<HTMLUListElement>) {
    if (dragState?.source !== "hand" || !dragState.cardId || isBusy || orderedViewerHand.length < 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const nextIndex = getHandInsertIndex(event, orderedViewerHand.length, handStartX, handCardSpacing);

    setHandOrderIds((currentOrder) => reorderHandIds(currentOrder, dragState.cardId!, nextIndex));
  }

  function handleHandDrop(event: ReactDragEvent<HTMLUListElement>) {
    if (dragState?.source !== "hand") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setHandSortMode("manual");
    endDrag();
  }

  function allowDrop(target: DropTarget, source: DragSource | undefined) {
    if (!source) {
      return false;
    }

    if (target === "hand") {
      return (
        (source === "draw" || source === "discard") &&
        Boolean(props.actions?.onDrawCard) &&
        !isBusy
      );
    }

    if (target === "table") {
      return (
        ((source === "hand" && Boolean(props.actions?.onPlayCard)) ||
          (source === "table" && Boolean(props.actions?.onMoveTableCard))) &&
        !isBusy
      );
    }

    if (target === "discard") {
      return (
        (source === "hand" || source === "table") &&
        Boolean(props.actions?.onMoveToDiscard) &&
        !isBusy
      );
    }

    return false;
  }

  function handleDrop(target: DropTarget, event: ReactDragEvent<HTMLDivElement>) {
    if (!dragState || !allowDrop(target, dragState.source)) {
      return;
    }

    if (target === "hand") {
      if (dragState.source === "draw" || dragState.source === "discard") {
        props.actions?.onDrawCard?.(dragState.source);
      }
    }

    if (target === "table") {
      const position = toTableDropPosition(event);

      if (dragState.cardId && dragState.source === "hand") {
        props.actions?.onPlayCard?.(dragState.cardId, position);
      }

      if (dragState.cardId && dragState.source === "table") {
        props.actions?.onMoveTableCard?.(dragState.cardId, position);
      }
    }

    if (target === "discard") {
      if (dragState.cardId) {
        props.actions?.onMoveToDiscard?.(dragState.cardId);
      }
    }

    endDrag();
  }

  return (
    <main className="table-shell">
      <section className="tabletop">
        <header className="tabletop-header">
          <div>
            <p className="eyebrow">Room {props.publicSnapshot.roomCode}</p>
            <h1>Shared digital tabletop</h1>
          </div>
          <div className="header-actions">
            <span className={`connection-pill connection-${props.connectionState}`}>
              {props.connectionState}
            </span>
            <button type="button" className="secondary-button" onClick={props.onLeaveRoom}>
              Leave room
            </button>
          </div>
        </header>

        <section className="player-ring player-ring-top">
          {topPlayers.length ? (
            topPlayers.map((player) => (
              <PlayerBadge key={player.id} player={player} />
            ))
          ) : (
            <EmptySeat label="Waiting for more players" />
          )}
        </section>

        <section className={["table-area", sidePlayers.length ? "" : "table-area-full"].filter(Boolean).join(" ")}>
          {sidePlayers.length ? (
            <aside className="table-side">
              {sidePlayers.map((player) => <PlayerBadge key={player.id} player={player} />)}
            </aside>
          ) : null}

          <section className="felt">
            <DropZone
              className="shared-table-zone"
              label="Table"
              target="table"
              enabled={tableDropEnabled}
              active={hoverTarget === "table"}
              onDrop={handleDrop}
              onHover={setHoverTarget}
            >
              {isHost ? (
                <div className="host-table-menu">
                  <button
                    type="button"
                    className="host-table-menu-button"
                    aria-label="Host controls"
                    aria-expanded={hostMenuOpen}
                    onClick={toggleHostMenu}
                  >
                    <span />
                    <span />
                    <span />
                  </button>
                  {hostMenuOpen ? (
                    <div className="host-table-menu-popover">
                      <div className="host-table-menu-title">Host controls</div>
                      <div className="host-table-menu-row">
                        <label className="mini-field">
                          <span>Cards</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={dealCount}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              setDealCount(
                                Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1
                              );
                            }}
                            disabled={isBusy}
                          />
                        </label>
                        <button
                          type="button"
                          className="deal-button"
                          onClick={() => {
                            props.actions?.onDealCards?.(dealCount);
                            setHostMenuOpen(false);
                          }}
                          disabled={isBusy || !props.actions?.onDealCards}
                        >
                          {pendingAction === "deal_cards" ? "Dealing..." : "Deal"}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="host-table-action"
                        onClick={() => {
                          props.actions?.onResetTable?.();
                          setHostMenuOpen(false);
                        }}
                        disabled={isBusy || !props.actions?.onResetTable}
                      >
                        {pendingAction === "reset_table" ? "Resetting..." : "Reset table"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {sharedCards.length ? (
                <ul className="table-card-cloud">
                  {sharedCards.map((card) => (
                    <li
                      key={card.id}
                      className="table-card"
                      draggable={!isBusy}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        beginDrag(card.id, "table");
                      }}
                      onDragEnd={endDrag}
                      style={{
                        left: `${card.x * 100}%`,
                        top: `${card.y * 100}%`,
                        zIndex: card.zIndex
                      }}
                    >
                      <CardFace card={card} tilt={getTableCardTilt(card)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <DropHint
                  title="Drag cards here"
                  body="Drop cards anywhere on the felt, then drag them around freely."
                  enabled={tableDropEnabled || dragState?.source === "hand" || dragState?.source === "table"}
                />
              )}

              <div className="felt-pile felt-pile-draw" aria-label="Draw pile">
                <span className="pile-label">Draw</span>
                <div
                  className={["stack-card", "draw-stack-card", props.publicSnapshot.deckCount ? "draw-stack-draggable" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  draggable={!isBusy && props.publicSnapshot.deckCount > 0}
                  onDragStart={(event) => {
                    if (props.publicSnapshot.deckCount === 0) {
                      return;
                    }

                    event.dataTransfer.effectAllowed = "move";
                    beginDrag(null, "draw");
                  }}
                  onDragEnd={endDrag}
                />
                <strong>{props.publicSnapshot.deckCount}</strong>
              </div>

              <DropZone
                className="felt-pile felt-pile-discard"
                label="Discard"
                target="discard"
                enabled={discardDropEnabled}
                active={hoverTarget === "discard"}
                onDrop={handleDrop}
                onHover={setHoverTarget}
              >
                <div className="discard-stack">
                  {discardTopCard ? (
                    <div
                      draggable={!isBusy}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        beginDrag(null, "discard");
                      }}
                      onDragEnd={endDrag}
                    >
                      <CardFace card={discardTopCard} compact />
                    </div>
                  ) : (
                    <div className="stack-card" />
                  )}
                </div>
                <strong>{props.publicSnapshot.discardCount}</strong>
              </DropZone>
            </DropZone>

            <div className="table-legend">
              <span>{props.publicSnapshot.sharedPlayArea.length} cards on table</span>
              <span>{discardTopCard ? `Top discard: ${formatCard(discardTopCard)}` : "Discard pile empty"}</span>
              {dragState?.source === "draw" ? <span>Dragging: draw pile</span> : null}
              {dragState?.source === "discard" ? <span>Dragging: discard pile</span> : null}
              {dragPreview ? <span>Dragging: {formatCard(dragPreview)}</span> : null}
            </div>
          </section>
        </section>

        <DropZone
          label="Your hand"
          target="hand"
          enabled={handDropEnabled}
          active={hoverTarget === "hand"}
          onDrop={handleDrop}
          onHover={setHoverTarget}
        >
          <section className="hand-rail">
            <div className="hand-header">
              <div className="hand-menu">
                <button
                  type="button"
                  className="hand-menu-button"
                  aria-label="Sort hand"
                  aria-expanded={handMenuOpen}
                  onClick={() => setHandMenuOpen((currentValue) => !currentValue)}
                >
                  <span />
                  <span />
                  <span />
                </button>
                {handMenuOpen ? (
                  <div className="hand-menu-popover">
                    <div className="hand-menu-title">Sort By</div>
                    {HAND_SORT_GROUPS.map((group) => (
                      <div key={group.label} className="hand-menu-group">
                        <button
                          type="button"
                          className={[
                            "hand-menu-option",
                            group.options.some((option) => option.mode === handSortMode)
                              ? "hand-menu-option-active"
                              : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span>{group.label}</span>
                          <span className="hand-menu-chevron">›</span>
                        </button>
                        <div className="hand-submenu">
                          {group.options.map((option) => (
                            <button
                              key={option.mode}
                              type="button"
                              className={[
                                "hand-menu-option",
                                "hand-submenu-option",
                                handSortMode === option.mode ? "hand-menu-option-active" : ""
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => {
                                setHandSortMode(option.mode);
                                setHandMenuOpen(false);
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="hand-count">{orderedViewerHand.length} cards</span>
            </div>

          {orderedViewerHand.length ? (
            <ul className="hand-fan" onDragOver={handleHandDragOver} onDrop={handleHandDrop}>
              {orderedViewerHand.map((card, index) => (
                <li
                  key={card.id}
                  className="hand-card"
                  draggable={!isBusy}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    beginDrag(card.id, "hand");
                  }}
                  onDragEnd={endDrag}
                  style={{
                    transform: `translate(${handStartX + index * handCardSpacing}px, ${
                      Math.abs(index - (orderedViewerHand.length - 1) / 2) * 4 * handCardScale
                    }px) scale(${handCardScale}) rotate(${
                      (index - (orderedViewerHand.length - 1) / 2) * 2.5
                    }deg)`,
                    zIndex: index + 1
                  }}
                >
                  <CardFace card={card} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-hand">
              Drag from the draw pile to this area, or ask the host to deal cards to everyone.
            </div>
          )}
          </section>
        </DropZone>
      </section>
    </main>
  );
}

function DropZone(props: {
  active: boolean;
  className?: string;
  children: ReactNode;
  enabled: boolean;
  label: string;
  onDrop: (target: DropTarget, event: ReactDragEvent<HTMLDivElement>) => void;
  onHover: (target: DropTarget) => void;
  target: DropTarget;
}) {
  return (
    <div
      className={[
        "drop-zone",
        props.className ?? "",
        props.enabled ? "drop-enabled" : "",
        props.active ? "drop-active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(event) => {
        if (!props.enabled) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        props.onHover(props.target);
      }}
      onDragLeave={() => props.onHover(null)}
      onDrop={(event) => {
        if (!props.enabled) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        props.onDrop(props.target, event);
        props.onHover(null);
      }}
    >
      <span className="pile-label">{props.label}</span>
      {props.children}
    </div>
  );
}

function DropHint(props: { body: string; enabled: boolean; title: string }) {
  return (
    <div className={["drop-hint", props.enabled ? "drop-hint-active" : ""].filter(Boolean).join(" ")}>
      <strong>{props.title}</strong>
      <span>{props.body}</span>
    </div>
  );
}

function PlayerBadge(props: { player: PublicRoomSnapshot["players"][number] }) {
  return (
    <article className="player-badge">
      <div className="player-badge-head">
        <strong>{props.player.displayName}</strong>
        {props.player.isHost ? <span className="tiny-tag">Host</span> : null}
      </div>
      <div className="player-badge-body">
        <div className="card-back-strip" aria-hidden="true">
          {Array.from({ length: Math.max(1, Math.min(props.player.handCount, 5)) }).map((_, index) => (
            <span key={index} className="mini-back" />
          ))}
        </div>
        <span className={props.player.isConnected ? "status-on" : "status-off"}>
          {props.player.handCount} cards
        </span>
      </div>
    </article>
  );
}

function EmptySeat(props: { label: string }) {
  return <div className="empty-seat">{props.label}</div>;
}

function CardFace(props: { card: Card; compact?: boolean; tilt?: number }) {
  return (
    <div
      className={[
        "card-face",
        `card-face-${getSuitColor(props.card.suit)}`,
        props.compact ? "card-face-compact" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={props.tilt !== undefined ? { rotate: `${props.tilt}deg` } : undefined}
    >
      <span>{props.card.rank}</span>
      <span>{formatSuit(props.card.suit)}</span>
    </div>
  );
}

function formatSuit(suit: string) {
  return suit.slice(0, 1).toUpperCase() + suit.slice(1);
}

function formatCard(card: Card) {
  return `${card.rank} ${formatSuit(card.suit)}`;
}

function getSuitColor(suit: Card["suit"]) {
  return suit === "hearts" || suit === "diamonds" ? "red" : "black";
}

function toTableDropPosition(event: ReactDragEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  return applyFeltKeepClearZones({
    x: clamp(x, rect.width * 0.08, rect.width * 0.92),
    y: clamp(y, rect.height * 0.12, rect.height * 0.88)
  }, event.currentTarget, rect.width, rect.height);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function applyFeltKeepClearZones(
  position: { x: number; y: number },
  feltElement: HTMLDivElement,
  feltWidth: number,
  feltHeight: number
) {
  const halfCardWidth = 42;
  const halfCardHeight = 59;
  const leftPileRect = toRelativePileRect(
    feltElement,
    feltElement.querySelector(".felt-pile-draw")
  );
  const rightPileRect = toRelativePileRect(
    feltElement,
    feltElement.querySelector(".felt-pile-discard")
  );

  const adjustedPosition = leftPileRect
    ? pushOutsidePileRect(position, expandPileRect(leftPileRect, halfCardWidth, halfCardHeight), "right")
    : position;
  const finalPosition = rightPileRect
    ? pushOutsidePileRect(
        adjustedPosition,
        expandPileRect(rightPileRect, halfCardWidth, halfCardHeight),
        "left"
      )
    : adjustedPosition;

  return {
    x: finalPosition.x / feltWidth,
    y: finalPosition.y / feltHeight
  };
}

function expandPileRect(
  pileRect: { left: number; right: number; top: number; bottom: number },
  horizontalPadding: number,
  verticalPadding: number
) {
  return {
    left: pileRect.left - horizontalPadding,
    right: pileRect.right + horizontalPadding,
    top: pileRect.top - verticalPadding,
    bottom: pileRect.bottom + verticalPadding
  };
}

function toRelativePileRect(
  feltElement: HTMLDivElement,
  pileElement: Element | null
) {
  if (!(pileElement instanceof HTMLElement)) {
    return null;
  }

  const feltRect = feltElement.getBoundingClientRect();
  const pileRect = pileElement.getBoundingClientRect();

  return {
    left: pileRect.left - feltRect.left,
    right: pileRect.right - feltRect.left,
    top: pileRect.top - feltRect.top,
    bottom: pileRect.bottom - feltRect.top
  };
}

function pushOutsidePileRect(
  position: { x: number; y: number },
  pileRect: { left: number; right: number; top: number; bottom: number },
  horizontalExit: "left" | "right"
) {
  if (
    position.x < pileRect.left ||
    position.x > pileRect.right ||
    position.y < pileRect.top ||
    position.y > pileRect.bottom
  ) {
    return position;
  }

  const distanceToTop = Math.abs(position.y - pileRect.top);
  const distanceToHorizontalEdge =
    horizontalExit === "right"
      ? Math.abs(pileRect.right - position.x)
      : Math.abs(position.x - pileRect.left);

  if (distanceToTop <= distanceToHorizontalEdge) {
    return { x: position.x, y: pileRect.top };
  }

  return {
    x: horizontalExit === "right" ? pileRect.right : pileRect.left,
    y: position.y
  };
}

function getTableCardTilt(card: TableCard) {
  const seed = card.id
    .split("")
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return (seed % 9) - 4;
}

function deriveHandOrder(cards: Card[], currentOrder: string[], sortMode: HandSortMode) {
  if (sortMode !== "manual") {
    return sortHand(cards, sortMode).map((card) => card.id);
  }

  const existingIds = currentOrder.filter((cardId) => cards.some((card) => card.id === cardId));
  const incomingIds = cards
    .map((card) => card.id)
    .filter((cardId) => !existingIds.includes(cardId));

  return [...existingIds, ...incomingIds];
}

function orderCardsByIds(cards: Card[], orderedIds: string[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));

  return orderedIds
    .map((cardId) => byId.get(cardId))
    .filter((card): card is Card => Boolean(card));
}

function reorderHandIds(cardIds: string[], draggedCardId: string, nextIndex: number) {
  const currentIndex = cardIds.indexOf(draggedCardId);

  if (currentIndex === -1 || currentIndex === nextIndex) {
    return cardIds;
  }

  const nextOrder = [...cardIds];
  const [draggedCard] = nextOrder.splice(currentIndex, 1);
  nextOrder.splice(nextIndex, 0, draggedCard);
  return nextOrder;
}

function getHandInsertIndex(
  event: ReactDragEvent<HTMLUListElement>,
  cardCount: number,
  handStartX: number,
  handCardSpacing: number
) {
  if (cardCount <= 1) {
    return 0;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const centerOffsetX = event.clientX - rect.left - rect.width / 2;
  const rawIndex = Math.round((centerOffsetX - handStartX) / Math.max(handCardSpacing, 1));

  return clamp(rawIndex, 0, cardCount - 1);
}

function sortHand(cards: Card[], mode: HandSortMode) {
  const nextCards = [...cards];

  return nextCards.sort((left, right) => compareCards(left, right, mode));
}

function compareCards(left: Card, right: Card, mode: HandSortMode) {
  const rankDelta = rankValue(left.rank) - rankValue(right.rank);
  const suitDelta = suitValue(left.suit) - suitValue(right.suit);

  switch (mode) {
    case "rank_desc":
      return rankDelta !== 0 ? -rankDelta : -suitDelta;
    case "rank_asc":
      return rankDelta !== 0 ? rankDelta : suitDelta;
    case "suit_desc":
      return suitDelta !== 0 ? -suitDelta : -rankDelta;
    case "suit_asc":
      return suitDelta !== 0 ? suitDelta : rankDelta;
    case "manual":
      return 0;
  }
}

function rankValue(rank: Card["rank"]) {
  return ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].indexOf(rank);
}

function suitValue(suit: Card["suit"]) {
  return ["spades", "diamonds", "clubs", "hearts"].indexOf(suit);
}

const HAND_SORT_GROUPS: Array<{
  label: string;
  options: Array<{ label: string; mode: Exclude<HandSortMode, "manual"> }>;
}> = [
  {
    label: "Rank",
    options: [
      { label: "High to low", mode: "rank_desc" },
      { label: "Low to high", mode: "rank_asc" }
    ]
  },
  {
    label: "Suit",
    options: [
      { label: "High to low", mode: "suit_desc" },
      { label: "Low to high", mode: "suit_asc" }
    ]
  }
];
