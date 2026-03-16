const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');

const app = express();

/* =========================
   MIDDLEWARES GLOBAUX
========================= */
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(compression()); // Gzip compression for responses > 1KB

/* =========================
   HEALTH CHECK
========================= */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'NexaTank API',
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   ROUTES API
========================= */

// Authentification
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Tanks routes (calcul volume/hauteur)
const tanksRoutes = require('./routes/tanks.routes');
app.use('/api/tanks', tanksRoutes);

// Routes protégées (JWT + rôles)
const protectedRoutes = require('./routes/protected.routes');
app.use('/api', protectedRoutes);

/* =========================
   ROUTE 404 (sécurité)
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
  });
});

module.exports = app;
