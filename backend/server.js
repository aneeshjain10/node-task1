require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(express.json());

// CORS setup
const frontendOrigins = (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5501,http://localhost:5501')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // e.g., Postman
    if (frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed.'));
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// Only for local testing: serve frontend
// ❌ Remove or comment this line when using Netlify
// app.use(express.static('../frontend'));

// MongoDB connect
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Validation helpers
const isAlpha = (s) => /^[A-Za-z ]+$/.test(s || '');
const isMobile = (s) => /^\d{10}$/.test(s || '');
const isLoginId = (s) => /^[A-Za-z0-9]{8}$/.test(s || '');
const isPassword = (s) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{6,}$/.test(s || '');
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');

// Schema
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  mobileNo: { type: String, required: true },
  emailId: { type: String, required: true, unique: true },
  address: {
    street: String,
    city: String,
    state: String,
    country: String
  },
  loginId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// HTTP + Socket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendOrigins,
    methods: ['GET', 'POST']
  }
});

// Live users
let liveUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinLive', ({ email, name }) => {
    if (email && name) {
      liveUsers[socket.id] = { email, name, socketId: socket.id };
      socket.join('live_users');
      io.to('live_users').emit('updateUsers', Object.values(liveUsers));
      console.log('joinLive:', email);
    }
  });

  socket.on('disconnect', () => {
    if (liveUsers[socket.id]) {
      delete liveUsers[socket.id];
      io.to('live_users').emit('updateUsers', Object.values(liveUsers));
    }
    console.log('User disconnected:', socket.id);
  });
});

// Register API
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, mobileNo, emailId, address = {}, loginId, password, socketId } = req.body;

    // Validations
    if (!firstName || !lastName) return res.status(400).json({ message: 'First and last name required' });
    if (!isAlpha(firstName) || !isAlpha(lastName)) return res.status(400).json({ message: 'Names must be alphabets only' });
    if (!isMobile(mobileNo)) return res.status(400).json({ message: 'Mobile must be 10 digits' });
    if (!isEmail(emailId)) return res.status(400).json({ message: 'Invalid email' });
    if (address.city && !isAlpha(address.city)) return res.status(400).json({ message: 'City must be alphabets only' });
    if (address.state && !isAlpha(address.state)) return res.status(400).json({ message: 'State must be alphabets only' });
    if (address.country && !isAlpha(address.country)) return res.status(400).json({ message: 'Country must be alphabets only' });
    if (!isLoginId(loginId)) return res.status(400).json({ message: 'Login ID must be 8 alphanumeric characters' });
    if (!isPassword(password)) return res.status(400).json({ message: 'Weak password' });

    const newUser = new User({
      firstName, lastName, mobileNo, emailId,
      address: {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        country: address.country || ''
      },
      loginId, password
    });

    await newUser.save();

    // Attach socket if provided
    if (socketId && io.sockets.sockets.get(socketId)) {
      liveUsers[socketId] = { email: emailId, name: firstName, socketId };
      io.sockets.sockets.get(socketId).join('live_users');
      io.to('live_users').emit('updateUsers', Object.values(liveUsers));
    }

    return res.json({ message: 'User saved successfully', userId: newUser._id });
  } catch (err) {
    console.error('Register Error:', err);
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate email or loginId' });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Users APIs
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/:email', async (req, res) => {
  try {
    const u = await User.findOne({ emailId: req.params.email });
    if (!u) return res.status(404).json({ message: 'User not found' });
    res.json(u);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Health route
app.get('/', (req, res) => res.send('Server is up ✅'));

// Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
