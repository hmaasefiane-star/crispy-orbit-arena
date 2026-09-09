const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const players = new Map();

const spawns = [
  [-35, -35],
  [35, -35],
  [-35, 35],
  [35, 35],
  [0, -45],
  [0, 45],
  [-45, 0],
  [45, 0]
];

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  const message = JSON.stringify(data);

  for (const player of players.values()) {
    if (player.ws.readyState === 1) {
      player.ws.send(message);
    }
  }
}

function playerData(p) {
  return {
    id: p.id,
    x: p.x,
    z: p.z,
    yaw: p.yaw,
    hp: p.hp,
    maxHp: 3,
    alive: p.alive,
    score: p.score,
    name: p.name
  };
}

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("🍗 Crispy Orbit Multiplayer Server is ONLINE!");
});

const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).substring(2, 9);

  const spawn = spawns[players.size % spawns.length];

  const player = {
    ws,
    id,
    x: spawn[0],
    z: spawn[1],
    yaw: 0,
    hp: 3,
    alive: true,
    score: 0,
    name: "Crispy-" + id.substring(0, 3),
    lastHit: 0,
    respawnAt: 0
  };

  players.set(id, player);

  send(ws, {
    type: "welcome",
    self: id,
    players: [...players.values()].map(playerData)
  });

  broadcast({
    type: "join",
    player: playerData(player)
  });

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw);

      if (message.type === "input") {
        player.x = Number(message.x) || 0;
        player.z = Number(message.z) || 0;
        player.yaw = Number(message.yaw) || 0;

        player.x = Math.max(-96, Math.min(96, player.x));
        player.z = Math.max(-96, Math.min(96, player.z));
      }

      if (message.type === "hit") {
        const target = players.get(message.target);

        if (!target || !target.alive || !player.alive) return;

        const now = Date.now();

        if (now - player.lastHit < 300) return;

        const distance = Math.hypot(
          player.x - target.x,
          player.z - target.z
        );

        if (distance < 3) {
          player.lastHit = now;

          target.hp--;

          if (target.hp <= 0) {
            target.hp = 0;
            target.alive = false;
            target.respawnAt = Date.now() + 2000;

            player.score++;

            broadcast({
              type: "destroyed",
              by: player.id,
              target: target.id
            });
          }
        }
      }
    } catch (error) {
      console.log("Bad message");
    }
  });

  ws.on("close", () => {
    players.delete(id);

    broadcast({
      type: "leave",
      id
    });
  });
});

setInterval(() => {
  const now = Date.now();

  for (const player of players.values()) {
    if (!player.alive && now >= player.respawnAt) {
      const spawn =
        spawns[Math.floor(Math.random() * spawns.length)];

      player.x = spawn[0];
      player.z = spawn[1];
      player.hp = 3;
      player.alive = true;

      broadcast({
        type: "respawn",
        player: playerData(player)
      });
    }
  }

  broadcast({
    type: "state",
    players: [...players.values()].map(playerData)
  });
}, 50);

server.listen(PORT, () => {
  console.log(
    `🍗 Crispy Orbit server running on port ${PORT}`
  );
});
