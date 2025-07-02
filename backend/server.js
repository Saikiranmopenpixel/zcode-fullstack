const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db.js');
const colors = require('colors');

const addmessages = require('./utils/admessagetodb.js');
const { userJoin, userLeave, getCurrentUser, getRoomUsers } = require("./utils/socketusers.js");
const formatMessage = require("./utils/socketmessages.js");

const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();  

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create HTTP server and Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// API Routes
app.use('/contests', require('./routes/contestroute'));
app.use('/auth', require('./routes/authroute.js'));
app.use('/user', require('./routes/userroutes.js'));
app.use('/problems', require('./routes/problemsroute.js'));
app.use('/solutions', require('./routes/solutionroute.js'));
app.use('/rooms', require('./routes/roomroute.js'));
app.use('/messages', require('./routes/messagesroute.js'));

// ✅ Add this route to handle base URL
app.get('/', (req, res) => {
  res.send('Zcode backend is running ✅');
});

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('joinRoom', ({ id, handle }) => {
    const user = userJoin(socket.id, handle, id);

    socket.join(user.room);
    console.log(`${handle} joined room ${id}`);

    setTimeout(() => {
      socket.emit("recieve-message", formatMessage("Zcoder", "Welcome to the discussion room!"));
    }, 2000);

    socket.broadcast.to(user.room).emit("recieve-message", formatMessage("Zcoder", `${user.handle} has joined the chat`));

    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  socket.on("send-message", ({ handle, text }) => {
    const user = getCurrentUser(socket.id);
    socket.broadcast.to(user.room).emit("recieve-message", formatMessage(handle, text));
    addmessages(user.room, handle, text);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    const user = userLeave(socket.id);

    if (user) {
      socket.broadcast.to(user.room).emit("recieve-message", formatMessage("Zcoder", `${user.handle} has left the chat`));
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running with Socket.IO on http://localhost:${PORT}`);
});
