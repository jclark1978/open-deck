import { CreateJoinForm } from "./components/CreateJoinForm";
import { RoomView } from "./components/RoomView";
import { useRoomSession } from "./hooks/useRoomSession";

export function App() {
  const roomSession = useRoomSession();

  if (roomSession.publicSnapshot) {
    return (
      <RoomView
        connectionState={roomSession.connectionState}
        displayName={roomSession.displayName}
        publicSnapshot={roomSession.publicSnapshot}
        viewer={roomSession.viewer}
        actions={{
          pendingAction: roomSession.pendingAction ?? null,
          onShuffleDeck: roomSession.shuffleDeck,
          onDealCards: roomSession.dealCards,
          onPlayCard: roomSession.playCard,
          onMoveToDiscard: roomSession.moveToDiscard
        }}
        onLeaveRoom={roomSession.leaveRoom}
      />
    );
  }

  return (
    <main className="app-shell">
      <CreateJoinForm
        connectionState={roomSession.connectionState}
        errorMessage={roomSession.errorMessage}
        onCreateRoom={roomSession.createRoom}
        onJoinRoom={roomSession.joinRoom}
      />
    </main>
  );
}
