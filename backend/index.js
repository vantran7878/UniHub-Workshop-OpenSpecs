const express = require('express');
require('dotenv').config();
const authRoutes = require('./src/routes/authRoutes');
const checkinRoutes = require('./src/routes/checkinRoutes');
const summaryRoutes = require('./src/routes/summaryRoutes');
const userRoutes = require('./src/routes/userRoutes');
const { verifyJWT, checkBlacklist, loadUser, requireRole } = require('./src/middleware/authMiddleware');
const { connectRabbitMQ } = require('./src/config/rabbitmq');

const app = express();
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/checkin', checkinRoutes);
app.use('/api/workshops', summaryRoutes);
app.use('/api/users', userRoutes);

// Initialize RabbitMQ
connectRabbitMQ().catch(err => console.error('RabbitMQ initial connection failed:', err));

// Protected example route
app.get('/api/admin/dashboard', 
  verifyJWT, 
  checkBlacklist, 
  loadUser, 
  requireRole('admin'), 
  (req, res) => {
    res.json({ message: 'Welcome to the admin dashboard' });
  }
);

app.get('/api/student/profile',
  verifyJWT,
  checkBlacklist,
  loadUser,
  requireRole('student', 'admin'),
  (req, res) => {
    res.json({ message: `Hello ${req.user.fullName}` });
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
