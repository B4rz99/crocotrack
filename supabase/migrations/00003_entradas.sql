-- ============================================
-- ENTRADA ORIGIN TYPE ENUM
-- ============================================
CREATE TYPE public.entrada_origin_type AS ENUM (
    'proveedor_persona',
    'proveedor_empresa',
    'finca_propia',
    'incubador'
);

-- ============================================
-- ENTRADAS (animal entries)
-- ============================================
CREATE TABLE public.entradas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id                 UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id                 UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    lote_id                 UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
    origin_type             public.entrada_origin_type NOT NULL,
    entry_date              DATE NOT NULL,
    total_animals           INTEGER NOT NULL CHECK (total_animals > 0),
    notes                   TEXT,
    created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Proveedor persona
    persona_full_name       TEXT,
    persona_document_id     TEXT,
    persona_aval_code       TEXT,
    persona_aval_file_path  TEXT,

    -- Proveedor empresa
    empresa_name            TEXT,
    empresa_legal_rep       TEXT,
    empresa_nit             TEXT,
    empresa_aval_code       TEXT,
    empresa_aval_file_path  TEXT,

    -- Finca propia
    origin_farm_id          UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    origin_pool_id          UUID REFERENCES public.pools(id) ON DELETE SET NULL,

    -- Incubador
    nido_number             TEXT,
    eclosion_date           DATE
);

CREATE INDEX idx_entradas_org_id ON public.entradas(org_id);
CREATE INDEX idx_entradas_farm_id ON public.entradas(farm_id);
CREATE INDEX idx_entradas_pool_id ON public.entradas(pool_id);
CREATE INDEX idx_entradas_lote_id ON public.entradas(lote_id);
CREATE INDEX idx_entradas_origin_type ON public.entradas(origin_type);
CREATE INDEX idx_entradas_entry_date ON public.entradas(entry_date DESC);
CREATE INDEX idx_entradas_created_by ON public.entradas(created_by);

CREATE TRIGGER entradas_updated_at
    BEFORE UPDATE ON public.entradas
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- ENTRY SIZE GROUPS
-- ============================================
CREATE TABLE public.entry_size_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entrada_id      UUID NOT NULL REFERENCES public.entradas(id) ON DELETE CASCADE,
    size_inches     SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count    INTEGER NOT NULL CHECK (animal_count > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entry_size_groups_entrada_id ON public.entry_size_groups(entrada_id);

CREATE TRIGGER entry_size_groups_updated_at
    BEFORE UPDATE ON public.entry_size_groups
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- RLS — entradas
-- ============================================
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas FORCE ROW LEVEL SECURITY;

CREATE POLICY "entradas_select" ON public.entradas FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "entradas_insert" ON public.entradas FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "entradas_update" ON public.entradas FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "entradas_delete" ON public.entradas FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RLS — entry_size_groups (parent-join pattern)
-- ============================================
ALTER TABLE public.entry_size_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_size_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY "entry_size_select" ON public.entry_size_groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.entradas e
            WHERE e.id = entrada_id
              AND e.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "entry_size_insert" ON public.entry_size_groups FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.entradas e
            WHERE e.id = entrada_id
              AND e.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(e.farm_id))
        )
    );

CREATE POLICY "entry_size_update" ON public.entry_size_groups FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.entradas e
            WHERE e.id = entrada_id
              AND e.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(e.farm_id))
        )
    );

CREATE POLICY "entry_size_delete" ON public.entry_size_groups FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.entradas e
            WHERE e.id = entrada_id
              AND e.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );

-- ============================================
-- STORAGE BUCKET: aval-documents
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('aval-documents', 'aval-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "aval_upload" ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'aval-documents'
        AND (storage.foldername(name))[1] = (SELECT public.get_user_org_id())::text
    );

CREATE POLICY "aval_read" ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'aval-documents'
        AND (storage.foldername(name))[1] = (SELECT public.get_user_org_id())::text
    );

CREATE POLICY "aval_delete" ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'aval-documents'
        AND (storage.foldername(name))[1] = (SELECT public.get_user_org_id())::text
        AND (SELECT public.is_owner())
    );

-- ============================================
-- FUNCTION: create_entrada()
-- Atomic transaction: creates entrada, links/creates lote,
-- inserts size groups, updates lote compositions, handles
-- finca_propia origin lote decrement.
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
BEGIN
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
        VALUES (p_pool_id, p_org_id, p_farm_id, 'activo', NOW(), auth.uid())
        RETURNING id INTO v_lote_id;
    END IF;

    -- 3. Insert entrada record
    INSERT INTO public.entradas (
        id, org_id, farm_id, pool_id, lote_id, origin_type, entry_date,
        total_animals, notes, created_by, is_active,
        persona_full_name, persona_document_id, persona_aval_code, persona_aval_file_path,
        empresa_name, empresa_legal_rep, empresa_nit, empresa_aval_code, empresa_aval_file_path,
        origin_farm_id, origin_pool_id,
        nido_number, eclosion_date
    ) VALUES (
        p_id, p_org_id, p_farm_id, p_pool_id, v_lote_id, p_origin_type, p_entry_date,
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

        IF v_origin_lote_id IS NOT NULL THEN
            -- Decrement each size group
            FOR v_size, v_count IN
                SELECT (item->>'size_inches')::SMALLINT, (item->>'animal_count')::INTEGER
                FROM jsonb_array_elements(p_compositions) AS item
            LOOP
                UPDATE public.lote_size_compositions
                SET animal_count = animal_count - v_count,
                    updated_at = NOW()
                WHERE lote_id = v_origin_lote_id
                  AND size_inches = v_size;
            END LOOP;

            -- Delete zero or negative count rows
            DELETE FROM public.lote_size_compositions
            WHERE lote_id = v_origin_lote_id AND animal_count <= 0;

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
    END IF;

    RETURN p_id;
END;
$$;
