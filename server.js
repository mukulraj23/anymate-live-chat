// server.js (Final Golden Copy with Report Logic)
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const Filter = require('bad-words');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const profanityFilter = new Filter();

const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

let waitingUser = null;
const activePairs = new Map();
const userWarnings = new Map();

const updateUserCount = () => {
  const count = io.engine.clientsCount;
  io.emit('userCountUpdate', count);
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  updateUserCount();

  socket.on('findPartner', () => {
    if (waitingUser === socket.id) return;
    if (waitingUser) {
      const partnerId = waitingUser;
      activePairs.set(socket.id, partnerId);
      activePairs.set(partnerId, socket.id);
      waitingUser = null;
      io.to(socket.id).emit('paired');
      io.to(partnerId).emit('paired');
    } else {
      waitingUser = socket.id;
      socket.emit('status', 'Waiting for a partner...');
    }
  });

  socket.on('message', (msg) => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;

    if (profanityFilter.isProfane(msg)) {
      let currentWarnings = userWarnings.get(socket.id) || 0;
      currentWarnings++;
      userWarnings.set(socket.id, currentWarnings);

      if (currentWarnings > 1) {
        io.to(socket.id).emit('forceDisconnect', 'You were disconnected for repeated use of inappropriate language.');
        io.to(partnerId).emit('partnerDisconnected');
        setTimeout(() => {
          io.sockets.sockets.get(socket.id)?.disconnect();
          io.sockets.sockets.get(partnerId)?.disconnect();
        }, 500);
      } else {
        io.to(socket.id).emit('status', 'Warning: Please do not use inappropriate language. Your message was not sent.');
      }
    } else {
      io.to(partnerId).emit('message', msg);
    }
  });

  socket.on('typing', () => { const partnerId = activePairs.get(socket.id); if (partnerId) io.to(partnerId).emit('partnerIsTyping'); });
  socket.on('stopTyping', () => { const partnerId = activePairs.get(socket.id); if (partnerId) io.to(partnerId).emit('partnerStoppedTyping'); });

  // ===== NEW: REPORT LOGIC =====
  socket.on('report', () => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      console.log(`User ${socket.id} reported partner ${partnerId}`);
      // Notify the reporter
      io.to(socket.id).emit('forceDisconnect', 'Your report has been submitted. Disconnecting.');
      // Warn and disconnect the partner
      io.to(partnerId).emit('forceDisconnect', 'You have been reported by your partner and disconnected.');

      setTimeout(() => {
        io.sockets.sockets.get(socket.id)?.disconnect();
        io.sockets.sockets.get(partnerId)?.disconnect();
      }, 500);
    }
  });

  const handleDisconnect = () => {
    console.log(`User disconnected: ${socket.id}`);
    userWarnings.delete(socket.id);
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partnerDisconnected');
      activePairs.delete(partnerId);
    }
    activePairs.delete(socket.id);
    if (waitingUser === socket.id) waitingUser = null;
    updateUserCount();
  };

  socket.on('disconnect', handleDisconnect);
  socket.on('manualDisconnect', handleDisconnect);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));