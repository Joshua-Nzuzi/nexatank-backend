const express = require('express');
const router = express.Router();
const { postVolume, getTanks } = require('../controllers/tank.controller'); // Ajout de getTanks
const { requireAuth } = require('../middlewares/auth.middleware');
const rateLimiter = require('../middlewares/rateLimiter');

// GET /api/tanks - Liste des cuves avec volume actuel (Public ou Protégé selon ton besoin)
router.get('/', getTanks);

// POST /api/tanks/volume (protégée, avec rate limiting)
router.post('/volume', requireAuth, rateLimiter.middleware(), postVolume);

module.exports = router;