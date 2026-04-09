import type { PublicRoomSnapshot } from "@open-deck/shared";

const foundationMessage =
  "Workspace foundation is ready. Lobby and tabletop flows land in later slices.";

const sampleSnapshot: Pick<PublicRoomSnapshot, "deckCount" | "discardCount"> = {
  deckCount: 52,
  discardCount: 0
};

export function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Open Deck</p>
        <h1>Shared cards, simple architecture, room for real-time play.</h1>
        <p className="body-copy">{foundationMessage}</p>
        <dl className="stats">
          <div>
            <dt>Deck</dt>
            <dd>{sampleSnapshot.deckCount} cards</dd>
          </div>
          <div>
            <dt>Discard</dt>
            <dd>{sampleSnapshot.discardCount} cards</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

