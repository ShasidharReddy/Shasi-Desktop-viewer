const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// rooms: code -> { host: socketId, viewers: [socketId] }
const rooms = new Map();

function generateCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, uptime: process.uptime() });
});

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // HOST: create a new room, get back a room code
  socket.on('create-room', (cb) => {
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (rooms.has(code) && attempts < 100);

    rooms.set(code, { host: socket.id, viewers: [] });
    socket.join(code);
    socket.roomCode = code;
    socket.role = 'host';
    console.log(`[Room] Created: ${code} by host ${socket.id}`);
    if (typeof cb === 'function') cb({ code });
  });

  // VIEWER: join an existing room via code
  socket.on('join-room', ({ code }, cb) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      if (typeof cb === 'function') cb({ error: 'Room not found. Check the code and try again.' });
      return;
    }
    room.viewers.push(socket.id);
    socket.join(code.toUpperCase());
    socket.roomCode = code.toUpperCase();
    socket.role = 'viewer';
    console.log(`[Room] Viewer ${socket.id} joined room ${code}`);

    // Tell the host a viewer is waiting
    io.to(room.host).emit('viewer-joined', { viewerId: socket.id });
    if (typeof cb === 'function') cb({ success: true, hostId: room.host });
  });

  // WebRTC signaling relay (offers, answers, ICE candidates)
  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data });
  });

  // Remote control events (viewer -> host)
  socket.on('control', ({ to, event }) => {
    io.to(to).emit('control', { from: socket.id, event });
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id} (${socket.role || 'unknown'})`);
    if (!socket.roomCode) return;
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    if (socket.role === 'host') {
      // Notify all viewers the host left
      socket.to(socket.roomCode).emit('host-disconnected');
      rooms.delete(socket.roomCode);
      console.log(`[Room] Closed: ${socket.roomCode}`);
    } else {
      room.viewers = room.viewers.filter(v => v !== socket.id);
      io.to(room.host).emit('viewer-left', { viewerId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('=== Secure System Signaling Server ===');
  console.log(`  Local:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Network: http://${ip}:${PORT}`));
  console.log('');
  console.log('Share a Network URL with the other laptop to connect.');
  console.log('');
});
