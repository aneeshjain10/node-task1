const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User'); // make sure path is correct

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err.message));

// HTTP server + Socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let liveUsers = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', async (userId) => {
    const user = await User.findById(userId);
    if (!user) return;

    socket.join('live_users');

    // Add to live users
    liveUsers.push({
      socketId: socket.id,
      email: user.emailId,
      name: user.firstName + ' ' + user.lastName
    });

    io.to('live_users').emit('liveUsers', liveUsers);
  });

  socket.on('disconnect', () => {
    liveUsers = liveUsers.filter(u => u.socketId !== socket.id);
    io.to('live_users').emit('liveUsers', liveUsers);
  });
});

// Register API
app.post('/api/register', async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully!', userId: newUser._id });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Email or Login ID already exists' });
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

// Read all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user by email
app.get('/api/users/:email', async (req, res) => {
  try {
    const user = await User.findOne({ emailId: req.params.email }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start server
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
