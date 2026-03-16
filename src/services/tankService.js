const knex = require('../db/knex');

async function validateTankExists(tankId) {
  try {
    const result = await knex('tanks')
      .where('id', tankId)
      .select('id')
      .limit(1);
    return result && result.length > 0;
  } catch (err) {
    console.error('Error validating tank:', err.message);
    throw err;
  }
}

async function getVolumeByDepth(tankId, depthCm) {
  try {
    const sql = 'SELECT public.get_tank_capacity_by_depth_cm(?, ?) AS volume';
    const result = await knex.raw(sql, [tankId, depthCm]);

    if (result && result.rows && result.rows.length > 0) {
      return result.rows[0].volume; // texte ou nombre en string
    }
    return null;
  } catch (err) {
    // remonter l'erreur pour que le controller la gère
    throw err;
  }
}

async function saveMeasurement(tankId, userId, depthCm, volumeLiters) {
  // n'insère que si volumeLiters est un nombre entier
  if (volumeLiters === null || volumeLiters === undefined || Number.isNaN(Number(volumeLiters))) {
    throw new Error('Volume non valide pour enregistrement');
  }

  const measured_height_cm = Number(depthCm).toFixed(1); // respect numeric(5,1)

  const payload = {
    tank_id: Number(tankId),
    user_id: Number(userId),
    measured_height_cm: measured_height_cm,
    calculated_volume_liters: Math.round(Number(volumeLiters)),
  };

  const inserted = await knex('measurements').insert(payload).returning('id');
  // returning('id') pour pg retourne array [{id:...}] en knex
  if (inserted && inserted.length > 0) return inserted[0].id || inserted[0];
  return null;
}

module.exports = {
  validateTankExists,
  getVolumeByDepth,
  saveMeasurement,
};
