const { validateTankExists, getVolumeByDepth, saveMeasurement } = require('../services/tankService');
const cacheService = require('../services/cacheService');

async function postVolume(req, res) {
  try {
    const { tank_id, depth_cm } = req.body;

    if (!tank_id || depth_cm === undefined || depth_cm === null) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants: tank_id et depth_cm requis' });
    }

    const tankId = Number(tank_id);
    const depth = Number(depth_cm);

    if (!Number.isInteger(tankId) || tankId <= 0) {
      return res.status(400).json({ success: false, message: 'tank_id invalide' });
    }

    if (Number.isNaN(depth) || depth < 0) {
      return res.status(400).json({ success: false, message: 'depth_cm invalide' });
    }

    // Validate that tank exists (prevents calculations on non-existent tanks)
    const tankExists = await validateTankExists(tankId);
    if (!tankExists) {
      return res.status(404).json({
        success: false,
        message: 'Tank non trouvé'
      });
    }

    // Try to get from cache first
    const cacheKey = cacheService.generateKey(tankId, depth);
    let rawVolume = cacheService.get(cacheKey);

    // If not in cache, compute and cache
    if (rawVolume === null) {
      rawVolume = await getVolumeByDepth(tankId, depth);
      cacheService.set(cacheKey, rawVolume, 60000); // Cache for 60 seconds
    }

    // Cas où la fonction SQL retourne un message explicite
    const specialMessages = new Set(['Charte vide', 'Aucun volume mesurable', 'Volume non pris en charge']);

    if (rawVolume === null || specialMessages.has(String(rawVolume))) {
      return res.status(200).json({ success: true, volume: null, message: String(rawVolume) });
    }

    const volumeInt = Math.round(Number(rawVolume));

    // Enregistre la mesure pour historique (user venant du middleware requireAuth)
    try {
      const userId = req.user && req.user.id ? req.user.id : null;
      if (userId) {
        await saveMeasurement(tankId, userId, depth, volumeInt);
      }
    } catch (saveErr) {
      // PostgreSQL UNIQUE constraint violation (code 23505)
      if (saveErr.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Une mesure avec le même timestamp existe déjà pour ce tank/utilisateur. Attendez au moins 1 seconde avant de réessayer.',
          errorCode: 'DUPLICATE_MEASUREMENT'
        });
      }
      console.error('Erreur enregistrement measurement:', saveErr.message || saveErr);
      // Ne bloquons pas la requête principale si l'enregistrement échoue pour d'autres raisons
    }

    return res.status(200).json({ success: true, volume: volumeInt });
  } catch (err) {
    console.error('postVolume error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  postVolume,
};
