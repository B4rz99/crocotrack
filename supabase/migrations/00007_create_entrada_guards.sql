-- ============================================
-- Migration 00007: create_entrada security guards
-- Adds three missing checks:
-- 1. Destination pool must belong to caller's org
-- 2. finca_propia: origin lote must exist (no phantom inventory)
-- 3. finca_propia: origin must have sufficient stock per size
-- ============================================

CREATE OR REPLACE FUNCTION public.create_entrada(
    p_id                    UUID,
    p_org_id                UUID,
    p_farm_id               UUID,
    p_pool_id               UUID,
    p_origin_type           public.entrada_origin_type,
    p_entry_date            DATE,
    p_compositions          JSONB,
    -- Proveedor persona
    p_persona_full_name     TEXT DEFAULT NULL,
    p_persona_document_id   TEXT DEFAULT NULL,
    p_persona_aval_code     TEXT DEFAULT NULL,
    p_persona_aval_file_path TEXT DEFAULT NULL,
    -- Proveedor empresa
    p_empresa_name          TEXT DEFAULT NULL,
    p_empresa_legal_rep     TEXT DEFAULT NULL,
    p_empresa_nit           TEXT DEFAULT NULL,
    p_empresa_aval_code     TEXT DEFAULT NULL,
    p_empresa_aval_file_path TEXT DEFAULT NULL,
    -- Finca propia
    p_origin_farm_id        UUID DEFAULT NULL,
    p_origin_pool_id        UUID DEFAULT NULL,
    -- Incubador
    p_nido_number           TEXT DEFAULT NULL,
    p_eclosion_date         DATE DEFAULT NULL,
    -- Optional
    p_notes                 TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_total_animals     INTEGER;
    v_lote_id           UUID;
    v_origin_lote_id    UUID;
    v_size              SMALLINT;
    v_count             INTEGER;
    v_origin_total      INTEGER;
    v_caller_org_id     UUID;
    v_available         INTEGER;
BEGIN
    -- Resolve org from server context — do not trust p_org_id alone
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organización del usuario';
    END IF;

    -- Guard: destination pool must belong to caller's org
    IF NOT EXISTS (
        SELECT 1 FROM public.pools WHERE id = p_pool_id AND org_id = v_caller_org_id
    ) THEN
        RAISE EXCEPTION 'La pileta destino no pertenece a su organización';
    END IF;

    -- Guard: finca_propia cannot transfer to itself
    IF p_origin_type = 'finca_propia' AND p_origin_pool_id IS NOT NULL AND p_origin_pool_id = p_pool_id THEN
        RAISE EXCEPTION 'La pileta de origen y destino no pueden ser la misma';
    END IF;

    -- Guard: finca_propia origin pool must belong to caller's org
    IF p_origin_type = 'finca_propia' AND p_origin_pool_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.pools WHERE id = p_origin_pool_id AND org_id = v_caller_org_id
        ) THEN
            RAISE EXCEPTION 'La pileta de origen no pertenece a su organización';
        END IF;
    END IF;

    -- 1. Calculate total_animals from compositions
    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_animals
    FROM jsonb_array_elements(p_compositions) AS item;

    IF v_total_animals <= 0 THEN
        RAISE EXCEPTION 'total_animals must be greater than 0';
    END IF;

    -- 2. Find or create active lote for destination pool (FOR UPDATE lock)
    SELECT id INTO v_lote_id
    FROM public.lotes
    WHERE pool_id = p_pool_id AND status = 'activo'
    FOR UPDATE;

    IF v_lote_id IS NULL THEN
        INSERT INTO public.lotes (pool_id, org_id, farm_id, status, opened_at, created_by)
        VALUES (p_pool_id, v_caller_org_id, p_farm_id, 'activo', NOW(), auth.uid())
        RETURNING id INTO v_lote_id;
    END IF;

    -- 3. Insert entrada record (RLS enforces org_id = get_user_org_id())
    INSERT INTO public.entradas (
        id, org_id, farm_id, pool_id, lote_id, origin_type, entry_date,
        total_animals, notes, created_by, is_active,
        persona_full_name, persona_document_id, persona_aval_code, persona_aval_file_path,
        empresa_name, empresa_legal_rep, empresa_nit, empresa_aval_code, empresa_aval_file_path,
        origin_farm_id, origin_pool_id,
        nido_number, eclosion_date
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_lote_id, p_origin_type, p_entry_date,
        v_total_animals, p_notes, auth.uid(), true,
        p_persona_full_name, p_persona_document_id, p_persona_aval_code, p_persona_aval_file_path,
        p_empresa_name, p_empresa_legal_rep, p_empresa_nit, p_empresa_aval_code, p_empresa_aval_file_path,
        p_origin_farm_id, p_origin_pool_id,
        p_nido_number, p_eclosion_date
    );

    -- 4. Insert entry_size_groups
    INSERT INTO public.entry_size_groups (entrada_id, size_inches, animal_count)
    SELECT
        p_id,
        (item->>'size_inches')::SMALLINT,
        (item->>'animal_count')::INTEGER
    FROM jsonb_array_elements(p_compositions) AS item;

    -- 5. Upsert (increment) lote_size_compositions on destination lote
    FOR v_size, v_count IN
        SELECT (item->>'size_inches')::SMALLINT, (item->>'animal_count')::INTEGER
        FROM jsonb_array_elements(p_compositions) AS item
    LOOP
        INSERT INTO public.lote_size_compositions (lote_id, size_inches, animal_count)
        VALUES (v_lote_id, v_size, v_count)
        ON CONFLICT (lote_id, size_inches)
        DO UPDATE SET
            animal_count = lote_size_compositions.animal_count + EXCLUDED.animal_count,
            updated_at = NOW();
    END LOOP;

    -- 6. If finca_propia: decrement origin pool's lote compositions
    IF p_origin_type = 'finca_propia' AND p_origin_pool_id IS NOT NULL THEN
        SELECT id INTO v_origin_lote_id
        FROM public.lotes
        WHERE pool_id = p_origin_pool_id AND status = 'activo'
        FOR UPDATE;

        -- Guard: origin must have an active lote
        IF v_origin_lote_id IS NULL THEN
            RAISE EXCEPTION 'La pileta de origen no tiene un lote activo';
        END IF;

        -- Guard: origin must have sufficient stock for each size (aggregate duplicates first)
        FOR v_size, v_count IN
            SELECT (item->>'size_inches')::SMALLINT,
                   SUM((item->>'animal_count')::INTEGER)
            FROM jsonb_array_elements(p_compositions) AS item
            GROUP BY (item->>'size_inches')::SMALLINT
        LOOP
            SELECT COALESCE(SUM(animal_count), 0) INTO v_available
            FROM public.lote_size_compositions
            WHERE lote_id = v_origin_lote_id AND size_inches = v_size;

            IF v_available < v_count THEN
                RAISE EXCEPTION 'Stock insuficiente para talla % pulgadas: disponible %, solicitado %',
                    v_size, v_available, v_count;
            END IF;
        END LOOP;

        -- Decrement each size group: delete rows that reach 0, update the rest (aggregate duplicates first)
        FOR v_size, v_count IN
            SELECT (item->>'size_inches')::SMALLINT,
                   SUM((item->>'animal_count')::INTEGER)
            FROM jsonb_array_elements(p_compositions) AS item
            GROUP BY (item->>'size_inches')::SMALLINT
        LOOP
            -- Remove row when all animals of this size are transferred out
            DELETE FROM public.lote_size_compositions
            WHERE lote_id = v_origin_lote_id
              AND size_inches = v_size
              AND animal_count <= v_count;

            -- Decrement only rows where a positive count will remain
            UPDATE public.lote_size_compositions
            SET animal_count = animal_count - v_count,
                updated_at = NOW()
            WHERE lote_id = v_origin_lote_id
              AND size_inches = v_size;
        END LOOP;

        -- Auto-close origin lote if empty
        SELECT COALESCE(SUM(animal_count), 0) INTO v_origin_total
        FROM public.lote_size_compositions
        WHERE lote_id = v_origin_lote_id;

        IF v_origin_total = 0 THEN
            UPDATE public.lotes
            SET status = 'cerrado', closed_at = NOW(), updated_at = NOW()
            WHERE id = v_origin_lote_id;
        END IF;
    END IF;

    RETURN p_id;
END;
$$;
