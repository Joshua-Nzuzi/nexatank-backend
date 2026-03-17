const tankService = require('../services/tankService');
const cacheService = require('../services/cacheService');

/**
 * GET /api/tanks
 * Récupère la liste dynamique des cuves et les dernières mesures
 */
async function getTanks(req, res) {
  try {
    // 1. Récupération des cuves réelles (JOIN tanks + tank_types)
    const tanks = await tankService.getAllTanks();
    
    // 2. Récupération des 5 dernières mesures pour le Dashboard Gérant
    const recentMeasures = await tankService.getRecentMeasurements(5);

    res.status(200).json({ 
      success: true, 
      tanks: tanks,
      recentMeasures: recentMeasures 
    });
  } catch (err) {
    console.error('getTanks controller error:', err.message || err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des données des cuves' 
    });
  }
}

/**
 * POST /api/tanks/volume
 * Calcule le volume, l'enregistre dans l'historique et met à jour la cuve
 */
async function postVolume(req, res) {
  try {
    const { tank_id, depth_cm } = req.body;

    // Validation des entrées
    if (!tank_id || depth_cm === undefined || depth_cm === null) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants: tank_id et depth_cm requis' });
    }

    const tankId = Number(tank_id);
    const depth = Number(depth_cm);

    if (!Number.isInteger(tankId) || tankId <= 0) {
      return res.status(400).json({ success: false, message: 'tank_id invalide' });
    }

    if (Number.isNaN(depth) || depth < 0) {
      return res.status(400).json({ success: false, message: 'profondeur invalide' });
    }

    // Vérification de l'existence de la cuve fixe
    const tankExists = await tankService.validateTankExists(tankId);
    if (!tankExists) {
      return res.status(404).json({ success: false, message: 'Cuve non trouvée en base de données' });
    }

    // Gestion du Cache pour optimiser les appels SQL répétitifs
    const cacheKey = cacheService.generateKey(tankId, depth);
    let rawVolume = cacheService.get(cacheKey);

    if (rawVolume === null) {
      // Appel à la fonction PostgreSQL immuable
      rawVolume = await tankService.getVolumeByDepth(tankId, depth);
      cacheService.set(cacheKey, rawVolume, 60000); // Cache de 1 minute
    }

    // Gestion des messages spéciaux renvoyés par la fonction SQL
    const specialMessages = new Set(['Charte vide', 'Aucun volume mesurable', 'Volume non pris en charge']);
    if (rawVolume === null || specialMessages.has(String(rawVolume))) {
      return res.status(200).json({ 
        success: true, 
        volume: null, 
        message: String(rawVolume) || 'Calcul impossible' 
      });
    }

    const volumeInt = Math.round(Number(rawVolume));

    // ENREGISTREMENT ET SYNCHRONISATION
    // L'userId provient du token décodé par le middleware requireAuth
    try {
      const userId = req.user && req.user.id ? req.user.id : null;
      if (userId) {
        // Enregistre la mesure ET met à jour la colonne current_volume de la cuve
        await tankService.saveMeasurement(tankId, userId, depth, volumeInt);
      }
    } catch (saveErr) {
      console.error('Erreur enregistrement measurement:', saveErr.message || saveErr);
      // On continue pour renvoyer au moins le volume à l'utilisateur
    }

    return res.status(200).json({ 
      success: true, 
      volume: volumeInt 
    });

  } catch (err) {
    console.error('postVolume controller error:', err.message || err);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors du calcul du volume' 
    });
  }
}

module.exports = {
  getTanks,
  postVolume,
};