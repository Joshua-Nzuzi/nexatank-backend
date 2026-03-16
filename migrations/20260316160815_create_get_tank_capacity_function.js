exports.up = async function (knex) {
  await knex.raw(`
CREATE OR REPLACE FUNCTION public.get_tank_capacity_by_depth_cm(
    p_tank_id integer,
    p_depth_cm numeric
)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    depth_cm_trimmed numeric := TRUNC(p_depth_cm, 1);          -- ne garder qu'une décimale
    depth_mm integer := (depth_cm_trimmed * 10)::integer;      -- conversion en mm
    v_min_depth integer;
    v_max_depth integer;
    exact_volume numeric;
    low_d integer; low_v numeric;
    high_d integer; high_v numeric;
    decimal_digit integer;
    frac numeric;
    interp_volume numeric;
BEGIN
    SELECT MIN(depth), MAX(depth)
    INTO v_min_depth, v_max_depth
    FROM tank_chart_point
    WHERE tank_id = p_tank_id;

    IF v_min_depth IS NULL OR v_max_depth IS NULL THEN
        RETURN 'Charte vide';
    END IF;

    IF depth_mm = 0 THEN
        RETURN 'Aucun volume mesurable';
    ELSIF depth_mm < v_min_depth OR depth_mm > v_max_depth THEN
        RETURN 'Volume non pris en charge';
    END IF;

    -- cas exact
    SELECT volume INTO exact_volume
    FROM tank_chart_point
    WHERE tank_id = p_tank_id AND depth = depth_mm AND volume IS NOT NULL
    LIMIT 1;

    IF exact_volume IS NOT NULL THEN
        RETURN ROUND(exact_volume)::integer::text; -- arrondi standard
    END IF;

    -- point inférieur
    SELECT depth, volume INTO low_d, low_v
    FROM tank_chart_point
    WHERE tank_id = p_tank_id AND depth < depth_mm AND volume IS NOT NULL
    ORDER BY depth DESC
    LIMIT 1;

    -- point supérieur
    SELECT depth, volume INTO high_d, high_v
    FROM tank_chart_point
    WHERE tank_id = p_tank_id AND depth > depth_mm AND volume IS NOT NULL
    ORDER BY depth ASC
    LIMIT 1;

    IF low_d IS NULL OR high_d IS NULL THEN
        RETURN 'Volume non pris en charge';
    END IF;

    IF high_d = low_d THEN
        RETURN 'Volume non pris en charge';
    END IF;

    -- EXTRAIRE LE PREMIER CHIFFRE APRES LA VIRGULE
    decimal_digit := ((depth_cm_trimmed * 10)::integer % 10);
    IF decimal_digit < 0 THEN decimal_digit := ABS(decimal_digit); END IF;

    frac := decimal_digit::numeric / 10.0;

    -- interpolation selon ta règle métier
    interp_volume := low_v + frac * (high_v - low_v);

    IF interp_volume IS NULL THEN
        RETURN 'Volume non pris en charge';
    END IF;

    RETURN ROUND(interp_volume)::integer::text;
END;
$function$;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
DROP FUNCTION IF EXISTS public.get_tank_capacity_by_depth_cm(integer,numeric);
  `);
};
