const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Socket.io Authentication Middleware ---
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'supersecret'; // Use an env var in production

io.use((socket, next) => {
  const token = socket.handshake.headers['x-admin-auth'];
  if (token === ADMIN_SECRET) {
    next();
  } else {
    console.log('Socket connection denied: Invalid admin secret.');
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('An admin client connected.');
  socket.on('disconnect', () => {
    console.log('An admin client disconnected.');
  });
});


const studentVerification = require('./student_verification')(io);

// --- Configuration ---
app.use(express.static('../public'));
app.use(express.json());

// --- Endpoints ---
app.use('/student', studentVerification);

app.post('/create-checkout-session', async (req, res) => {
  res.status(501).json({ error: 'Not implemented for this task' });
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
