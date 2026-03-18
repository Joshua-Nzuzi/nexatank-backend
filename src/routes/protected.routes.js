const express = require('express');
const router = express.Router();
const pool = require('../db'); // Connexion PostgreSQL directe
const tankService = require('../services/tankService'); // Service pour les mesures

const {
  requireAuth,
  adminOnly,
  superAdminOnly,
} = require('../middlewares/auth.middleware');

/* =============================================================
   ROUTES DE TEST (EXISTANTES)
   ============================================================= */

router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Utilisateur authentifié',
    user: req.user,
  });
});

router.get('/admin', requireAuth, adminOnly, (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue gérant',
  });
});

router.get('/super-admin', requireAuth, superAdminOnly, (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue Super Admin Joshua',
  });
});

/* =============================================================
   GESTION DES UTILISATEURS (SUPER ADMIN SEULEMENT)
   ============================================================= */

// GET /api/users - Liste tous les utilisateurs
router.get('/users', requireAuth, superAdminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, role, phone, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({
      success: true,
      users: result.rows
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/users/:id - Supprimer un compte définitivement
router.delete('/users/:id', requireAuth, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({
      success: true,
      message: 'Compte utilisateur supprimé avec succès'
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/* =============================================================
   HISTORIQUE GLOBAL DES MESURES (TOUS ROLES AUTHENTIFIÉS)
   ============================================================= */

// GET /api/measurements - Historique complet des mesures (hauteur + volume)
router.get('/measurements', requireAuth, async (req, res) => {
  try {
    // On récupère les 50 dernières mesures via le service
    const measurements = await tankService.getRecentMeasurements(50);
    res.json({
      success: true,
      measurements: measurements
    });
  } catch (err) {
    console.error('Error fetching measurements:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;