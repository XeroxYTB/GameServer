import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

let nextClientId = 1;
const lobbies = new Map(); // Map<lobbyId, Set<client>>
const clients = new Map(); // Map<ws, { id, lobby }>

console.log(`✅ Serveur WebSocket multi-salon lancé sur ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const clientId = nextClientId++;
  console.log(`🟢 Client connecté, ID ${clientId}`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'host') {
        const lobbyId = parseInt(msg.lobby_id);
        if (isNaN(lobbyId)) return;

        if (!lobbies.has(lobbyId)) {
          lobbies.set(lobbyId, new Set());
        }

        clients.set(ws, { id: clientId, lobby: lobbyId });
        lobbies.get(lobbyId).add(ws);

        send(ws, {
          type: 'host_confirmed',
          client_id: clientId,
          lobby_id: lobbyId,
        });

        broadcast_lobby_list(lobbyId);
        console.log(`📦 Salon ${lobbyId} hébergé par ${clientId}`);
      }

      else if (msg.type === 'join') {
        const lobbyId = parseInt(msg.lobby_id);
        if (!lobbies.has(lobbyId)) {
          send(ws, { type: 'error', message: 'Salon inexistant.' });
          return;
        }

        clients.set(ws, { id: clientId, lobby: lobbyId });
        lobbies.get(lobbyId).add(ws);

        send(ws, {
          type: 'join_confirmed',
          client_id: clientId,
          lobby_id: lobbyId,
        });

        broadcast_lobby_list(lobbyId);
        console.log(`👤 Client ${clientId} rejoint salon ${lobbyId}`);
      }

      // Transfert des paquets binaires Godot
      else if (msg.type === 'relay' && clients.has(ws)) {
        const lobbyId = clients.get(ws).lobby;
        for (const peer of lobbies.get(lobbyId)) {
          if (peer !== ws && peer.readyState === peer.OPEN) {
            peer.send(msg.data); // Peut être du texte ou du binaire
          }
        }
      }

    } catch (err) {
      console.error('❌ Erreur dans le message :', err);
    }
  });

  ws.on('close', () => {
    if (!clients.has(ws)) return;
    const { id, lobby } = clients.get(ws);
    clients.delete(ws);

    const set = lobbies.get(lobby);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        lobbies.delete(lobby);
        console.log(`❌ Salon ${lobby} fermé (dernier joueur quitté)`);
      } else {
        broadcast_lobby_list(lobby);
      }
    }

    console.log(`🔴 Client ${id} déconnecté`);
  });
});

function send(ws, obj) {
  ws.send(JSON.stringify(obj));
}

function broadcast_lobby_list(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  const players = [];
  for (const client of lobby) {
    const { id } = clients.get(client);
    players.push(id);
  }
  for (const client of lobby) {
    send(client, {
      type: 'lobby_update',
      players,
      lobby_id: lobbyId,
    });
  }
}
