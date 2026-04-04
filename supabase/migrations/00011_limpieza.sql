-- ============================================
-- Migration 00011: limpieza
-- cleaning_product_types, cleaning_product_stock,
-- cleaning_product_purchases, limpiezas, limpieza_products,
-- farms.cleaning_frequency_days, RLS, create_limpieza,
-- create_cleaning_product_purchase.
-- ============================================

-- ============================================
-- CLEANING PRODUCT TYPES
-- ============================================
CREATE TABLE public.cleaning_product_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleaning_product_types_org_id ON public.cleaning_product_types(org_id);

CREATE TRIGGER cleaning_product_types_updated_at
    BEFORE UPDATE ON public.cleaning_product_types
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.cleaning_product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_product_types FORCE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_product_types_select" ON public.cleaning_product_types FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "cleaning_product_types_insert" ON public.cleaning_product_types FOR INSERT
    TO authenticated
    WITH CHECK (org_id = (SELECT public.get_user_org_id()) AND (SELECT public.is_owner()));

CREATE POLICY "cleaning_product_types_update" ON public.cleaning_product_types FOR UPDATE
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()) AND (SELECT public.is_owner()));

CREATE POLICY "cleaning_product_types_delete" ON public.cleaning_product_types FOR DELETE
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()) AND (SELECT public.is_owner()));

-- ============================================
-- CLEANING PRODUCT STOCK
-- ============================================
CREATE TABLE public.cleaning_product_stock (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id                     UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    cleaning_product_type_id    UUID NOT NULL REFERENCES public.cleaning_product_types(id) ON DELETE RESTRICT,
    current_quantity            INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold         INTEGER,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, cleaning_product_type_id)
);

CREATE INDEX idx_cleaning_product_stock_org_id ON public.cleaning_product_stock(org_id);
CREATE INDEX idx_cleaning_product_stock_farm_id ON public.cleaning_product_stock(farm_id);
CREATE INDEX idx_cleaning_product_stock_type_id ON public.cleaning_product_stock(cleaning_product_type_id);

CREATE TRIGGER cleaning_product_stock_updated_at
    BEFORE UPDATE ON public.cleaning_product_stock
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.cleaning_product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_product_stock FORCE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_product_stock_select" ON public.cleaning_product_stock FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "cleaning_product_stock_insert" ON public.cleaning_product_stock FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND EXISTS (
            SELECT 1 FROM public.cleaning_product_types cpt
            WHERE cpt.id = cleaning_product_type_id
              AND cpt.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "cleaning_product_stock_update" ON public.cleaning_product_stock FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    )
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND EXISTS (
            SELECT 1 FROM public.cleaning_product_types cpt
            WHERE cpt.id = cleaning_product_type_id
              AND cpt.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "cleaning_product_stock_delete" ON public.cleaning_product_stock FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- CLEANING PRODUCT PURCHASES
-- ============================================
CREATE TABLE public.cleaning_product_purchases (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id                     UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    cleaning_product_type_id    UUID NOT NULL REFERENCES public.cleaning_product_types(id) ON DELETE RESTRICT,
    purchase_date               DATE NOT NULL,
    quantity                    INTEGER NOT NULL CHECK (quantity > 0),
    supplier                    TEXT,
    notes                       TEXT,
    created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleaning_product_purchases_org_id ON public.cleaning_product_purchases(org_id);
CREATE INDEX idx_cleaning_product_purchases_farm_id ON public.cleaning_product_purchases(farm_id);
CREATE INDEX idx_cleaning_product_purchases_type_id ON public.cleaning_product_purchases(cleaning_product_type_id);
CREATE INDEX idx_cleaning_product_purchases_created_by ON public.cleaning_product_purchases(created_by);
CREATE INDEX idx_cleaning_product_purchases_purchase_date ON public.cleaning_product_purchases(purchase_date DESC);
CREATE INDEX idx_cleaning_product_purchases_active ON public.cleaning_product_purchases(farm_id, purchase_date DESC)
    WHERE is_active = true;

CREATE TRIGGER cleaning_product_purchases_updated_at
    BEFORE UPDATE ON public.cleaning_product_purchases
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.cleaning_product_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_product_purchases FORCE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_product_purchases_select" ON public.cleaning_product_purchases FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "cleaning_product_purchases_insert" ON public.cleaning_product_purchases FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND EXISTS (
            SELECT 1 FROM public.cleaning_product_types cpt
            WHERE cpt.id = cleaning_product_type_id
              AND cpt.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "cleaning_product_purchases_update" ON public.cleaning_product_purchases FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    )
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND EXISTS (
            SELECT 1 FROM public.cleaning_product_types cpt
            WHERE cpt.id = cleaning_product_type_id
              AND cpt.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "cleaning_product_purchases_delete" ON public.cleaning_product_purchases FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- LIMPIEZAS
-- ============================================
CREATE TABLE public.limpiezas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id         UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    event_date      DATE NOT NULL,
    notes           TEXT,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_limpiezas_org_id ON public.limpiezas(org_id);
CREATE INDEX idx_limpiezas_farm_id ON public.limpiezas(farm_id);
CREATE INDEX idx_limpiezas_pool_id ON public.limpiezas(pool_id);
CREATE INDEX idx_limpiezas_created_by ON public.limpiezas(created_by);
CREATE INDEX idx_limpiezas_event_date ON public.limpiezas(event_date DESC);
CREATE INDEX idx_limpiezas_active ON public.limpiezas(farm_id, event_date DESC)
    WHERE is_active = true;

CREATE TRIGGER limpiezas_updated_at
    BEFORE UPDATE ON public.limpiezas
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.limpiezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limpiezas FORCE ROW LEVEL SECURITY;

CREATE POLICY "limpiezas_select" ON public.limpiezas FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "limpiezas_insert" ON public.limpiezas FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND EXISTS (
            SELECT 1 FROM public.pools p
            WHERE p.id = pool_id
              AND p.farm_id = farm_id
              AND p.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "limpiezas_update" ON public.limpiezas FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    )
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND EXISTS (
            SELECT 1 FROM public.pools p
            WHERE p.id = pool_id
              AND p.farm_id = farm_id
              AND p.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "limpiezas_delete" ON public.limpiezas FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- LIMPIEZA PRODUCTS
-- ============================================
CREATE TABLE public.limpieza_products (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limpieza_id                 UUID NOT NULL REFERENCES public.limpiezas(id) ON DELETE CASCADE,
    cleaning_product_type_id    UUID NOT NULL REFERENCES public.cleaning_product_types(id) ON DELETE RESTRICT,
    quantity                    INTEGER NOT NULL CHECK (quantity > 0),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_limpieza_products_limpieza_id ON public.limpieza_products(limpieza_id);
CREATE INDEX idx_limpieza_products_type_id ON public.limpieza_products(cleaning_product_type_id);

CREATE TRIGGER limpieza_products_updated_at
    BEFORE UPDATE ON public.limpieza_products
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.limpieza_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limpieza_products FORCE ROW LEVEL SECURITY;

CREATE POLICY "limpieza_products_select" ON public.limpieza_products FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.limpiezas l
            WHERE l.id = limpieza_id
              AND l.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "limpieza_products_insert" ON public.limpieza_products FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.limpiezas l
            WHERE l.id = limpieza_id
              AND l.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(l.farm_id))
        )
    );

CREATE POLICY "limpieza_products_update" ON public.limpieza_products FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.limpiezas l
            WHERE l.id = limpieza_id
              AND l.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(l.farm_id))
        )
    );

CREATE POLICY "limpieza_products_delete" ON public.limpieza_products FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.limpiezas l
            WHERE l.id = limpieza_id
              AND l.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );

-- ============================================
-- FARMS: cleaning frequency (nullable)
-- ============================================
ALTER TABLE public.farms
    ADD COLUMN cleaning_frequency_days INTEGER CHECK (cleaning_frequency_days > 0);

-- ============================================
-- RPC: create_limpieza
-- ============================================
CREATE OR REPLACE FUNCTION public.create_limpieza(
    p_id            UUID,
    p_org_id        UUID,
    p_farm_id       UUID,
    p_pool_id       UUID,
    p_event_date    DATE,
    p_products      JSONB,
    p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_caller_org_id UUID;
    v_dup_count     BIGINT;
BEGIN
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.farms
        WHERE id = p_farm_id AND org_id = v_caller_org_id
    ) THEN
        RAISE EXCEPTION 'La finca no pertenece a su organizacion';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id AND org_id = v_caller_org_id AND farm_id = p_farm_id
    ) THEN
        RAISE EXCEPTION 'La pileta no pertenece a la finca o a su organizacion';
    END IF;

    IF p_products IS NULL OR jsonb_typeof(p_products) <> 'array' OR jsonb_array_length(p_products) <= 0 THEN
        RAISE EXCEPTION 'Debe incluir al menos un producto de limpieza';
    END IF;

    SELECT COUNT(*) - COUNT(DISTINCT (item->>'cleaning_product_type_id')::uuid)
    INTO v_dup_count
    FROM jsonb_array_elements(p_products) AS item;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'No se permiten productos duplicados en la misma limpieza';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_products) AS item
        WHERE (item->>'quantity')::INTEGER <= 0
    ) THEN
        RAISE EXCEPTION 'La cantidad de cada producto debe ser mayor a 0';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_products) AS item
        WHERE NOT EXISTS (
            SELECT 1 FROM public.cleaning_product_types cpt
            WHERE cpt.id = (item->>'cleaning_product_type_id')::UUID
              AND cpt.org_id = v_caller_org_id
              AND cpt.is_active = true
        )
    ) THEN
        RAISE EXCEPTION 'Tipo de producto de limpieza invalido o inactivo';
    END IF;

    INSERT INTO public.limpiezas (
        id, org_id, farm_id, pool_id, event_date, notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, p_event_date, p_notes, auth.uid(), true
    );

    INSERT INTO public.limpieza_products (limpieza_id, cleaning_product_type_id, quantity)
    SELECT
        p_id,
        (x->>'cleaning_product_type_id')::UUID,
        (x->>'quantity')::INTEGER
    FROM jsonb_array_elements(p_products) AS x;

    INSERT INTO public.cleaning_product_stock (org_id, farm_id, cleaning_product_type_id, current_quantity)
    SELECT
        v_caller_org_id,
        p_farm_id,
        (x->>'cleaning_product_type_id')::UUID,
        -(x->>'quantity')::INTEGER
    FROM jsonb_array_elements(p_products) AS x
    ON CONFLICT (farm_id, cleaning_product_type_id)
    DO UPDATE SET
        current_quantity = cleaning_product_stock.current_quantity + EXCLUDED.current_quantity,
        updated_at = NOW();

    RETURN p_id;
END;
$$;

-- ============================================
-- RPC: create_cleaning_product_purchase
-- ============================================
CREATE OR REPLACE FUNCTION public.create_cleaning_product_purchase(
    p_id                        UUID,
    p_org_id                    UUID,
    p_farm_id                   UUID,
    p_cleaning_product_type_id  UUID,
    p_purchase_date             DATE,
    p_quantity                  INTEGER,
    p_supplier                  TEXT DEFAULT NULL,
    p_notes                     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_caller_org_id UUID;
BEGIN
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.farms
        WHERE id = p_farm_id AND org_id = v_caller_org_id
    ) THEN
        RAISE EXCEPTION 'La finca no pertenece a su organizacion';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.cleaning_product_types
        WHERE id = p_cleaning_product_type_id
          AND org_id = v_caller_org_id
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'El tipo de producto de limpieza no pertenece a su organizacion o esta inactivo';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    INSERT INTO public.cleaning_product_purchases (
        id, org_id, farm_id, cleaning_product_type_id, purchase_date,
        quantity, supplier, notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_cleaning_product_type_id, p_purchase_date,
        p_quantity, p_supplier, p_notes, auth.uid(), true
    );

    INSERT INTO public.cleaning_product_stock (org_id, farm_id, cleaning_product_type_id, current_quantity)
    VALUES (v_caller_org_id, p_farm_id, p_cleaning_product_type_id, p_quantity)
    ON CONFLICT (farm_id, cleaning_product_type_id)
    DO UPDATE SET
        current_quantity = cleaning_product_stock.current_quantity + EXCLUDED.current_quantity,
        updated_at = NOW();

    RETURN p_id;
END;
$$;
