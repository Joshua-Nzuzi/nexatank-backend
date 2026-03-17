const knex = require('../db/knex');

/**
 * RÉCUPÈRE TOUTES LES CUVES (FIXES) AVEC LEUR TYPE RÉEL
 * Jointure entre 'tanks' et 'tank_types' pour avoir "Essence"/"Gazole"
 */
async function getAllTanks() {
  try {
    return await knex('tanks')
      .join('tank_types', 'tanks.type_id', 'tank_types.id')
      .select(
        'tanks.id',
        'tanks.name',
        'tanks.capacity',
        'tank_types.name as type', // Renvoie le libellé du type
        'tanks.current_volume'
      )
      .orderBy('tanks.id', 'asc');
  } catch (err) {
    console.error('Error fetching tanks:', err.message);
    throw err;
  }
}

/**
 * VÉRIFIE SI UNE CUVE EXISTE
 */
async function validateTankExists(tankId) {
  try {
    const result = await knex('tanks')
      .where('id', tankId)
      .select('id')
      .first();
    return !!result;
  } catch (err) {
    console.error('Error validating tank:', err.message);
    throw err;
  }
}

/**
 * APPELLE LA FONCTION POSTGRESQL POUR LE CALCUL DU VOLUME
 */
async function getVolumeByDepth(tankId, depthCm) {
  try {
    const sql = 'SELECT public.get_tank_capacity_by_depth_cm(?, ?) AS volume';
    const result = await knex.raw(sql, [tankId, depthCm]);

    if (result && result.rows && result.rows.length > 0) {
      return result.rows[0].volume; 
    }
    return null;
  } catch (err) {
    console.error('Error calculating volume via SQL function:', err.message);
    throw err;
  }
}

/**
 * ENREGISTRE LA MESURE ET MET À JOUR LE VOLUME ACTUEL DE LA CUVE
 * Utilise une transaction pour garantir que les deux opérations réussissent
 */
async function saveMeasurement(tankId, userId, depthCm, volumeLiters) {
  if (volumeLiters === null || volumeLiters === undefined || Number.isNaN(Number(volumeLiters))) {
    throw new Error('Volume non valide pour enregistrement');
  }

  const volumeInt = Math.round(Number(volumeLiters));

  return await knex.transaction(async (trx) => {
    // 1. Insertion dans l'historique (measurements)
    const payload = {
      tank_id: Number(tankId),
      user_id: Number(userId),
      measured_height_cm: Number(depthCm).toFixed(1),
      calculated_volume_liters: volumeInt,
    };
    
    const inserted = await trx('measurements').insert(payload).returning('id');

    // 2. Mise à jour du volume "temps réel" dans la table tanks
    await trx('tanks')
      .where('id', tankId)
      .update({ current_volume: volumeInt });

    return inserted && inserted.length > 0 ? inserted[0].id || inserted[0] : null;
  });
}

/**
 * RÉCUPÈRE LES DERNIÈRES MESURES POUR LE DASHBOARD GÉRANT
 */
async function getRecentMeasurements(limit = 3) {
  try {
    return await knex('measurements')
      .join('users', 'measurements.user_id', 'users.id')
      .join('tanks', 'measurements.tank_id', 'tanks.id')
      .select(
        'tanks.name as tank',
        'users.name as user',
        'measurements.measured_height_cm as depth',
        'measurements.calculated_volume_liters as volume',
        'measurements.measured_at as date'
      )
      .orderBy('measurements.measured_at', 'desc')
      .limit(limit);
  } catch (err) {
    console.error('Error fetching recent measurements:', err.message);
    throw err;
  }
}

module.exports = {
  getAllTanks,
  validateTankExists,
  getVolumeByDepth,
  saveMeasurement,
  getRecentMeasurements,
};