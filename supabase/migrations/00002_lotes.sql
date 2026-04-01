-- ============================================
-- LOTE STATUS ENUM
-- ============================================
CREATE TYPE public.lote_status AS ENUM ('activo', 'cerrado');

-- ============================================
-- LOTES (batches)
-- ============================================
CREATE TABLE public.lotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id         UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    status          public.lote_status NOT NULL DEFAULT 'activo',
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: one active lote per pool
CREATE UNIQUE INDEX idx_lotes_one_active_per_pool ON public.lotes(pool_id) WHERE status = 'activo';

CREATE INDEX idx_lotes_pool_id ON public.lotes(pool_id);
CREATE INDEX idx_lotes_org_id ON public.lotes(org_id);
CREATE INDEX idx_lotes_farm_id ON public.lotes(farm_id);
CREATE INDEX idx_lotes_status ON public.lotes(status);

CREATE TRIGGER lotes_updated_at
    BEFORE UPDATE ON public.lotes
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- LOTE SIZE COMPOSITIONS
-- ============================================
CREATE TABLE public.lote_size_compositions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lote_id         UUID NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
    size_inches     SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count    INTEGER NOT NULL CHECK (animal_count > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_lote_size_unique ON public.lote_size_compositions(lote_id, size_inches);
CREATE INDEX idx_lote_size_lote_id ON public.lote_size_compositions(lote_id);

CREATE TRIGGER lote_size_compositions_updated_at
    BEFORE UPDATE ON public.lote_size_compositions
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- WORKER RLS HELPER: user_has_farm_access()
-- ============================================
CREATE OR REPLACE FUNCTION public.user_has_farm_access(p_farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.org_id = (SELECT f.org_id FROM public.farms f WHERE f.id = p_farm_id)
          AND (
              p.role = 'owner'
              OR EXISTS (
                  SELECT 1
                  FROM public.user_farm_assignments ufa
                  WHERE ufa.user_id = p.id AND ufa.farm_id = p_farm_id
              )
          )
    );
$$;

-- ============================================
-- RLS POLICIES — lotes
-- ============================================
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes FORCE ROW LEVEL SECURITY;

CREATE POLICY "lotes_select" ON public.lotes FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "lotes_insert" ON public.lotes FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "lotes_update" ON public.lotes FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "lotes_delete" ON public.lotes FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RLS POLICIES — lote_size_compositions
-- ============================================
ALTER TABLE public.lote_size_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote_size_compositions FORCE ROW LEVEL SECURITY;

CREATE POLICY "lote_size_select" ON public.lote_size_compositions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lotes l
            WHERE l.id = lote_id
              AND l.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "lote_size_insert" ON public.lote_size_compositions FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lotes l
            WHERE l.id = lote_id
              AND l.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(l.farm_id))
        )
    );

CREATE POLICY "lote_size_update" ON public.lote_size_compositions FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lotes l
            WHERE l.id = lote_id
              AND l.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(l.farm_id))
        )
    );

CREATE POLICY "lote_size_delete" ON public.lote_size_compositions FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lotes l
            WHERE l.id = lote_id
              AND l.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );
