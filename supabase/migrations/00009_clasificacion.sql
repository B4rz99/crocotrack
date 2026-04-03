-- ============================================
-- Migration 00009: clasificacion
-- Creates clasificaciones + clasificacion_groups,
-- RLS policies, and create_clasificacion() RPC.
-- ============================================

-- ============================================
-- CLASIFICACIONES
-- ============================================
CREATE TABLE public.clasificaciones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id         UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    lote_id         UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
    event_date      DATE NOT NULL,
    total_animals   INTEGER NOT NULL CHECK (total_animals > 0),
    notes           TEXT,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clasificaciones_org_id     ON public.clasificaciones(org_id);
CREATE INDEX idx_clasificaciones_farm_id    ON public.clasificaciones(farm_id);
CREATE INDEX idx_clasificaciones_pool_id    ON public.clasificaciones(pool_id);
CREATE INDEX idx_clasificaciones_lote_id    ON public.clasificaciones(lote_id);
CREATE INDEX idx_clasificaciones_created_by ON public.clasificaciones(created_by);
CREATE INDEX idx_clasificaciones_event_date ON public.clasificaciones(event_date DESC);
CREATE INDEX idx_clasificaciones_active
    ON public.clasificaciones(farm_id, event_date DESC)
    WHERE is_active = true;

CREATE TRIGGER clasificaciones_updated_at
    BEFORE UPDATE ON public.clasificaciones
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- CLASIFICACION GROUPS
-- ============================================
CREATE TABLE public.clasificacion_groups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clasificacion_id     UUID NOT NULL REFERENCES public.clasificaciones(id) ON DELETE CASCADE,
    size_inches          SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count         INTEGER NOT NULL CHECK (animal_count > 0),
    destination_pool_id  UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_clasificacion_groups_unique
    ON public.clasificacion_groups(clasificacion_id, size_inches, destination_pool_id);

CREATE INDEX idx_clasificacion_groups_clasificacion_id
    ON public.clasificacion_groups(clasificacion_id);
CREATE INDEX idx_clasificacion_groups_destination_pool_id
    ON public.clasificacion_groups(destination_pool_id);

CREATE TRIGGER clasificacion_groups_updated_at
    BEFORE UPDATE ON public.clasificacion_groups
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- RLS — clasificaciones
-- ============================================
ALTER TABLE public.clasificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clasificaciones FORCE ROW LEVEL SECURITY;

CREATE POLICY "clasificaciones_select" ON public.clasificaciones FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "clasificaciones_insert" ON public.clasificaciones FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "clasificaciones_update" ON public.clasificaciones FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "clasificaciones_delete" ON public.clasificaciones FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RLS — clasificacion_groups
-- ============================================
ALTER TABLE public.clasificacion_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clasificacion_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY "clasificacion_groups_select" ON public.clasificacion_groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clasificaciones c
            WHERE c.id = clasificacion_id
              AND c.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "clasificacion_groups_insert" ON public.clasificacion_groups FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clasificaciones c
            WHERE c.id = clasificacion_id
              AND c.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(c.farm_id))
        )
    );

CREATE POLICY "clasificacion_groups_update" ON public.clasificacion_groups FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clasificaciones c
            WHERE c.id = clasificacion_id
              AND c.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(c.farm_id))
        )
    );

CREATE POLICY "clasificacion_groups_delete" ON public.clasificacion_groups FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clasificaciones c
            WHERE c.id = clasificacion_id
              AND c.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );

-- ============================================
-- RPC: create_clasificacion()
-- ============================================
CREATE OR REPLACE FUNCTION public.create_clasificacion(
    p_id            UUID,
    p_org_id        UUID,
    p_farm_id       UUID,
    p_pool_id       UUID,
    p_event_date    DATE,
    p_compositions  JSONB,
    p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_total_animals     INTEGER;
    v_caller_org_id     UUID;
    v_origin_lote_id    UUID;
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

    -- 3. Calculate total_animals
    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_animals
    FROM jsonb_array_elements(p_compositions) AS item;

    IF v_total_animals <= 0 THEN
        RAISE EXCEPTION 'La cantidad total de animales debe ser mayor a 0';
    END IF;

    -- 4. Collect all unique pool IDs (origin + destinations)
    SELECT ARRAY(
        SELECT DISTINCT unnest(
            ARRAY[p_pool_id] ||
            ARRAY(
                SELECT DISTINCT (item->>'destination_pool_id')::UUID
                FROM jsonb_array_elements(p_compositions) AS item
            )
        )
    ) INTO v_all_pool_ids;

    -- 5. For destination pools that have no active lote: create one now
    FOR v_dest_pool_id IN
        SELECT DISTINCT (item->>'destination_pool_id')::UUID
        FROM jsonb_array_elements(p_compositions) AS item
        WHERE (item->>'destination_pool_id')::UUID != p_pool_id
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

    -- 8. Insert clasificaciones record
    INSERT INTO public.clasificaciones (
        id, org_id, farm_id, pool_id, lote_id, event_date,
        total_animals, notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_origin_lote_id,
        p_event_date, v_total_animals, p_notes, auth.uid(), true
    );

    -- 9. Insert clasificacion_groups
    INSERT INTO public.clasificacion_groups (
        clasificacion_id, size_inches, animal_count, destination_pool_id
    )
    SELECT
        p_id,
        (item->>'size_inches')::SMALLINT,
        (item->>'animal_count')::INTEGER,
        (item->>'destination_pool_id')::UUID
    FROM jsonb_array_elements(p_compositions) AS item;

    -- 10. Delete ALL lote_size_compositions for origin lote
    DELETE FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    -- 11. Close origin lote
    UPDATE public.lotes
    SET status = 'cerrado', closed_at = NOW(), updated_at = NOW()
    WHERE id = v_origin_lote_id;

    -- 12. If origin pool is also a destination: create a NEW active lote for it
    IF p_pool_id = ANY(
        ARRAY(
            SELECT DISTINCT (item->>'destination_pool_id')::UUID
            FROM jsonb_array_elements(p_compositions) AS item
        )
    ) THEN
        v_new_lote_id := gen_random_uuid();
        INSERT INTO public.lotes (id, pool_id, org_id, farm_id, status, opened_at, created_by)
        VALUES (v_new_lote_id, p_pool_id, v_caller_org_id, p_farm_id, 'activo', NOW(), auth.uid());
    END IF;

    -- 13. Upsert lote_size_compositions for each destination pool
    FOR v_dest_pool_id, v_size, v_count IN
        SELECT
            (item->>'destination_pool_id')::UUID,
            (item->>'size_inches')::SMALLINT,
            SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_compositions) AS item
        GROUP BY (item->>'destination_pool_id')::UUID, (item->>'size_inches')::SMALLINT
    LOOP
        SELECT id INTO v_dest_lote_id
        FROM public.lotes
        WHERE pool_id = v_dest_pool_id AND status = 'activo';

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
