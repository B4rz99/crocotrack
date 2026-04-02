-- ============================================
-- Migration 00008: mortalidad
-- Creates mortalidades + mortalidad_size_groups,
-- RLS policies, and create_mortalidad() RPC.
-- ============================================

-- ============================================
-- MORTALIDADES
-- ============================================
CREATE TABLE public.mortalidades (
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

CREATE INDEX idx_mortalidades_org_id    ON public.mortalidades(org_id);
CREATE INDEX idx_mortalidades_farm_id   ON public.mortalidades(farm_id);
CREATE INDEX idx_mortalidades_pool_id   ON public.mortalidades(pool_id);
CREATE INDEX idx_mortalidades_lote_id   ON public.mortalidades(lote_id);
CREATE INDEX idx_mortalidades_created_by ON public.mortalidades(created_by);
CREATE INDEX idx_mortalidades_event_date ON public.mortalidades(event_date DESC);
CREATE INDEX idx_mortalidades_active     ON public.mortalidades(farm_id, event_date DESC)
    WHERE is_active = true;

CREATE TRIGGER mortalidades_updated_at
    BEFORE UPDATE ON public.mortalidades
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- MORTALIDAD SIZE GROUPS
-- ============================================
CREATE TABLE public.mortalidad_size_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mortalidad_id   UUID NOT NULL REFERENCES public.mortalidades(id) ON DELETE CASCADE,
    size_inches     SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count    INTEGER NOT NULL CHECK (animal_count > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mortalidad_size_groups_mortalidad_id
    ON public.mortalidad_size_groups(mortalidad_id);

CREATE TRIGGER mortalidad_size_groups_updated_at
    BEFORE UPDATE ON public.mortalidad_size_groups
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- RLS — mortalidades
-- ============================================
ALTER TABLE public.mortalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortalidades FORCE ROW LEVEL SECURITY;

CREATE POLICY "mortalidades_select" ON public.mortalidades FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "mortalidades_insert" ON public.mortalidades FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "mortalidades_update" ON public.mortalidades FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "mortalidades_delete" ON public.mortalidades FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RLS — mortalidad_size_groups
-- ============================================
ALTER TABLE public.mortalidad_size_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortalidad_size_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY "mortalidad_size_select" ON public.mortalidad_size_groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.mortalidades m
            WHERE m.id = mortalidad_id
              AND m.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "mortalidad_size_insert" ON public.mortalidad_size_groups FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.mortalidades m
            WHERE m.id = mortalidad_id
              AND m.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(m.farm_id))
        )
    );

CREATE POLICY "mortalidad_size_update" ON public.mortalidad_size_groups FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.mortalidades m
            WHERE m.id = mortalidad_id
              AND m.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(m.farm_id))
        )
    );

CREATE POLICY "mortalidad_size_delete" ON public.mortalidad_size_groups FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.mortalidades m
            WHERE m.id = mortalidad_id
              AND m.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );

-- ============================================
-- RPC: create_mortalidad()
-- ============================================
CREATE OR REPLACE FUNCTION public.create_mortalidad(
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
    v_total_animals INTEGER;
    v_lote_id       UUID;
    v_lote_total    INTEGER;
    v_size          SMALLINT;
    v_count         INTEGER;
    v_available     INTEGER;
    v_caller_org_id UUID;
BEGIN
    -- 1. Resolve caller's org (do NOT trust p_org_id)
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    -- 2. Guard: pool must belong to caller's org AND be a crianza pool
    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id AND org_id = v_caller_org_id AND pool_type = 'crianza'
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

    -- 4. Find active lote (FOR UPDATE lock)
    SELECT id INTO v_lote_id
    FROM public.lotes
    WHERE pool_id = p_pool_id AND status = 'activo'
    FOR UPDATE;

    IF v_lote_id IS NULL THEN
        RAISE EXCEPTION 'La pileta no tiene un lote activo';
    END IF;

    -- 5. Validate sufficient stock per size
    FOR v_size, v_count IN
        SELECT (item->>'size_inches')::SMALLINT,
               SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_compositions) AS item
        GROUP BY (item->>'size_inches')::SMALLINT
    LOOP
        SELECT COALESCE(SUM(animal_count), 0) INTO v_available
        FROM public.lote_size_compositions
        WHERE lote_id = v_lote_id AND size_inches = v_size;

        IF v_available < v_count THEN
            RAISE EXCEPTION 'Stock insuficiente para talla % pulgadas: disponible %, solicitado %',
                v_size, v_available, v_count;
        END IF;
    END LOOP;

    -- 6. Insert mortalidad record
    INSERT INTO public.mortalidades (
        id, org_id, farm_id, pool_id, lote_id, event_date,
        total_animals, notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_lote_id, p_event_date,
        v_total_animals, p_notes, auth.uid(), true
    );

    -- 7. Insert mortalidad_size_groups
    INSERT INTO public.mortalidad_size_groups (mortalidad_id, size_inches, animal_count)
    SELECT
        p_id,
        (item->>'size_inches')::SMALLINT,
        (item->>'animal_count')::INTEGER
    FROM jsonb_array_elements(p_compositions) AS item;

    -- 8. Decrement lote_size_compositions
    FOR v_size, v_count IN
        SELECT (item->>'size_inches')::SMALLINT,
               SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_compositions) AS item
        GROUP BY (item->>'size_inches')::SMALLINT
    LOOP
        -- Delete rows that will reach zero
        DELETE FROM public.lote_size_compositions
        WHERE lote_id = v_lote_id
          AND size_inches = v_size
          AND animal_count <= v_count;

        -- Decrement remaining rows
        UPDATE public.lote_size_compositions
        SET animal_count = animal_count - v_count,
            updated_at = NOW()
        WHERE lote_id = v_lote_id
          AND size_inches = v_size;
    END LOOP;

    -- 9. Auto-close lote if empty
    SELECT COALESCE(SUM(animal_count), 0) INTO v_lote_total
    FROM public.lote_size_compositions
    WHERE lote_id = v_lote_id;

    IF v_lote_total = 0 THEN
        UPDATE public.lotes
        SET status = 'cerrado', closed_at = NOW(), updated_at = NOW()
        WHERE id = v_lote_id;
    END IF;

    RETURN p_id;
END;
$$;
