exports.up = async function (knex) {
  // Crée un INDEX UNIQUE avec DATE_TRUNC pour empêcher les mesures dupliquées à la seconde près
  await knex.raw(`
    CREATE UNIQUE INDEX unique_tank_user_measured_at_idx 
    ON public.measurements (tank_id, user_id, DATE_TRUNC('second', measured_at));
  `);
};

exports.down = async function (knex) {
  // Supprime l'index si on revient en arrière
  await knex.raw(`
    DROP INDEX IF EXISTS public.unique_tank_user_measured_at_idx;
  `);
};
