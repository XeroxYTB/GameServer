import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

let nextPeerId = 1;
const peers = new Map(); // peerId -> WebSocket

console.log(`✅ Serveur WebSocket lancé sur ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const peerId = nextPeerId++;
  peers.set(peerId, ws);

  console.log(`🟢 Peer connecté : ID ${peerId}`);
  sendTo(ws, { type: 'id', id: peerId });

  // Informer tous les autres de la nouvelle connexion
  broadcast({ type: 'peer_connected', id: peerId }, peerId);

  // Relayer les messages entre pairs
  ws.on('message', (data) => {
    // On suppose que Godot envoie du binaire
    for (const [otherId, client] of peers) {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(data);
      }
    }
  });

  ws.on('close', () => {
    console.log(`🔴 Peer déconnecté : ID ${peerId}`);
    peers.delete(peerId);
    broadcast({ type: 'peer_disconnected', id: peerId });
  });
});

function sendTo(ws, obj) {
  ws.send(JSON.stringify(obj));
}

function broadcast(obj, excludeId = null) {
  const msg = JSON.stringify(obj);
  for (const [id, client] of peers) {
    if (id !== excludeId && client.readyState === client.OPEN) {
      client.send(msg);
    }
  }
}
