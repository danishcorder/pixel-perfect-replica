-- Phase 2: Authentication, User Roles, Institutions, Invitations & Multi-Tenant RLS
-- Target: Supabase PostgreSQL (public + auth schemas)

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.institution_role AS ENUM (
    'institution_admin',
    'teacher',
    'student',
    'invigilator'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.institution_status AS ENUM ('active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM (
    'pending',
    'accepted',
    'revoked',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- 2.1 User profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text,
  timezone text NOT NULL DEFAULT 'UTC',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Platform Super Admins (strictly server/DB-managed; never self-assignable)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.3 Institutions (tenants)
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 80),
  institution_type text NOT NULL DEFAULT 'university'
    CHECK (institution_type IN ('school', 'college', 'university', 'training_centre')),
  status public.institution_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.4 Institution Memberships (user <-> institution + role)
CREATE TABLE IF NOT EXISTS public.institution_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.institution_role NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_institution_memberships_user_id
  ON public.institution_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_institution_memberships_institution_role
  ON public.institution_memberships (institution_id, role, status);

-- 2.5 Institution Invitations
CREATE TABLE IF NOT EXISTS public.institution_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(trim(email)) >= 3 AND char_length(email) <= 255),
  role public.institution_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_institution_invite
  ON public.institution_invitations (institution_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_institution_invitations_email
  ON public.institution_invitations (lower(email), status);

-- 2.6 Institution Audit Logs (institution-owned table)
CREATE TABLE IF NOT EXISTS public.institution_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_audit_logs_inst_created
  ON public.institution_audit_logs (institution_id, created_at DESC);

-- ============================================================================
-- 3. SECURITY-DEFINER HELPER FUNCTIONS (avoid RLS recursion; search_path locked)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = p_user_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_institution_member(
  p_institution_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_institution_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.institution_memberships m
      JOIN public.institutions i ON i.id = m.institution_id
      WHERE m.institution_id = p_institution_id
        AND m.user_id = p_user_id
        AND m.status = 'active'
        AND i.status = 'active'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_institution_role(
  p_institution_id uuid,
  p_roles public.institution_role[],
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_institution_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.institution_memberships m
      JOIN public.institutions i ON i.id = m.institution_id
      WHERE m.institution_id = p_institution_id
        AND m.user_id = p_user_id
        AND m.status = 'active'
        AND i.status = 'active'
        AND m.role = ANY(p_roles)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.shares_institution_with(
  p_other_user_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_other_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.institution_memberships m1
      JOIN public.institution_memberships m2
        ON m1.institution_id = m2.institution_id
      JOIN public.institutions i ON i.id = m1.institution_id
      WHERE m1.user_id = p_user_id
        AND m2.user_id = p_other_user_id
        AND m1.status = 'active'
        AND m2.status = 'active'
        AND i.status = 'active'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

-- ============================================================================
-- 4. TRIGGERS & INVARIANTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_institutions_updated_at ON public.institutions;
CREATE TRIGGER trg_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.institution_memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.institution_memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile when a Supabase Auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    lower(coalesce(NEW.email, '')),
    coalesce(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE
          WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name
          ELSE public.profiles.full_name
        END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Protect immutable profile columns from client tampering
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.email := OLD.email;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_update ON public.profiles;
CREATE TRIGGER trg_profiles_guard_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- Prevent non-platform-admins from unsuspending a suspended institution
CREATE OR REPLACE FUNCTION public.guard_institution_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform super admins can change institution status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_institutions_guard_status ON public.institutions;
CREATE TRIGGER trg_institutions_guard_status
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.guard_institution_status_update();

-- Normalize invitation email to lowercase
CREATE OR REPLACE FUNCTION public.normalize_invitation_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitations_normalize_email ON public.institution_invitations;
CREATE TRIGGER trg_invitations_normalize_email
  BEFORE INSERT OR UPDATE ON public.institution_invitations
  FOR EACH ROW EXECUTE FUNCTION public.normalize_invitation_email();

-- Ensure an institution never loses its last active institution_admin
CREATE OR REPLACE FUNCTION public.prevent_last_institution_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_admins integer;
  v_institution_exists boolean;
BEGIN
  IF OLD.role = 'institution_admin' AND OLD.status = 'active' THEN
    IF TG_OP = 'DELETE' OR NEW.role <> 'institution_admin' OR NEW.status <> 'active' THEN
      -- Allow cascade deletes when the parent institution is deleted
      SELECT EXISTS (SELECT 1 FROM public.institutions WHERE id = OLD.institution_id)
        INTO v_institution_exists;
      IF NOT v_institution_exists THEN
        RETURN COALESCE(NEW, OLD);
      END IF;

      SELECT count(*) INTO v_remaining_admins
      FROM public.institution_memberships
      WHERE institution_id = OLD.institution_id
        AND id <> OLD.id
        AND role = 'institution_admin'
        AND status = 'active';

      IF v_remaining_admins = 0 THEN
        RAISE EXCEPTION 'An institution must retain at least one active Institution Admin'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_prevent_last_admin ON public.institution_memberships;
CREATE TRIGGER trg_memberships_prevent_last_admin
  BEFORE UPDATE OR DELETE ON public.institution_memberships
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_institution_admin_removal();

-- ============================================================================
-- 5. ATOMIC WORKFLOW RPCs (SECURITY DEFINER, caller derived strictly from auth.uid())
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_institution_with_owner(
  p_name text,
  p_slug text,
  p_institution_type text DEFAULT 'university'
)
RETURNS public.institutions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean_name text := trim(coalesce(p_name, ''));
  v_clean_slug text := lower(trim(coalesce(p_slug, '')));
  v_inst public.institutions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Institution name must be at least 2 characters' USING ERRCODE = '22023';
  END IF;

  IF v_clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Slug must contain only lowercase letters, numbers, and hyphens' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.institutions (name, slug, institution_type, created_by)
  VALUES (v_clean_name, v_clean_slug, coalesce(p_institution_type, 'university'), v_uid)
  RETURNING * INTO v_inst;

  INSERT INTO public.institution_memberships (institution_id, user_id, role, status, invited_by)
  VALUES (v_inst.id, v_uid, 'institution_admin', 'active', v_uid);

  INSERT INTO public.institution_audit_logs (institution_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES (
    v_inst.id,
    v_uid,
    'institution.created',
    'institution',
    v_inst.id::text,
    jsonb_build_object('name', v_inst.name, 'slug', v_inst.slug)
  );

  RETURN v_inst;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_institution_invitation(p_token text)
RETURNS public.institution_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_email text;
  v_inv public.institution_invitations;
  v_inst_status public.institution_status;
  v_membership public.institution_memberships;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_uid;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user email not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.institution_invitations
  WHERE token = trim(coalesce(p_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending (status: %)', v_inv.status USING ERRCODE = '22023';
  END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE public.institution_invitations
    SET status = 'expired'
    WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  IF lower(v_inv.email) <> v_user_email THEN
    RAISE EXCEPTION 'This invitation was issued for a different email address' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_inst_status FROM public.institutions WHERE id = v_inv.institution_id;
  IF v_inst_status <> 'active' THEN
    RAISE EXCEPTION 'This institution is currently suspended' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.institution_memberships (institution_id, user_id, role, status, invited_by)
  VALUES (v_inv.institution_id, v_uid, v_inv.role, 'active', v_inv.invited_by)
  ON CONFLICT (institution_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        invited_by = EXCLUDED.invited_by,
        updated_at = now()
  RETURNING * INTO v_membership;

  UPDATE public.institution_invitations
  SET status = 'accepted',
      accepted_by = v_uid,
      accepted_at = now()
  WHERE id = v_inv.id;

  INSERT INTO public.institution_audit_logs (institution_id, actor_user_id, action, target_type, target_id, metadata)
  VALUES (
    v_inv.institution_id,
    v_uid,
    'invitation.accepted',
    'institution_membership',
    v_membership.id::text,
    jsonb_build_object('role', v_inv.role, 'invitation_id', v_inv.id)
  );

  RETURN v_membership;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE (
  id uuid,
  institution_id uuid,
  institution_name text,
  institution_slug text,
  email text,
  role public.institution_role,
  token text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    inv.id,
    inv.institution_id,
    inst.name AS institution_name,
    inst.slug AS institution_slug,
    inv.email,
    inv.role,
    inv.token,
    inv.expires_at,
    inv.created_at
  FROM public.institution_invitations inv
  JOIN public.institutions inst ON inst.id = inv.institution_id
  JOIN auth.users u ON u.id = auth.uid()
  WHERE inv.status = 'pending'
    AND inv.expires_at > now()
    AND inst.status = 'active'
    AND lower(inv.email) = lower(u.email)
  ORDER BY inv.created_at DESC;
$$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Revoke anonymous access on all tables in public
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.platform_admins FROM anon;
REVOKE ALL ON public.institutions FROM anon;
REVOKE ALL ON public.institution_memberships FROM anon;
REVOKE ALL ON public.institution_invitations FROM anon;
REVOKE ALL ON public.institution_audit_logs FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_invitations TO authenticated;
GRANT SELECT, INSERT ON public.institution_audit_logs TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_institution_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_institution_role(uuid, public.institution_role[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_institution_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_institution_with_owner(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_institution_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_pending_invitations() TO authenticated;

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6.1 profiles
DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.shares_institution_with(id, auth.uid())
  );

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 6.2 platform_admins (read own status or all if already super admin; zero client writes)
DROP POLICY IF EXISTS platform_admins_select_self ON public.platform_admins;
CREATE POLICY platform_admins_select_self ON public.platform_admins
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
  );

-- 6.3 institutions
DROP POLICY IF EXISTS institutions_select_member_or_super ON public.institutions;
CREATE POLICY institutions_select_member_or_super ON public.institutions
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_institution_member(id, auth.uid())
  );

DROP POLICY IF EXISTS institutions_update_admin_or_super ON public.institutions;
CREATE POLICY institutions_update_admin_or_super ON public.institutions
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS institutions_delete_super ON public.institutions;
CREATE POLICY institutions_delete_super ON public.institutions
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 6.4 institution_memberships
DROP POLICY IF EXISTS memberships_select_tenant_or_self ON public.institution_memberships;
CREATE POLICY memberships_select_tenant_or_self ON public.institution_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.is_institution_member(institution_id, auth.uid())
  );

DROP POLICY IF EXISTS memberships_insert_admin_or_super ON public.institution_memberships;
CREATE POLICY memberships_insert_admin_or_super ON public.institution_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS memberships_update_admin_or_super ON public.institution_memberships;
CREATE POLICY memberships_update_admin_or_super ON public.institution_memberships
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS memberships_delete_admin_self_or_super ON public.institution_memberships;
CREATE POLICY memberships_delete_admin_self_or_super ON public.institution_memberships
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

-- 6.5 institution_invitations
DROP POLICY IF EXISTS invitations_select_admin_or_invitee ON public.institution_invitations;
CREATE POLICY invitations_select_admin_or_invitee ON public.institution_invitations
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
    OR lower(email) = public.current_user_email()
  );

DROP POLICY IF EXISTS invitations_insert_admin ON public.institution_invitations;
CREATE POLICY invitations_insert_admin ON public.institution_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
    )
  );

DROP POLICY IF EXISTS invitations_update_admin ON public.institution_invitations;
CREATE POLICY invitations_update_admin ON public.institution_invitations
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS invitations_delete_admin ON public.institution_invitations;
CREATE POLICY invitations_delete_admin ON public.institution_invitations
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

-- 6.6 institution_audit_logs
DROP POLICY IF EXISTS audit_logs_select_admin_or_super ON public.institution_audit_logs;
CREATE POLICY audit_logs_select_admin_or_super ON public.institution_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS audit_logs_insert_admin ON public.institution_audit_logs;
CREATE POLICY audit_logs_insert_admin ON public.institution_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
    )
  );
