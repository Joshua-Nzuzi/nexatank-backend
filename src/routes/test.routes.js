const express = require('express');
const router = express.Router();
const pool = require('../db'); // ton db/index.js

// Route test DB
router.get('/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()'); // récupère l'heure du serveur PostgreSQL
    res.json({ serverTime: result.rows[0].now });
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
    res.status(500).json({ error: 'DB connection failed' });
  }
});

module.exports = router;