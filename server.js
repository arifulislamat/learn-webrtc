/**
 * WebRTC Signaling Server
 *
 * A minimal WebSocket-based signaling server that relays SDP offers, answers,
 * and ICE candidates between WebRTC peers. It also serves the static HTML files.
 *
 * The signaling server is ONLY needed for the initial handshake. Once a
 * peer-to-peer connection is established, all data flows directly between
 * browsers — this server is no longer involved.
 *
 * @author Ariful Islam <https://arifulislamat.com>
 *
 * @usage
 *   npm install          # install dependencies
 *   npm start            # start the signaling server on port 8080
 *
 * @routes
 *   GET /       → auto.html  (auto-signaling mode)
 *   GET /auto   → auto.html
 *   GET /sender → sender.html (manual copy-paste mode)
 *   GET /receiver → receiver.html
 */

"use strict";

const { WebSocketServer } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0"; // Listen on all network interfaces (allows cross-device access)

// ────────────────────────────────────────────────────────────
// HTTP Server — serves static HTML files
// ────────────────────────────────────────────────────────────

const ROUTES = {
  "/": "auto.html",
  "/auto": "auto.html",
  "/sender": "sender.html",
  "/receiver": "receiver.html",
};

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
};

const httpServer = http.createServer((req, res) => {
  const fileName = ROUTES[req.url];

  if (!fileName) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 — Not Found");
    return;
  }

  const filePath = path.join(__dirname, fileName);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("500 — Internal Server Error");
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

// ────────────────────────────────────────────────────────────
// WebSocket Signaling Server
// ────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[ws] Client connected (total: ${clients.size})`);

  ws.on("message", (raw) => {
    const message = raw.toString();
    const preview = message.length > 80 ? message.slice(0, 80) + "…" : message;
    console.log(`[ws] Relaying: ${preview}`);

    // Broadcast to every OTHER connected client
    for (const client of clients) {
      if (client !== ws && client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(message);
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[ws] Client disconnected (total: ${clients.size})`);
  });

  ws.on("error", (err) => {
    console.error("[ws] Error:", err.message);
  });
});

// ────────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────────

httpServer.listen(PORT, HOST, () => {
  const os = require("os");
  const nets = os.networkInterfaces();
  const lanAddresses = Object.values(nets)
    .flat()
    .filter((i) => i.family === "IPv4" && !i.internal);

  console.log();
  console.log("  🚀 WebRTC Signaling Server");
  console.log("  ─────────────────────────────");
  console.log(`  Local:        http://localhost:${PORT}/`);
  lanAddresses.forEach((i) => {
    console.log(`  Network:      http://${i.address}:${PORT}/`);
  });
  console.log();
  console.log("  Auto mode:    /         (open in two tabs)");
  console.log("  Manual mode:  /sender   + /receiver");
  if (lanAddresses.length > 0) {
    console.log();
    console.log(
      "  📱 Open the Network URL on another device to test cross-device.",
    );
  }
  console.log();
});
