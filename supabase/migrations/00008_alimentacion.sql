-- ============================================
-- Migration: alimentacion
-- Creates alimentaciones, food_stock, food_purchases,
-- RLS policies, and RPCs.
-- ============================================

-- ============================================
-- ALIMENTACIONES
-- ============================================
CREATE TABLE public.alimentaciones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id         UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    lote_id         UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
    food_type_id    UUID NOT NULL REFERENCES public.food_types(id) ON DELETE RESTRICT,
    event_date      DATE NOT NULL,
    quantity_kg     NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    notes           TEXT,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alimentaciones_org_id ON public.alimentaciones(org_id);
CREATE INDEX idx_alimentaciones_farm_id ON public.alimentaciones(farm_id);
CREATE INDEX idx_alimentaciones_pool_id ON public.alimentaciones(pool_id);
CREATE INDEX idx_alimentaciones_lote_id ON public.alimentaciones(lote_id);
CREATE INDEX idx_alimentaciones_food_type_id ON public.alimentaciones(food_type_id);
CREATE INDEX idx_alimentaciones_created_by ON public.alimentaciones(created_by);
CREATE INDEX idx_alimentaciones_event_date ON public.alimentaciones(event_date DESC);
CREATE INDEX idx_alimentaciones_active ON public.alimentaciones(farm_id, event_date DESC) WHERE is_active = true;

CREATE TRIGGER alimentaciones_updated_at
    BEFORE UPDATE ON public.alimentaciones
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.alimentaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alimentaciones FORCE ROW LEVEL SECURITY;

CREATE POLICY "alimentaciones_select" ON public.alimentaciones FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "alimentaciones_insert" ON public.alimentaciones FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "alimentaciones_update" ON public.alimentaciones FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "alimentaciones_delete" ON public.alimentaciones FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- FOOD_STOCK
-- ============================================
CREATE TABLE public.food_stock (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id          UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    food_type_id     UUID NOT NULL REFERENCES public.food_types(id) ON DELETE RESTRICT,
    current_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
    low_stock_threshold NUMERIC(10,2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, food_type_id)
);

CREATE INDEX idx_food_stock_org_id ON public.food_stock(org_id);
CREATE INDEX idx_food_stock_farm_id ON public.food_stock(farm_id);
CREATE INDEX idx_food_stock_food_type_id ON public.food_stock(food_type_id);

CREATE TRIGGER food_stock_updated_at
    BEFORE UPDATE ON public.food_stock
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.food_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_stock FORCE ROW LEVEL SECURITY;

CREATE POLICY "food_stock_select" ON public.food_stock FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "food_stock_insert" ON public.food_stock FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "food_stock_update" ON public.food_stock FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "food_stock_delete" ON public.food_stock FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- FOOD_PURCHASES
-- ============================================
CREATE TABLE public.food_purchases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    food_type_id    UUID NOT NULL REFERENCES public.food_types(id) ON DELETE RESTRICT,
    purchase_date   DATE NOT NULL,
    quantity_kg     NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    supplier        TEXT,
    notes           TEXT,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_purchases_org_id ON public.food_purchases(org_id);
CREATE INDEX idx_food_purchases_farm_id ON public.food_purchases(farm_id);
CREATE INDEX idx_food_purchases_food_type_id ON public.food_purchases(food_type_id);
CREATE INDEX idx_food_purchases_created_by ON public.food_purchases(created_by);
CREATE INDEX idx_food_purchases_purchase_date ON public.food_purchases(purchase_date DESC);
CREATE INDEX idx_food_purchases_active ON public.food_purchases(farm_id, purchase_date DESC) WHERE is_active = true;

CREATE TRIGGER food_purchases_updated_at
    BEFORE UPDATE ON public.food_purchases
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.food_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_purchases FORCE ROW LEVEL SECURITY;

CREATE POLICY "food_purchases_select" ON public.food_purchases FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "food_purchases_insert" ON public.food_purchases FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "food_purchases_update" ON public.food_purchases FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "food_purchases_delete" ON public.food_purchases FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RPC: create_alimentacion
-- ============================================
CREATE OR REPLACE FUNCTION public.create_alimentacion(
    p_id            UUID,
    p_org_id        UUID,
    p_farm_id       UUID,
    p_pool_id       UUID,
    p_food_type_id  UUID,
    p_event_date    DATE,
    p_quantity_kg   NUMERIC,
    p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_caller_org_id UUID;
    v_pool_type     public.pool_type;
    v_lote_id       UUID;
BEGIN
    -- 1. Resolve caller's org (do NOT trust p_org_id)
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    -- 2. Guard: pool belongs to caller's org
    SELECT pool_type INTO v_pool_type
    FROM public.pools
    WHERE id = p_pool_id AND org_id = v_caller_org_id;

    IF v_pool_type IS NULL THEN
        RAISE EXCEPTION 'La pileta no pertenece a su organizacion';
    END IF;

    -- 3. Guard: food type belongs to caller's org
    IF NOT EXISTS (
        SELECT 1 FROM public.food_types
        WHERE id = p_food_type_id AND org_id = v_caller_org_id
    ) THEN
        RAISE EXCEPTION 'El tipo de alimento no pertenece a su organizacion';
    END IF;

    -- 4. Guard: quantity must be positive
    IF p_quantity_kg <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    -- 5. Find active lote (nullable for reproductor pools)
    SELECT id INTO v_lote_id
    FROM public.lotes
    WHERE pool_id = p_pool_id AND status = 'activo';

    -- 6. Insert alimentacion record
    INSERT INTO public.alimentaciones (
        id, org_id, farm_id, pool_id, lote_id, food_type_id,
        event_date, quantity_kg, notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_lote_id, p_food_type_id,
        p_event_date, p_quantity_kg, p_notes, auth.uid(), true
    );

    -- 7. Upsert food_stock: decrement (allow negative)
    INSERT INTO public.food_stock (org_id, farm_id, food_type_id, current_quantity)
    VALUES (v_caller_org_id, p_farm_id, p_food_type_id, -p_quantity_kg)
    ON CONFLICT (farm_id, food_type_id)
    DO UPDATE SET
        current_quantity = food_stock.current_quantity - p_quantity_kg,
        updated_at = NOW();

    RETURN p_id;
END;
$$;

-- ============================================
-- RPC: create_food_purchase
-- ============================================
CREATE OR REPLACE FUNCTION public.create_food_purchase(
    p_id            UUID,
    p_org_id        UUID,
    p_farm_id       UUID,
    p_food_type_id  UUID,
    p_purchase_date DATE,
    p_quantity_kg   NUMERIC,
    p_supplier      TEXT DEFAULT NULL,
    p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_caller_org_id UUID;
BEGIN
    -- 1. Resolve caller's org
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    -- 2. Guard: farm belongs to caller's org
    IF NOT EXISTS (
        SELECT 1 FROM public.farms
        WHERE id = p_farm_id AND org_id = v_caller_org_id
    ) THEN
        RAISE EXCEPTION 'La finca no pertenece a su organizacion';
    END IF;

    -- 3. Guard: food type belongs to caller's org
    IF NOT EXISTS (
        SELECT 1 FROM public.food_types
        WHERE id = p_food_type_id AND org_id = v_caller_org_id
    ) THEN
        RAISE EXCEPTION 'El tipo de alimento no pertenece a su organizacion';
    END IF;

    -- 4. Guard: quantity must be positive
    IF p_quantity_kg <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    -- 5. Insert food_purchase record
    INSERT INTO public.food_purchases (
        id, org_id, farm_id, food_type_id, purchase_date,
        quantity_kg, supplier, notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_food_type_id, p_purchase_date,
        p_quantity_kg, p_supplier, p_notes, auth.uid(), true
    );

    -- 6. Upsert food_stock: increment
    INSERT INTO public.food_stock (org_id, farm_id, food_type_id, current_quantity)
    VALUES (v_caller_org_id, p_farm_id, p_food_type_id, p_quantity_kg)
    ON CONFLICT (farm_id, food_type_id)
    DO UPDATE SET
        current_quantity = food_stock.current_quantity + p_quantity_kg,
        updated_at = NOW();

    RETURN p_id;
END;
$$;
