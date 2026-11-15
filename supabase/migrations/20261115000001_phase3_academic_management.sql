-- Phase 3: Academic Management (Institution-Scoped + Multi-Tenant RLS)
-- Depends on Phase 2 migration (institutions, institution_memberships, helper functions).

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.academic_cycle_status AS ENUM ('planned', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.course_status AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.student_record_status AS ENUM ('active', 'graduated', 'withdrawn', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('enrolled', 'dropped', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. TABLES (with composite tenant keys to prevent cross-institution FKs)
-- ============================================================================

-- Ensure institution_memberships supports composite tenant foreign keys
ALTER TABLE public.institution_memberships
  DROP CONSTRAINT IF EXISTS uq_institution_memberships_id_inst;
ALTER TABLE public.institution_memberships
  ADD CONSTRAINT uq_institution_memberships_id_inst UNIQUE (id, institution_id);

-- 2.1 Academic Sessions
CREATE TABLE IF NOT EXISTS public.academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  code text NOT NULL CHECK (char_length(trim(code)) BETWEEN 2 AND 40),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  status public.academic_cycle_status NOT NULL DEFAULT 'planned',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  UNIQUE (institution_id, code),
  UNIQUE (institution_id, name),
  UNIQUE (id, institution_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_sessions_one_current
  ON public.academic_sessions (institution_id)
  WHERE is_current = true;

-- 2.2 Academic Terms
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  status public.academic_cycle_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  FOREIGN KEY (session_id, institution_id)
    REFERENCES public.academic_sessions(id, institution_id) ON DELETE CASCADE,
  UNIQUE (session_id, name),
  UNIQUE (id, institution_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_terms_one_current
  ON public.academic_terms (institution_id)
  WHERE is_current = true;

-- 2.3 Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  code text NOT NULL CHECK (char_length(trim(code)) BETWEEN 1 AND 30),
  description text,
  head_membership_id uuid REFERENCES public.institution_memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, code),
  UNIQUE (institution_id, name),
  UNIQUE (id, institution_id)
);

-- 2.4 Programs
CREATE TABLE IF NOT EXISTS public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  code text NOT NULL CHECK (char_length(trim(code)) BETWEEN 1 AND 30),
  duration_years smallint NOT NULL DEFAULT 4 CHECK (duration_years BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, code),
  UNIQUE (institution_id, name),
  UNIQUE (id, institution_id)
);

-- 2.5 Academic Classes (e.g. Grade 11, BSCS Year 1)
CREATE TABLE IF NOT EXISTS public.academic_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  code text NOT NULL CHECK (char_length(trim(code)) BETWEEN 1 AND 30),
  level_order integer NOT NULL DEFAULT 1 CHECK (level_order BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, code),
  UNIQUE (id, institution_id)
);

-- 2.6 Class Sections (e.g. Section A, Morning Batch)
CREATE TABLE IF NOT EXISTS public.class_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  capacity integer NOT NULL DEFAULT 60 CHECK (capacity BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (class_id, institution_id)
    REFERENCES public.academic_classes(id, institution_id) ON DELETE CASCADE,
  UNIQUE (class_id, name),
  UNIQUE (id, institution_id)
);

-- 2.7 Courses / Subjects
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.academic_classes(id) ON DELETE SET NULL,
  code text NOT NULL CHECK (char_length(trim(code)) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 150),
  credits numeric(4, 1) NOT NULL DEFAULT 3.0 CHECK (credits >= 0 AND credits <= 30),
  description text,
  status public.course_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, code),
  UNIQUE (id, institution_id)
);

-- 2.8 Teacher Assignments
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL,
  course_id uuid NOT NULL,
  academic_session_id uuid NOT NULL,
  academic_term_id uuid REFERENCES public.academic_terms(id) ON DELETE SET NULL,
  class_section_id uuid REFERENCES public.class_sections(id) ON DELETE SET NULL,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (membership_id, institution_id)
    REFERENCES public.institution_memberships(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, institution_id)
    REFERENCES public.courses(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (academic_session_id, institution_id)
    REFERENCES public.academic_sessions(id, institution_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_teacher_assignment
  ON public.teacher_assignments (
    institution_id,
    membership_id,
    course_id,
    academic_session_id,
    coalesce(academic_term_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(class_section_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 2.9 Student Records (institution-scoped roster; optionally linked to auth membership)
CREATE TABLE IF NOT EXISTS public.student_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.institution_memberships(id) ON DELETE SET NULL,
  student_code text NOT NULL CHECK (char_length(trim(student_code)) BETWEEN 1 AND 50),
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  email text CHECK (email IS NULL OR char_length(trim(email)) BETWEEN 3 AND 255),
  phone text,
  status public.student_record_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, student_code),
  UNIQUE (id, institution_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_records_inst_email
  ON public.student_records (institution_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_records_search
  ON public.student_records (institution_id, status, full_name);

-- 2.10 Student Enrollments
CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  academic_session_id uuid NOT NULL,
  academic_term_id uuid REFERENCES public.academic_terms(id) ON DELETE SET NULL,
  class_section_id uuid NOT NULL,
  status public.enrollment_status NOT NULL DEFAULT 'enrolled',
  enrolled_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, institution_id)
    REFERENCES public.student_records(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (academic_session_id, institution_id)
    REFERENCES public.academic_sessions(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (class_section_id, institution_id)
    REFERENCES public.class_sections(id, institution_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_student_enrollment
  ON public.student_enrollments (student_id, academic_session_id, class_section_id)
  WHERE status = 'enrolled';

CREATE INDEX IF NOT EXISTS idx_student_enrollments_inst_section
  ON public.student_enrollments (institution_id, academic_session_id, class_section_id, status);

-- 2.11 CSV Import Jobs (history & validation error logs)
CREATE TABLE IF NOT EXISTS public.csv_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  entity_type text NOT NULL DEFAULT 'students' CHECK (entity_type IN ('students')),
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. CROSS-TENANT INTEGRITY TRIGGERS & UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS trg_academic_sessions_updated_at ON public.academic_sessions;
CREATE TRIGGER trg_academic_sessions_updated_at
  BEFORE UPDATE ON public.academic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_academic_terms_updated_at ON public.academic_terms;
CREATE TRIGGER trg_academic_terms_updated_at
  BEFORE UPDATE ON public.academic_terms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_programs_updated_at ON public.programs;
CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_academic_classes_updated_at ON public.academic_classes;
CREATE TRIGGER trg_academic_classes_updated_at
  BEFORE UPDATE ON public.academic_classes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_class_sections_updated_at ON public.class_sections;
CREATE TRIGGER trg_class_sections_updated_at
  BEFORE UPDATE ON public.class_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_student_records_updated_at ON public.student_records;
CREATE TRIGGER trg_student_records_updated_at
  BEFORE UPDATE ON public.student_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_student_enrollments_updated_at ON public.student_enrollments;
CREATE TRIGGER trg_student_enrollments_updated_at
  BEFORE UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Verify nullable foreign keys stay strictly inside the same institution_id
CREATE OR REPLACE FUNCTION public.verify_same_institution_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'departments' AND NEW.head_membership_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.institution_memberships m
      WHERE m.id = NEW.head_membership_id AND m.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Department head membership must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'programs' AND NEW.department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = NEW.department_id AND d.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Program department must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'academic_classes' AND NEW.program_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = NEW.program_id AND p.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Class program must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'courses' THEN
    IF NEW.department_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.departments d WHERE d.id = NEW.department_id AND d.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Course department must belong to the same institution' USING ERRCODE = '23503';
    END IF;
    IF NEW.program_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.programs p WHERE p.id = NEW.program_id AND p.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Course program must belong to the same institution' USING ERRCODE = '23503';
    END IF;
    IF NEW.class_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.academic_classes c WHERE c.id = NEW.class_id AND c.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Course class must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'teacher_assignments' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.institution_memberships m
      WHERE m.id = NEW.membership_id
        AND m.institution_id = NEW.institution_id
        AND m.status = 'active'
        AND m.role IN ('teacher', 'institution_admin')
    ) THEN
      RAISE EXCEPTION 'Assigned member must be an active teacher or admin in this institution' USING ERRCODE = '23514';
    END IF;
    IF NEW.academic_term_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.academic_terms t
      WHERE t.id = NEW.academic_term_id AND t.institution_id = NEW.institution_id AND t.session_id = NEW.academic_session_id
    ) THEN
      RAISE EXCEPTION 'Term must belong to the same institution and session' USING ERRCODE = '23503';
    END IF;
    IF NEW.class_section_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.class_sections s
      WHERE s.id = NEW.class_section_id AND s.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Class section must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'student_records' THEN
    IF NEW.email IS NOT NULL THEN
      NEW.email := lower(trim(NEW.email));
    END IF;
    IF NEW.membership_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.institution_memberships m
      WHERE m.id = NEW.membership_id AND m.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Student membership must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'student_enrollments' AND NEW.academic_term_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.academic_terms t
      WHERE t.id = NEW.academic_term_id AND t.institution_id = NEW.institution_id AND t.session_id = NEW.academic_session_id
    ) THEN
      RAISE EXCEPTION 'Enrollment term must belong to the same institution and session' USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_departments_same_inst ON public.departments;
CREATE TRIGGER trg_departments_same_inst
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.verify_same_institution_refs();

DROP TRIGGER IF EXISTS trg_programs_same_inst ON public.programs;
CREATE TRIGGER trg_programs_same_inst
  BEFORE INSERT OR UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.verify_same_institution_refs();

DROP TRIGGER IF EXISTS trg_classes_same_inst ON public.academic_classes;
CREATE TRIGGER trg_classes_same_inst
  BEFORE INSERT OR UPDATE ON public.academic_classes
  FOR EACH ROW EXECUTE FUNCTION public.verify_same_institution_refs();

DROP TRIGGER IF EXISTS trg_courses_same_inst ON public.courses;
CREATE TRIGGER trg_courses_same_inst
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.verify_same_institution_refs();

DROP TRIGGER IF EXISTS trg_teacher_assignments_same_inst ON public.teacher_assignments;
CREATE TRIGGER trg_teacher_assignments_same_inst
  BEFORE INSERT OR UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.verify_same_institution_refs();

DROP TRIGGER IF EXISTS trg_student_records_same_inst ON public.student_records;
CREATE TRIGGER trg_student_records_same_inst
  BEFORE INSERT OR UPDATE ON public.student_records
  FOR EACH ROW EXECUTE FUNCTION public.verify_same_institution_refs();

DROP TRIGGER IF EXISTS trg_student_enrollments_same_inst ON public.student_enrollments;
CREATE TRIGGER trg_student_enrollments_same_inst
  BEFORE INSERT OR UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.verify_same_institution_refs();

-- Helper: check if a student_record belongs to the caller
CREATE OR REPLACE FUNCTION public.is_own_student_record(p_student_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_student_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.student_records sr
      LEFT JOIN public.institution_memberships m ON m.id = sr.membership_id
      WHERE sr.id = p_student_id
        AND (
          (m.user_id = p_user_id AND m.status = 'active')
          OR (sr.email IS NOT NULL AND lower(sr.email) = public.current_user_email())
        )
    )
  END;
$$;

-- ============================================================================
-- 4. GRANTS & ROW LEVEL SECURITY POLICIES
-- ============================================================================

REVOKE ALL ON public.academic_sessions FROM anon;
REVOKE ALL ON public.academic_terms FROM anon;
REVOKE ALL ON public.departments FROM anon;
REVOKE ALL ON public.programs FROM anon;
REVOKE ALL ON public.academic_classes FROM anon;
REVOKE ALL ON public.class_sections FROM anon;
REVOKE ALL ON public.courses FROM anon;
REVOKE ALL ON public.teacher_assignments FROM anon;
REVOKE ALL ON public.student_records FROM anon;
REVOKE ALL ON public.student_enrollments FROM anon;
REVOKE ALL ON public.csv_import_jobs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_terms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_enrollments TO authenticated;
GRANT SELECT, INSERT ON public.csv_import_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_student_record(uuid, uuid) TO authenticated;

ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_jobs ENABLE ROW LEVEL SECURITY;

-- Catalog tables: readable by active members of that institution; writable only by institution_admin (or platform_admin)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academic_sessions',
    'academic_terms',
    'departments',
    'programs',
    'academic_classes',
    'class_sections',
    'courses'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_member ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_member ON public.%I FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()) OR public.is_institution_member(institution_id, auth.uid()));',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_insert_admin ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert_admin ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'']::public.institution_role[], auth.uid()));',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_update_admin ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update_admin ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'']::public.institution_role[], auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'']::public.institution_role[], auth.uid()));',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_delete_admin ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete_admin ON public.%I FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'']::public.institution_role[], auth.uid()));',
      t, t
    );
  END LOOP;
END $$;

-- Teacher assignments: admins & teachers in that institution can read; only institution_admin can write
DROP POLICY IF EXISTS teacher_assignments_select_scoped ON public.teacher_assignments;
CREATE POLICY teacher_assignments_select_scoped ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin', 'teacher', 'invigilator']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS teacher_assignments_insert_admin ON public.teacher_assignments;
CREATE POLICY teacher_assignments_insert_admin ON public.teacher_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
    )
  );

DROP POLICY IF EXISTS teacher_assignments_delete_admin ON public.teacher_assignments;
CREATE POLICY teacher_assignments_delete_admin ON public.teacher_assignments
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

-- Student records: admins & teachers of that institution can read; students can read ONLY their own record; only institution_admin writes
DROP POLICY IF EXISTS student_records_select_scoped ON public.student_records;
CREATE POLICY student_records_select_scoped ON public.student_records
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin', 'teacher']::public.institution_role[], auth.uid())
    OR public.is_own_student_record(id, auth.uid())
  );

DROP POLICY IF EXISTS student_records_insert_admin ON public.student_records;
CREATE POLICY student_records_insert_admin ON public.student_records
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
    )
  );

DROP POLICY IF EXISTS student_records_update_admin ON public.student_records;
CREATE POLICY student_records_update_admin ON public.student_records
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS student_records_delete_admin ON public.student_records;
CREATE POLICY student_records_delete_admin ON public.student_records
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

-- Student enrollments: admins & teachers of that institution can read; students can read ONLY their own enrollments; only institution_admin writes
DROP POLICY IF EXISTS student_enrollments_select_scoped ON public.student_enrollments;
CREATE POLICY student_enrollments_select_scoped ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin', 'teacher']::public.institution_role[], auth.uid())
    OR public.is_own_student_record(student_id, auth.uid())
  );

DROP POLICY IF EXISTS student_enrollments_insert_admin ON public.student_enrollments;
CREATE POLICY student_enrollments_insert_admin ON public.student_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    enrolled_by = auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
    )
  );

DROP POLICY IF EXISTS student_enrollments_update_admin ON public.student_enrollments;
CREATE POLICY student_enrollments_update_admin ON public.student_enrollments
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS student_enrollments_delete_admin ON public.student_enrollments;
CREATE POLICY student_enrollments_delete_admin ON public.student_enrollments
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

-- CSV import jobs: institution_admin only
DROP POLICY IF EXISTS csv_import_jobs_select_admin ON public.csv_import_jobs;
CREATE POLICY csv_import_jobs_select_admin ON public.csv_import_jobs
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
  );

DROP POLICY IF EXISTS csv_import_jobs_insert_admin ON public.csv_import_jobs;
CREATE POLICY csv_import_jobs_insert_admin ON public.csv_import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.institution_role[], auth.uid())
    )
  );
