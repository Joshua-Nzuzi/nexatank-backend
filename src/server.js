const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares globaux
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);
const testRoutes = require('./routes/test.routes');
app.use('/api/test', testRoutes);

// Health check (Railway)
app.get('/health', (_, res) => {
  res.status(200).json({ status: 'OK', env: process.env.NODE_ENV });
});

// Server
console.log("🚀 NODE_ENV:", process.env.NODE_ENV);
console.log("🚀 DATABASE_URL:", process.env.DATABASE_URL);
console.log("🚀 PORT:", process.env.PORT);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NexaTank API running on port ${PORT}`);
});