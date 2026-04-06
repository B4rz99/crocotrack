-- Harden limpieza RLS and create_limpieza duplicate detection.
-- Safe if 00011_limpieza.sql was already applied with older policies / RPC body.

-- Helper to check pool belongs to farm and org without subquery column-name ambiguity.
-- In a correlated EXISTS subquery, an unqualified `farm_id` resolves to the nearest
-- FROM-clause table first (pools also has farm_id), making the check vacuous.
-- Passing as explicit function parameters avoids that scoping issue.
-- Also enforces pools.org_id = p_org_id (defense in depth: pools and farms are not
-- constrained to share org_id at the FK level, so pool_in_farm(pool, farm) alone
-- would not guarantee tenant isolation).
CREATE OR REPLACE FUNCTION public.pool_in_farm(p_pool_id UUID, p_farm_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id
          AND farm_id = p_farm_id
          AND org_id = p_org_id
    );
$$;

DROP POLICY IF EXISTS "cleaning_product_stock_insert" ON public.cleaning_product_stock;
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

DROP POLICY IF EXISTS "cleaning_product_stock_update" ON public.cleaning_product_stock;
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

DROP POLICY IF EXISTS "cleaning_product_purchases_insert" ON public.cleaning_product_purchases;
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

DROP POLICY IF EXISTS "cleaning_product_purchases_update" ON public.cleaning_product_purchases;
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

DROP POLICY IF EXISTS "limpiezas_insert" ON public.limpiezas;
CREATE POLICY "limpiezas_insert" ON public.limpiezas FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND (SELECT public.pool_in_farm(pool_id, farm_id, org_id))
    );

DROP POLICY IF EXISTS "limpiezas_update" ON public.limpiezas;
CREATE POLICY "limpiezas_update" ON public.limpiezas FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    )
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
        AND (SELECT public.pool_in_farm(pool_id, farm_id, org_id))
    );

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
