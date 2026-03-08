-- ============================================
-- Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pg_uuidv7";
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- ============================================
-- ORGANIZATIONS (Tenants)
-- ============================================
CREATE TABLE public.organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    country         TEXT NOT NULL DEFAULT 'CO',
    currency        TEXT NOT NULL DEFAULT 'COP',
    settings        JSONB NOT NULL DEFAULT '{}',
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    avatar_url      TEXT,
    phone           TEXT,
    role            TEXT NOT NULL CHECK (role IN ('owner', 'worker')) DEFAULT 'worker',
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_org_id ON public.profiles(org_id);
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- FARMS
-- ============================================
CREATE TABLE public.farms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    location        TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farms_org_id ON public.farms(org_id);
CREATE TRIGGER farms_updated_at
    BEFORE UPDATE ON public.farms
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- USER_FARM_ASSIGNMENTS
-- ============================================
CREATE TABLE public.user_farm_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, farm_id)
);

CREATE INDEX idx_user_farm_user ON public.user_farm_assignments(user_id);
CREATE INDEX idx_user_farm_farm ON public.user_farm_assignments(farm_id);

-- ============================================
-- POOLS (piletas + pozos reproductores)
-- ============================================
CREATE TYPE public.pool_type AS ENUM ('crianza', 'reproductor');

CREATE TABLE public.pools (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    code            TEXT,
    pool_type       public.pool_type NOT NULL,
    capacity        INTEGER CHECK (capacity > 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pools_org_id ON public.pools(org_id);
CREATE INDEX idx_pools_farm_id ON public.pools(farm_id);
CREATE TRIGGER pools_updated_at
    BEFORE UPDATE ON public.pools
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- INCUBATORS
-- ============================================
CREATE TABLE public.incubators (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    capacity        INTEGER CHECK (capacity > 0),
    temp_min        NUMERIC(4,1),
    temp_max        NUMERIC(4,1),
    humidity_min    NUMERIC(4,1),
    humidity_max    NUMERIC(4,1),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incubators_org_id ON public.incubators(org_id);
CREATE INDEX idx_incubators_farm_id ON public.incubators(farm_id);
CREATE TRIGGER incubators_updated_at
    BEFORE UPDATE ON public.incubators
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- FOOD TYPES
-- ============================================
CREATE TABLE public.food_types (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'kg',
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_types_org_id ON public.food_types(org_id);
CREATE TRIGGER food_types_updated_at
    BEFORE UPDATE ON public.food_types
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- INVITATIONS
-- ============================================
CREATE TABLE public.invitations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'worker',
    farm_ids        UUID[] NOT NULL DEFAULT '{}',
    invited_by      UUID NOT NULL REFERENCES public.profiles(id),
    token           TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_org_id ON public.invitations(org_id);
CREATE INDEX idx_invitations_invited_by ON public.invitations(invited_by);

-- ============================================
-- RLS HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT org_id FROM public.profiles WHERE id = (select auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role = 'owner' FROM public.profiles WHERE id = (select auth.uid());
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON public.organizations FOR SELECT
    TO authenticated
    USING (id = (select public.get_user_org_id()));

CREATE POLICY "org_update" ON public.organizations FOR UPDATE
    TO authenticated
    USING (id = (select public.get_user_org_id()) AND (select public.is_owner()));

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
    TO authenticated
    USING (org_id = (select public.get_user_org_id()));

CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = (select auth.uid()));

-- farms
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms FORCE ROW LEVEL SECURITY;

CREATE POLICY "farms_select" ON public.farms FOR SELECT
    TO authenticated
    USING (org_id = (select public.get_user_org_id()));

CREATE POLICY "farms_insert" ON public.farms FOR INSERT
    TO authenticated
    WITH CHECK (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "farms_update" ON public.farms FOR UPDATE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "farms_delete" ON public.farms FOR DELETE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

-- pools
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools FORCE ROW LEVEL SECURITY;

CREATE POLICY "pools_select" ON public.pools FOR SELECT
    TO authenticated
    USING (org_id = (select public.get_user_org_id()));

CREATE POLICY "pools_insert" ON public.pools FOR INSERT
    TO authenticated
    WITH CHECK (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "pools_update" ON public.pools FOR UPDATE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "pools_delete" ON public.pools FOR DELETE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

-- incubators
ALTER TABLE public.incubators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incubators FORCE ROW LEVEL SECURITY;

CREATE POLICY "incubators_select" ON public.incubators FOR SELECT
    TO authenticated
    USING (org_id = (select public.get_user_org_id()));

CREATE POLICY "incubators_insert" ON public.incubators FOR INSERT
    TO authenticated
    WITH CHECK (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "incubators_update" ON public.incubators FOR UPDATE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "incubators_delete" ON public.incubators FOR DELETE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

-- food_types
ALTER TABLE public.food_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_types FORCE ROW LEVEL SECURITY;

CREATE POLICY "food_types_select" ON public.food_types FOR SELECT
    TO authenticated
    USING (org_id = (select public.get_user_org_id()));

CREATE POLICY "food_types_insert" ON public.food_types FOR INSERT
    TO authenticated
    WITH CHECK (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "food_types_update" ON public.food_types FOR UPDATE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "food_types_delete" ON public.food_types FOR DELETE
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

-- user_farm_assignments
ALTER TABLE public.user_farm_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_farm_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY "ufa_select" ON public.user_farm_assignments FOR SELECT
    TO authenticated
    USING (
        user_id = (select auth.uid())
        OR (select public.is_owner())
    );

CREATE POLICY "ufa_manage" ON public.user_farm_assignments FOR ALL
    TO authenticated
    USING ((select public.is_owner()));

-- invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select" ON public.invitations FOR SELECT
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

CREATE POLICY "invitations_manage" ON public.invitations FOR ALL
    TO authenticated
    USING (org_id = (select public.get_user_org_id()) AND (select public.is_owner()));

-- ============================================
-- AUTH TRIGGER: handle new user registration
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_org_id UUID;
    invitation_record RECORD;
BEGIN
    SELECT * INTO invitation_record
    FROM public.invitations
    WHERE email = NEW.email
      AND status = 'pending'
      AND expires_at > NOW()
    LIMIT 1;

    IF invitation_record IS NOT NULL THEN
        INSERT INTO public.profiles (id, email, full_name, role, org_id)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            invitation_record.role,
            invitation_record.org_id
        );

        IF array_length(invitation_record.farm_ids, 1) > 0 THEN
            INSERT INTO public.user_farm_assignments (user_id, farm_id)
            SELECT NEW.id, unnest(invitation_record.farm_ids);
        END IF;

        UPDATE public.invitations SET status = 'accepted' WHERE id = invitation_record.id;
    ELSE
        INSERT INTO public.organizations (name, slug)
        VALUES (
            COALESCE(NEW.raw_user_meta_data->>'org_name', 'Mi Criadero'),
            COALESCE(
                lower(regexp_replace(NEW.raw_user_meta_data->>'org_name', '[^a-zA-Z0-9]', '-', 'g')),
                'org-' || substr(NEW.id::text, 1, 8)
            )
        )
        RETURNING id INTO new_org_id;

        INSERT INTO public.profiles (id, email, full_name, role, org_id)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            'owner',
            new_org_id
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
