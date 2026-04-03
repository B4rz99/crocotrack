-- ============================================
-- Migration 00010: traslados
-- Creates traslados + traslado_size_groups,
-- RLS policies, and create_traslado() RPC.
-- ============================================

-- ============================================
-- TRASLADOS
-- ============================================
CREATE TABLE public.traslados (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id               UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id              UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id              UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    lote_id              UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
    destination_pool_id  UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    event_date           DATE NOT NULL,
    total_animals        INTEGER NOT NULL CHECK (total_animals > 0),
    notes                TEXT,
    created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traslados_org_id              ON public.traslados(org_id);
CREATE INDEX idx_traslados_farm_id             ON public.traslados(farm_id);
CREATE INDEX idx_traslados_pool_id             ON public.traslados(pool_id);
CREATE INDEX idx_traslados_lote_id             ON public.traslados(lote_id);
CREATE INDEX idx_traslados_destination_pool_id ON public.traslados(destination_pool_id);
CREATE INDEX idx_traslados_created_by          ON public.traslados(created_by);
CREATE INDEX idx_traslados_event_date          ON public.traslados(event_date DESC);
CREATE INDEX idx_traslados_active
    ON public.traslados(farm_id, event_date DESC)
    WHERE is_active = true;

CREATE TRIGGER traslados_updated_at
    BEFORE UPDATE ON public.traslados
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- TRASLADO SIZE GROUPS
-- ============================================
CREATE TABLE public.traslado_size_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    traslado_id     UUID NOT NULL REFERENCES public.traslados(id) ON DELETE CASCADE,
    size_inches     SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count    INTEGER NOT NULL CHECK (animal_count > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_traslado_size_groups_unique
    ON public.traslado_size_groups(traslado_id, size_inches);

CREATE INDEX idx_traslado_size_groups_traslado_id
    ON public.traslado_size_groups(traslado_id);

CREATE TRIGGER traslado_size_groups_updated_at
    BEFORE UPDATE ON public.traslado_size_groups
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- RLS — traslados
-- ============================================
ALTER TABLE public.traslados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traslados FORCE ROW LEVEL SECURITY;

CREATE POLICY "traslados_select" ON public.traslados FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "traslados_insert" ON public.traslados FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "traslados_update" ON public.traslados FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "traslados_delete" ON public.traslados FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RLS — traslado_size_groups
-- ============================================
ALTER TABLE public.traslado_size_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traslado_size_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY "traslado_size_select" ON public.traslado_size_groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.traslados t
            WHERE t.id = traslado_id
              AND t.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "traslado_size_insert" ON public.traslado_size_groups FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.traslados t
            WHERE t.id = traslado_id
              AND t.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(t.farm_id))
        )
    );

CREATE POLICY "traslado_size_update" ON public.traslado_size_groups FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.traslados t
            WHERE t.id = traslado_id
              AND t.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(t.farm_id))
        )
    );

CREATE POLICY "traslado_size_delete" ON public.traslado_size_groups FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.traslados t
            WHERE t.id = traslado_id
              AND t.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );

-- ============================================
-- RPC: create_traslado()
-- ============================================
CREATE OR REPLACE FUNCTION public.create_traslado(
    p_id                   UUID,
    p_org_id               UUID,
    p_farm_id              UUID,
    p_pool_id              UUID,
    p_destination_pool_id  UUID,
    p_event_date           DATE,
    p_compositions         JSONB,
    p_notes                TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_total_animals     INTEGER;
    v_caller_org_id     UUID;
    v_origin_lote_id    UUID;
    v_dest_lote_id      UUID;
    v_size              SMALLINT;
    v_count             INTEGER;
    v_available         INTEGER;
    v_lote_total        INTEGER;
    v_new_lote_id       UUID;
BEGIN
    -- 1. Resolve caller org (do NOT trust p_org_id)
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    -- 2. Guard: origin pool must belong to caller org, be crianza, match farm
    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id
          AND org_id = v_caller_org_id
          AND pool_type = 'crianza'
          AND farm_id = p_farm_id
    ) THEN
        RAISE EXCEPTION 'La pileta de origen no pertenece a su organizacion, no es de crianza, o no pertenece a la finca indicada';
    END IF;

    -- 3. Guard: destination pool must belong to caller org, be crianza, same farm
    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_destination_pool_id
          AND org_id = v_caller_org_id
          AND pool_type = 'crianza'
          AND farm_id = p_farm_id
    ) THEN
        RAISE EXCEPTION 'La pileta de destino no pertenece a su organizacion, no es de crianza, o no pertenece a la misma finca';
    END IF;

    -- 4. Guard: origin != destination
    IF p_pool_id = p_destination_pool_id THEN
        RAISE EXCEPTION 'La pileta de destino debe ser diferente a la de origen';
    END IF;

    -- 5. Calculate total_animals
    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_animals
    FROM jsonb_array_elements(p_compositions) AS item;

    IF v_total_animals <= 0 THEN
        RAISE EXCEPTION 'La cantidad total de animales debe ser mayor a 0';
    END IF;

    -- 6. Create destination lote if needed
    IF NOT EXISTS (
        SELECT 1 FROM public.lotes
        WHERE pool_id = p_destination_pool_id AND status = 'activo'
    ) THEN
        v_new_lote_id := gen_random_uuid();
        INSERT INTO public.lotes (id, pool_id, org_id, farm_id, status, opened_at, created_by)
        SELECT v_new_lote_id, p_destination_pool_id, v_caller_org_id, farm_id, 'activo', NOW(), auth.uid()
        FROM public.pools WHERE id = p_destination_pool_id;
    END IF;

    -- 7. Deadlock prevention: lock both lotes in id-sorted order
    PERFORM id FROM public.lotes
    WHERE pool_id IN (p_pool_id, p_destination_pool_id) AND status = 'activo'
    ORDER BY id
    FOR UPDATE;

    -- 8. Validate origin lote exists (after lock)
    SELECT id INTO v_origin_lote_id
    FROM public.lotes
    WHERE pool_id = p_pool_id AND status = 'activo';

    IF v_origin_lote_id IS NULL THEN
        RAISE EXCEPTION 'La pileta de origen no tiene un lote activo';
    END IF;

    -- 9. Validate sufficient stock per size
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

    -- 10. Insert traslados record
    INSERT INTO public.traslados (
        id, org_id, farm_id, pool_id, lote_id, destination_pool_id,
        event_date, total_animals, notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_origin_lote_id,
        p_destination_pool_id, p_event_date, v_total_animals, p_notes, auth.uid(), true
    );

    -- 11. Insert traslado_size_groups
    INSERT INTO public.traslado_size_groups (traslado_id, size_inches, animal_count)
    SELECT
        p_id,
        (item->>'size_inches')::SMALLINT,
        SUM((item->>'animal_count')::INTEGER)
    FROM jsonb_array_elements(p_compositions) AS item
    GROUP BY (item->>'size_inches')::SMALLINT;

    -- 12. Decrement origin lote_size_compositions
    FOR v_size, v_count IN
        SELECT (item->>'size_inches')::SMALLINT,
               SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_compositions) AS item
        GROUP BY (item->>'size_inches')::SMALLINT
    LOOP
        DELETE FROM public.lote_size_compositions
        WHERE lote_id = v_origin_lote_id
          AND size_inches = v_size
          AND animal_count <= v_count;

        UPDATE public.lote_size_compositions
        SET animal_count = animal_count - v_count,
            updated_at = NOW()
        WHERE lote_id = v_origin_lote_id
          AND size_inches = v_size;
    END LOOP;

    -- 13. Upsert destination lote_size_compositions
    SELECT id INTO v_dest_lote_id
    FROM public.lotes
    WHERE pool_id = p_destination_pool_id AND status = 'activo';

    FOR v_size, v_count IN
        SELECT (item->>'size_inches')::SMALLINT,
               SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_compositions) AS item
        GROUP BY (item->>'size_inches')::SMALLINT
    LOOP
        INSERT INTO public.lote_size_compositions (lote_id, size_inches, animal_count)
        VALUES (v_dest_lote_id, v_size, v_count)
        ON CONFLICT (lote_id, size_inches)
        DO UPDATE SET
            animal_count = lote_size_compositions.animal_count + EXCLUDED.animal_count,
            updated_at = NOW();
    END LOOP;

    -- 14. Auto-close origin lote if empty
    SELECT COALESCE(SUM(animal_count), 0) INTO v_lote_total
    FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    IF v_lote_total = 0 THEN
        UPDATE public.lotes
        SET status = 'cerrado', closed_at = NOW(), updated_at = NOW()
        WHERE id = v_origin_lote_id;
    END IF;

    RETURN p_id;
END;
$$;
