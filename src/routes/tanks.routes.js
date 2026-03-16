const express = require('express');
const router = express.Router();
const { postVolume } = require('../controllers/tank.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const rateLimiter = require('../middlewares/rateLimiter');

// POST /api/tanks/volume (protégée, avec rate limiting)
router.post('/volume', requireAuth, rateLimiter.middleware(), postVolume);

module.exports = router;
