const WebSocket = require("ws");
const http = require("http");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("✅ Client connecté");

  ws.on("message", (message) => {
    for (let client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("❌ Client déconnecté");
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  const hostname =
    process.env.RAILWAY_STATIC_URL || // Railway
    process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : "localhost";

  const protocol = hostname.startsWith("localhost") ? "ws" : "wss";
  const url = `${protocol}://${hostname}${PORT === 80 || hostname !== "localhost" ? "" : `:${PORT}`}`;

  console.log("🚀 Serveur WebSocket lancé !");
  console.log(`🔗 Adresse WebSocket à utiliser dans Godot : ${url}`);
});
