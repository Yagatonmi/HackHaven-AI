const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const verifySocketAuth = require('./utils/verifySocketAuth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- In-Memory Data Stores ---
let pendingStudents = [];
let verificationTokens = new Map();

// --- Socket.io Middleware and Connection Handling ---
io.use(verifySocketAuth);

io.on('connection', (socket) => {
  const { user } = socket;
  console.log(`[socket.io] A user connected with role: ${user.role}`);

  if (user.role === 'admin') {
    socket.join('admins');
  } else if (user.role === 'student') {
    socket.join(`student:${user.id}`);
  }

  socket.on('disconnect', () => {
    console.log(`[socket.io] User ${user.email} disconnected.`);
  });
});

const studentVerification = require('./student_verification')({ io, pendingStudents, verificationTokens });
const auth = require('./auth'); // Import the new auth router

app.use(express.static('../public'));
app.use(express.json());
app.use('/student', studentVerification);
app.use('/auth', auth); // Mount the auth router

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
