-- ============================================
-- Migration 00011: sacrificio
-- Creates sacrificios + sacrificio_size_groups,
-- RLS policies, and create_sacrificio() RPC.
-- ============================================

-- ============================================
-- SACRIFICIOS
-- ============================================
CREATE TABLE public.sacrificios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id          UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id          UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    lote_id          UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
    event_date       DATE NOT NULL,
    total_animals    INTEGER NOT NULL CHECK (total_animals > 0),
    total_sacrificed INTEGER NOT NULL CHECK (total_sacrificed >= 0),
    total_rejected   INTEGER NOT NULL CHECK (total_rejected >= 0),
    total_faltantes  INTEGER NOT NULL DEFAULT 0 CHECK (total_faltantes >= 0),
    notes            TEXT,
    created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sacrificios_org_id      ON public.sacrificios(org_id);
CREATE INDEX idx_sacrificios_farm_id     ON public.sacrificios(farm_id);
CREATE INDEX idx_sacrificios_pool_id     ON public.sacrificios(pool_id);
CREATE INDEX idx_sacrificios_lote_id     ON public.sacrificios(lote_id);
CREATE INDEX idx_sacrificios_created_by  ON public.sacrificios(created_by);
CREATE INDEX idx_sacrificios_event_date  ON public.sacrificios(event_date DESC);
CREATE INDEX idx_sacrificios_active
    ON public.sacrificios(farm_id, event_date DESC)
    WHERE is_active = true;

CREATE TRIGGER sacrificios_updated_at
    BEFORE UPDATE ON public.sacrificios
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- SACRIFICIO SIZE GROUPS
-- ============================================
CREATE TABLE public.sacrificio_size_groups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacrificio_id        UUID NOT NULL REFERENCES public.sacrificios(id) ON DELETE CASCADE,
    group_type           TEXT NOT NULL CHECK (group_type IN ('sacrificado', 'rechazado')),
    size_inches          SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count         INTEGER NOT NULL CHECK (animal_count > 0),
    destination_pool_id  UUID REFERENCES public.pools(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (group_type = 'sacrificado' AND destination_pool_id IS NULL) OR
        (group_type = 'rechazado' AND destination_pool_id IS NOT NULL)
    )
);

CREATE INDEX idx_sacrificio_size_groups_sacrificio_id
    ON public.sacrificio_size_groups(sacrificio_id);
CREATE INDEX idx_sacrificio_size_groups_destination_pool_id
    ON public.sacrificio_size_groups(destination_pool_id);

CREATE UNIQUE INDEX idx_sacrificio_size_groups_sacrificado_unique
    ON public.sacrificio_size_groups(sacrificio_id, size_inches)
    WHERE group_type = 'sacrificado';

CREATE TRIGGER sacrificio_size_groups_updated_at
    BEFORE UPDATE ON public.sacrificio_size_groups
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- RLS — sacrificios
-- ============================================
ALTER TABLE public.sacrificios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sacrificios FORCE ROW LEVEL SECURITY;

CREATE POLICY "sacrificios_select" ON public.sacrificios FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "sacrificios_insert" ON public.sacrificios FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "sacrificios_update" ON public.sacrificios FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "sacrificios_delete" ON public.sacrificios FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RLS — sacrificio_size_groups
-- ============================================
ALTER TABLE public.sacrificio_size_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sacrificio_size_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY "sacrificio_size_select" ON public.sacrificio_size_groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "sacrificio_size_insert" ON public.sacrificio_size_groups FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(s.farm_id))
        )
    );

CREATE POLICY "sacrificio_size_update" ON public.sacrificio_size_groups FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(s.farm_id))
        )
    );

CREATE POLICY "sacrificio_size_delete" ON public.sacrificio_size_groups FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );

-- ============================================
-- RPC: create_sacrificio()
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
    -- 1. Resolve caller org (do NOT trust p_org_id)
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    -- 2. Guard: origin pool must belong to caller org AND be crianza
    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id
          AND org_id = v_caller_org_id
          AND pool_type = 'crianza'
    ) THEN
        RAISE EXCEPTION 'La pileta no pertenece a su organizacion o no es una pileta de crianza';
    END IF;

    -- 2b. Guard: p_farm_id must match origin pool's farm
    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id AND farm_id = p_farm_id
    ) THEN
        RAISE EXCEPTION 'La finca indicada no corresponde a la pileta de origen';
    END IF;

    -- 3. Calculate totals
    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_sacrificed
    FROM jsonb_array_elements(p_sacrificed) AS item;

    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_rejected
    FROM jsonb_array_elements(p_rejected) AS item;

    IF v_total_sacrificed + v_total_rejected <= 0 THEN
        RAISE EXCEPTION 'Debe registrar al menos un animal sacrificado o rechazado';
    END IF;

    -- 4. Collect all unique destination pool IDs (origin + rejected destinations)
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

    -- 4b. Guard: all destination pools must belong to caller's org, be crianza, same farm
    IF EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = ANY(v_all_pool_ids)
          AND (org_id != v_caller_org_id OR pool_type != 'crianza' OR farm_id != p_farm_id)
    ) THEN
        RAISE EXCEPTION 'Una o mas piletas de destino no son validas (deben pertenecer a la misma organizacion, finca, y ser de crianza)';
    END IF;

    -- 5. Create destination lotes if needed (before locking)
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

    -- 6. Deadlock prevention: lock ALL affected lotes in id-sorted order
    PERFORM id FROM public.lotes
    WHERE pool_id = ANY(v_all_pool_ids) AND status = 'activo'
    ORDER BY id
    FOR UPDATE;

    -- 7. Validate origin lote exists (after lock — race-safe)
    SELECT id INTO v_origin_lote_id
    FROM public.lotes
    WHERE pool_id = p_pool_id AND status = 'activo';

    IF v_origin_lote_id IS NULL THEN
        RAISE EXCEPTION 'La pileta de origen no tiene un lote activo';
    END IF;

    -- 8. Get total animals in origin lote
    SELECT COALESCE(SUM(animal_count), 0) INTO v_lote_total
    FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    -- 9. Validate: processed <= lote total
    IF v_total_sacrificed + v_total_rejected > v_lote_total THEN
        RAISE EXCEPTION 'El total procesado (% + %) excede el inventario del lote (%)',
            v_total_sacrificed, v_total_rejected, v_lote_total;
    END IF;

    -- 10. Calculate faltantes
    v_total_faltantes := v_lote_total - (v_total_sacrificed + v_total_rejected);

    -- 11. Insert sacrificio record
    INSERT INTO public.sacrificios (
        id, org_id, farm_id, pool_id, lote_id, event_date,
        total_animals, total_sacrificed, total_rejected, total_faltantes,
        notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_origin_lote_id, p_event_date,
        v_lote_total, v_total_sacrificed, v_total_rejected, v_total_faltantes,
        p_notes, auth.uid(), true
    );

    -- 12. Insert sacrificio_size_groups — sacrificados
    INSERT INTO public.sacrificio_size_groups (
        sacrificio_id, group_type, size_inches, animal_count, destination_pool_id
    )
    SELECT
        p_id,
        'sacrificado',
        (item->>'size_inches')::SMALLINT,
        (item->>'animal_count')::INTEGER,
        NULL
    FROM jsonb_array_elements(p_sacrificed) AS item
    WHERE (item->>'animal_count')::INTEGER > 0;

    -- 13. Insert sacrificio_size_groups — rechazados
    INSERT INTO public.sacrificio_size_groups (
        sacrificio_id, group_type, size_inches, animal_count, destination_pool_id
    )
    SELECT
        p_id,
        'rechazado',
        (item->>'size_inches')::SMALLINT,
        (item->>'animal_count')::INTEGER,
        (item->>'destination_pool_id')::UUID
    FROM jsonb_array_elements(p_rejected) AS item
    WHERE (item->>'animal_count')::INTEGER > 0;

    -- 14. Delete ALL lote_size_compositions for origin lote
    DELETE FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    -- 15. Close origin lote unconditionally
    UPDATE public.lotes
    SET status = 'cerrado', closed_at = NOW(), updated_at = NOW()
    WHERE id = v_origin_lote_id;

    -- 16. If origin pool is also a destination for rejected: create NEW active lote
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

    -- 17. Upsert lote_size_compositions for each rejected destination pool
    FOR v_dest_pool_id, v_size, v_count IN
        SELECT
            (item->>'destination_pool_id')::UUID,
            (item->>'size_inches')::SMALLINT,
            SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_rejected) AS item
        WHERE (item->>'animal_count')::INTEGER > 0
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
