-- ============================================
-- Migration 00016: create_sacrificio — totales solo con animal_count > 0
-- Alinea SUM de sacrificados/rechazados con filas en sacrificio_size_groups
-- (evita inconsistencia si el JSON trae conteos negativos o cero).
-- Idempotente para bases que ya aplicaron 00015 antes de este cambio.
-- ============================================

CREATE OR REPLACE FUNCTION public.create_sacrificio(
    p_id            UUID,
    p_org_id        UUID,
    p_farm_id       UUID,
    p_pool_id       UUID,
    p_event_date    DATE,
    p_sacrificed    JSONB,
    p_rejected      JSONB,
    p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_caller_org_id     UUID;
    v_origin_lote_id    UUID;
    v_lote_total        INTEGER;
    v_total_sacrificed  INTEGER;
    v_total_rejected    INTEGER;
    v_total_faltantes   INTEGER;
    v_all_pool_ids      UUID[];
    v_dest_pool_id      UUID;
    v_dest_lote_id      UUID;
    v_size              SMALLINT;
    v_count             INTEGER;
    v_new_lote_id       UUID;
BEGIN
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id
          AND org_id = v_caller_org_id
          AND pool_type = 'crianza'
    ) THEN
        RAISE EXCEPTION 'La pileta no pertenece a su organizacion o no es una pileta de crianza';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id AND farm_id = p_farm_id
    ) THEN
        RAISE EXCEPTION 'La finca indicada no corresponde a la pileta de origen';
    END IF;

    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_sacrificed
    FROM jsonb_array_elements(p_sacrificed) AS item
    WHERE (item->>'animal_count')::INTEGER > 0;

    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_rejected
    FROM jsonb_array_elements(p_rejected) AS item
    WHERE (item->>'animal_count')::INTEGER > 0;

    IF v_total_sacrificed + v_total_rejected <= 0 THEN
        RAISE EXCEPTION 'Debe registrar al menos un animal sacrificado o rechazado';
    END IF;

    SELECT ARRAY(
        SELECT DISTINCT unnest(
            ARRAY[p_pool_id] ||
            ARRAY(
                SELECT DISTINCT (item->>'destination_pool_id')::UUID
                FROM jsonb_array_elements(p_rejected) AS item
                WHERE item->>'destination_pool_id' IS NOT NULL
            )
        )
    ) INTO v_all_pool_ids;

    IF EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = ANY(v_all_pool_ids)
          AND (org_id != v_caller_org_id OR pool_type != 'crianza' OR farm_id != p_farm_id)
    ) THEN
        RAISE EXCEPTION 'Una o mas piletas de destino no son validas (deben pertenecer a la misma organizacion, finca, y ser de crianza)';
    END IF;

    FOR v_dest_pool_id IN
        SELECT DISTINCT (item->>'destination_pool_id')::UUID
        FROM jsonb_array_elements(p_rejected) AS item
        WHERE item->>'destination_pool_id' IS NOT NULL
          AND (item->>'destination_pool_id')::UUID != p_pool_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.lotes
            WHERE pool_id = v_dest_pool_id AND status = 'activo'
        ) THEN
            v_new_lote_id := gen_random_uuid();
            INSERT INTO public.lotes (id, pool_id, org_id, farm_id, status, opened_at, created_by)
            SELECT v_new_lote_id, v_dest_pool_id, v_caller_org_id, farm_id, 'activo', NOW(), auth.uid()
            FROM public.pools WHERE id = v_dest_pool_id;
        END IF;
    END LOOP;

    PERFORM id FROM public.lotes
    WHERE pool_id = ANY(v_all_pool_ids) AND status = 'activo'
    ORDER BY id
    FOR UPDATE;

    SELECT id INTO v_origin_lote_id
    FROM public.lotes
    WHERE pool_id = p_pool_id AND status = 'activo';

    IF v_origin_lote_id IS NULL THEN
        RAISE EXCEPTION 'La pileta de origen no tiene un lote activo';
    END IF;

    SELECT COALESCE(SUM(animal_count), 0) INTO v_lote_total
    FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    -- Las tallas son mediciones del operario; no deben coincidir con filas previas
    -- en lote_size_compositions. Solo se limita el total de animales.

    IF v_total_sacrificed + v_total_rejected > v_lote_total THEN
        RAISE EXCEPTION 'El total procesado (% + %) excede el inventario del lote (%)',
            v_total_sacrificed, v_total_rejected, v_lote_total;
    END IF;

    v_total_faltantes := v_lote_total - (v_total_sacrificed + v_total_rejected);

    INSERT INTO public.sacrificios (
        id, org_id, farm_id, pool_id, lote_id, event_date,
        total_animals, total_sacrificed, total_rejected, total_faltantes,
        notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_origin_lote_id, p_event_date,
        v_lote_total, v_total_sacrificed, v_total_rejected, v_total_faltantes,
        p_notes, auth.uid(), true
    );

    INSERT INTO public.sacrificio_size_groups (
        sacrificio_id, group_type, size_inches, animal_count, destination_pool_id
    )
    SELECT
        p_id,
        'sacrificado',
        sz,
        cnt,
        NULL
    FROM (
        SELECT
            (item->>'size_inches')::SMALLINT AS sz,
            SUM((item->>'animal_count')::INTEGER) AS cnt
        FROM jsonb_array_elements(p_sacrificed) AS item
        WHERE (item->>'animal_count')::INTEGER > 0
        GROUP BY (item->>'size_inches')::SMALLINT
    ) AS sacrificado_agg
    WHERE cnt > 0;

    INSERT INTO public.sacrificio_size_groups (
        sacrificio_id, group_type, size_inches, animal_count, destination_pool_id
    )
    SELECT
        p_id,
        'rechazado',
        sz,
        cnt,
        dest_pool
    FROM (
        SELECT
            (item->>'size_inches')::SMALLINT AS sz,
            (item->>'destination_pool_id')::UUID AS dest_pool,
            SUM((item->>'animal_count')::INTEGER) AS cnt
        FROM jsonb_array_elements(p_rejected) AS item
        WHERE (item->>'animal_count')::INTEGER > 0
        GROUP BY (item->>'size_inches')::SMALLINT, (item->>'destination_pool_id')::UUID
    ) AS rechazado_agg
    WHERE cnt > 0;

    DELETE FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    UPDATE public.lotes
    SET status = 'cerrado', closed_at = NOW(), updated_at = NOW()
    WHERE id = v_origin_lote_id;

    IF p_pool_id = ANY(
        ARRAY(
            SELECT DISTINCT (item->>'destination_pool_id')::UUID
            FROM jsonb_array_elements(p_rejected) AS item
            WHERE item->>'destination_pool_id' IS NOT NULL
        )
    ) THEN
        v_new_lote_id := gen_random_uuid();
        INSERT INTO public.lotes (id, pool_id, org_id, farm_id, status, opened_at, created_by)
        SELECT v_new_lote_id, p_pool_id, v_caller_org_id, farm_id, 'activo', NOW(), auth.uid()
        FROM public.pools WHERE id = p_pool_id;
    END IF;

    FOR v_dest_pool_id, v_size, v_count IN
        SELECT
            (item->>'destination_pool_id')::UUID,
            (item->>'size_inches')::SMALLINT,
            SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_rejected) AS item
        WHERE (item->>'animal_count')::INTEGER > 0
          AND item->>'destination_pool_id' IS NOT NULL
        GROUP BY (item->>'destination_pool_id')::UUID, (item->>'size_inches')::SMALLINT
    LOOP
        SELECT id INTO v_dest_lote_id
        FROM public.lotes
        WHERE pool_id = v_dest_pool_id AND status = 'activo';

        IF v_dest_lote_id IS NULL THEN
            RAISE EXCEPTION 'La pileta de destino % no tiene un lote activo', v_dest_pool_id;
        END IF;

        INSERT INTO public.lote_size_compositions (lote_id, size_inches, animal_count)
        VALUES (v_dest_lote_id, v_size, v_count)
        ON CONFLICT (lote_id, size_inches)
        DO UPDATE SET
            animal_count = lote_size_compositions.animal_count + EXCLUDED.animal_count,
            updated_at = NOW();
    END LOOP;

    RETURN p_id;
END;
$$;
