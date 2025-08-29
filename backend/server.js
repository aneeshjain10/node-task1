require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('../frontend')); // Serve frontend files

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB User model (adjust as per your schema)
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  mobileNo: String,
  emailId: String,
  address: {
    street: String,
    city: String,
    state: String,
    country: String
  },
  loginId: String,
  password: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// HTTP server + Socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Live users array
let liveUsers = [];

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinLive', (user) => {
    liveUsers.push({ ...user, socketId: socket.id });
    io.emit('updateUsers', liveUsers);
  });

  socket.on('disconnect', () => {
    liveUsers = liveUsers.filter(u => u.socketId !== socket.id);
    io.emit('updateUsers', liveUsers);
  });
});

// Routes

// Task 1: Register user
app.post('/api/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json({ message: 'User saved successfully', userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Get user by email
app.get('/api/users/:email', async (req, res) => {
  const user = await User.findOne({ emailId: req.params.email });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
