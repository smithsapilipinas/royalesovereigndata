#!/usr/bin/env node
/**
 * ROYALE — Sovereign Gun.js Relay Node
 * Run this to strengthen the P2P network with your own relay.
 *
 * Usage:
 *   node scripts/gun-relay.js
 *   PORT=8765 node scripts/gun-relay.js
 *
 * Then add your relay URL to .env.local:
 *   NEXT_PUBLIC_GUN_PEERS=https://your-vps.com/gun,...
 */

const Gun = require('gun');
const http = require('http');
const express = require('express');

const PORT = process.env.PORT || 8765;
const app = express();

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'SOVEREIGN',
    relay: 'Royale Gun.js Relay Node',
    peers: Gun.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const server = http.createServer(app);

// Mount Gun relay
const gun = Gun({
  web: server,
  file: 'data/royale-relay',  // local persistence
  peers: [
    'https://gun-relay.ecko.me/gun',
    'https://gun-us.herokuapp.com/gun',
  ],
  // Limit relay storage (GB)
  localStorage: false,
  radisk: true,
});

server.listen(PORT, () => {
  console.log(`\n◈ ROYALE RELAY NODE — ONLINE`);
  console.log(`  Listening on port ${PORT}`);
  console.log(`  Gun.js P2P relay active`);
  console.log(`  Add to .env.local:`);
  console.log(`  NEXT_PUBLIC_GUN_PEERS=http://localhost:${PORT}/gun,...\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n◈ Relay shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\n◈ Relay shutting down gracefully...');
  server.close(() => process.exit(0));
});
