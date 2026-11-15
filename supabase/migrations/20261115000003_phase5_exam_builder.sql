-- Phase 5: Exam Builder (Institution-Scoped + Immutable Published Versions + Multi-Tenant RLS)
-- Depends on Phase 2, Phase 3, and Phase 4 migrations.

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.exam_status AS ENUM ('draft', 'published', 'closed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.exam_section_type AS ENUM ('mcq', 'descriptive', 'mixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.exam_assignment_target_type AS ENUM ('class', 'section', 'student');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. TABLES (composite tenant keys + immutable published snapshots)
-- ============================================================================

-- 2.1 Exams (authoring & scheduling configuration)
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  academic_session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  academic_term_id uuid REFERENCES public.academic_terms(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 180),
  description text,
  instructions text,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 1 AND 1440),
  total_marks numeric(8, 2) NOT NULL DEFAULT 0.00 CHECK (total_marks >= 0 AND total_marks <= 100000),
  passing_marks numeric(8, 2) CHECK (passing_marks IS NULL OR passing_marks >= 0),
  passing_percentage numeric(5, 2) CHECK (passing_percentage IS NULL OR (passing_percentage >= 0 AND passing_percentage <= 100)),
  negative_marking_enabled boolean NOT NULL DEFAULT false,
  default_negative_marks numeric(6, 2) NOT NULL DEFAULT 0.00 CHECK (default_negative_marks >= 0 AND default_negative_marks <= 1000),
  shuffle_questions boolean NOT NULL DEFAULT false,
  shuffle_options boolean NOT NULL DEFAULT false,
  status public.exam_status NOT NULL DEFAULT 'draft',
  current_version_number integer NOT NULL DEFAULT 0 CHECK (current_version_number >= 0),
  latest_published_version_id uuid,
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  UNIQUE (id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_exams_inst_status
  ON public.exams (institution_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_inst_course
  ON public.exams (institution_id, course_id, starts_at);

-- 2.2 Exam Sections (MCQ, Descriptive, or Mixed)
CREATE TABLE IF NOT EXISTS public.exam_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 150),
  description text,
  section_type public.exam_section_type NOT NULL DEFAULT 'mcq',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  shuffle_questions boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (exam_id, institution_id)
    REFERENCES public.exams(id, institution_id) ON DELETE CASCADE,
  UNIQUE (id, institution_id),
  UNIQUE (id, exam_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_sections_exam
  ON public.exam_sections (exam_id, sort_order);

-- 2.3 Exam Section Questions (selected from institution Question Bank)
CREATE TABLE IF NOT EXISTS public.exam_section_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL,
  section_id uuid NOT NULL,
  question_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  marks numeric(6, 2) NOT NULL CHECK (marks > 0 AND marks <= 1000),
  negative_marks numeric(6, 2) NOT NULL DEFAULT 0.00 CHECK (negative_marks >= 0 AND negative_marks <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (exam_id, institution_id)
    REFERENCES public.exams(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, institution_id)
    REFERENCES public.exam_sections(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, exam_id)
    REFERENCES public.exam_sections(id, exam_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, institution_id)
    REFERENCES public.questions(id, institution_id) ON DELETE RESTRICT,
  UNIQUE (exam_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_section_questions_sec
  ON public.exam_section_questions (section_id, sort_order);

-- 2.4 Exam Assignments (classes, sections, or specific students)
CREATE TABLE IF NOT EXISTS public.exam_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL,
  target_type public.exam_assignment_target_type NOT NULL,
  class_id uuid,
  class_section_id uuid,
  student_id uuid,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (exam_id, institution_id)
    REFERENCES public.exams(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (class_id, institution_id)
    REFERENCES public.academic_classes(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (class_section_id, institution_id)
    REFERENCES public.class_sections(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id, institution_id)
    REFERENCES public.student_records(id, institution_id) ON DELETE CASCADE,
  CHECK (
    (target_type = 'class' AND class_id IS NOT NULL AND class_section_id IS NULL AND student_id IS NULL)
    OR (target_type = 'section' AND class_section_id IS NOT NULL AND class_id IS NULL AND student_id IS NULL)
    OR (target_type = 'student' AND student_id IS NOT NULL AND class_id IS NULL AND class_section_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_assign_unique_class
  ON public.exam_assignments (exam_id, class_id)
  WHERE target_type = 'class';

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_assign_unique_section
  ON public.exam_assignments (exam_id, class_section_id)
  WHERE target_type = 'section';

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_assign_unique_student
  ON public.exam_assignments (exam_id, student_id)
  WHERE target_type = 'student';

CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam
  ON public.exam_assignments (institution_id, exam_id);

-- 2.5 Immutable Published Exam Versions (append-only snapshots; student-safe payload with ZERO answer keys)
CREATE TABLE IF NOT EXISTS public.exam_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  title text NOT NULL,
  description text,
  instructions text,
  course_id uuid,
  course_code text,
  course_title text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  total_marks numeric(8, 2) NOT NULL CHECK (total_marks > 0),
  passing_marks numeric(8, 2),
  passing_percentage numeric(5, 2),
  negative_marking_enabled boolean NOT NULL,
  default_negative_marks numeric(6, 2) NOT NULL,
  shuffle_questions boolean NOT NULL,
  shuffle_options boolean NOT NULL,
  snapshot_payload jsonb NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  published_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (exam_id, institution_id)
    REFERENCES public.exams(id, institution_id) ON DELETE CASCADE,
  UNIQUE (exam_id, version_number),
  UNIQUE (id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_versions_exam
  ON public.exam_versions (exam_id, version_number DESC);

-- Link latest_published_version_id back to exam_versions cleanly
ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS fk_exams_latest_published_version;
ALTER TABLE public.exams
  ADD CONSTRAINT fk_exams_latest_published_version
  FOREIGN KEY (latest_published_version_id)
  REFERENCES public.exam_versions(id) ON DELETE SET NULL;

-- 2.6 Frozen Private Answer Keys per Published Version (NEVER readable by students or invigilators)
CREATE TABLE IF NOT EXISTS public.exam_version_answer_keys (
  version_id uuid PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL,
  keys_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_id, institution_id)
    REFERENCES public.exam_versions(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id, institution_id)
    REFERENCES public.exams(id, institution_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exam_version_answer_keys_inst
  ON public.exam_version_answer_keys (institution_id, exam_id);

-- ============================================================================
-- 3. IMMUTABILITY, CROSS-TENANT & LIFECYCLE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_exams_updated_at ON public.exams;
CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_exam_sections_updated_at ON public.exam_sections;
CREATE TRIGGER trg_exam_sections_updated_at
  BEFORE UPDATE ON public.exam_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Verify same-institution references on exams
CREATE OR REPLACE FUNCTION public.verify_exam_builder_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = NEW.course_id AND c.institution_id = NEW.institution_id
  ) THEN
    RAISE EXCEPTION 'Exam course must belong to the same institution' USING ERRCODE = '23503';
  END IF;

  IF NEW.academic_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.academic_sessions s
    WHERE s.id = NEW.academic_session_id AND s.institution_id = NEW.institution_id
  ) THEN
    RAISE EXCEPTION 'Exam academic session must belong to the same institution' USING ERRCODE = '23503';
  END IF;

  IF NEW.academic_term_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.academic_terms t
    WHERE t.id = NEW.academic_term_id AND t.institution_id = NEW.institution_id
  ) THEN
    RAISE EXCEPTION 'Exam academic term must belong to the same institution' USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exams_same_inst ON public.exams;
CREATE TRIGGER trg_exams_same_inst
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.verify_exam_builder_refs();

-- Enforce immutability of published exam_versions
CREATE OR REPLACE FUNCTION public.protect_exam_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Published exam versions are immutable and cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id
    OR NEW.exam_id IS DISTINCT FROM OLD.exam_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.instructions IS DISTINCT FROM OLD.instructions
    OR NEW.course_id IS DISTINCT FROM OLD.course_id
    OR NEW.course_code IS DISTINCT FROM OLD.course_code
    OR NEW.course_title IS DISTINCT FROM OLD.course_title
    OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
    OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
    OR NEW.total_marks IS DISTINCT FROM OLD.total_marks
    OR NEW.passing_marks IS DISTINCT FROM OLD.passing_marks
    OR NEW.passing_percentage IS DISTINCT FROM OLD.passing_percentage
    OR NEW.negative_marking_enabled IS DISTINCT FROM OLD.negative_marking_enabled
    OR NEW.default_negative_marks IS DISTINCT FROM OLD.default_negative_marks
    OR NEW.shuffle_questions IS DISTINCT FROM OLD.shuffle_questions
    OR NEW.shuffle_options IS DISTINCT FROM OLD.shuffle_options
    OR NEW.snapshot_payload IS DISTINCT FROM OLD.snapshot_payload
    OR NEW.published_by IS DISTINCT FROM OLD.published_by
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
  THEN
    RAISE EXCEPTION 'Published exam version snapshot content is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.attempt_count < OLD.attempt_count THEN
    RAISE EXCEPTION 'Published exam version attempt_count cannot be decremented'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_versions_immutable ON public.exam_versions;
CREATE TRIGGER trg_exam_versions_immutable
  BEFORE UPDATE OR DELETE ON public.exam_versions
  FOR EACH ROW EXECUTE FUNCTION public.protect_exam_version_immutability();

-- Enforce append-only immutability on frozen version answer keys
CREATE OR REPLACE FUNCTION public.protect_exam_version_keys_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Published exam version answer keys are immutable'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_version_answer_keys_immutable ON public.exam_version_answer_keys;
CREATE TRIGGER trg_exam_version_answer_keys_immutable
  BEFORE UPDATE OR DELETE ON public.exam_version_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.protect_exam_version_keys_immutability();

-- Prevent mutating exams or sections/questions when locked or after attempts begin
CREATE OR REPLACE FUNCTION public.protect_published_exam_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id uuid;
  v_status public.exam_status;
  v_has_attempts boolean;
BEGIN
  IF TG_TABLE_NAME = 'exams' THEN
    IF OLD.status = 'published' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.exam_versions ev
        WHERE ev.exam_id = OLD.id AND ev.attempt_count > 0
      ) INTO v_has_attempts;

      IF v_has_attempts THEN
        -- Once attempts exist, only transitioning to closed (or setting closed_at) is permitted
        IF NOT (NEW.status = 'closed' AND OLD.status = 'published')
          OR NEW.title IS DISTINCT FROM OLD.title
          OR NEW.description IS DISTINCT FROM OLD.description
          OR NEW.instructions IS DISTINCT FROM OLD.instructions
          OR NEW.course_id IS DISTINCT FROM OLD.course_id
          OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
          OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
          OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
          OR NEW.total_marks IS DISTINCT FROM OLD.total_marks
          OR NEW.passing_marks IS DISTINCT FROM OLD.passing_marks
          OR NEW.passing_percentage IS DISTINCT FROM OLD.passing_percentage
          OR NEW.negative_marking_enabled IS DISTINCT FROM OLD.negative_marking_enabled
          OR NEW.default_negative_marks IS DISTINCT FROM OLD.default_negative_marks
          OR NEW.shuffle_questions IS DISTINCT FROM OLD.shuffle_questions
          OR NEW.shuffle_options IS DISTINCT FROM OLD.shuffle_options
        THEN
          RAISE EXCEPTION 'Published exam content cannot be modified after students have begun attempting it'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Child tables: exam_sections & exam_section_questions
  v_exam_id := COALESCE(NEW.exam_id, OLD.exam_id);
  SELECT status INTO v_status FROM public.exams WHERE id = v_exam_id;

  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Exam sections and questions can only be modified while the exam is in draft status'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_exams_protect_content ON public.exams;
CREATE TRIGGER trg_exams_protect_content
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.protect_published_exam_content();

DROP TRIGGER IF EXISTS trg_exam_sections_draft_only ON public.exam_sections;
CREATE TRIGGER trg_exam_sections_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.exam_sections
  FOR EACH ROW EXECUTE FUNCTION public.protect_published_exam_content();

DROP TRIGGER IF EXISTS trg_exam_section_questions_draft_only ON public.exam_section_questions;
CREATE TRIGGER trg_exam_section_questions_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.exam_section_questions
  FOR EACH ROW EXECUTE FUNCTION public.protect_published_exam_content();

-- ============================================================================
-- 4. GRANTS & ROW LEVEL SECURITY POLICIES
-- ============================================================================

REVOKE ALL ON public.exams FROM anon;
REVOKE ALL ON public.exam_sections FROM anon;
REVOKE ALL ON public.exam_section_questions FROM anon;
REVOKE ALL ON public.exam_assignments FROM anon;
REVOKE ALL ON public.exam_versions FROM anon;
REVOKE ALL ON public.exam_version_answer_keys FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_section_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_assignments TO authenticated;
GRANT SELECT, INSERT ON public.exam_versions TO authenticated;
GRANT SELECT, INSERT ON public.exam_version_answer_keys TO authenticated;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_section_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_version_answer_keys ENABLE ROW LEVEL SECURITY;

-- Educators (institution_admin + teacher) and Platform Super Admins manage exams.
-- Students and Invigilators have ZERO access to draft builder tables and frozen answer keys.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'exams',
    'exam_sections',
    'exam_section_questions',
    'exam_assignments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_educator ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_educator ON public.%I FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'', ''teacher'']::public.institution_role[], auth.uid()));',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_insert_educator ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert_educator ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'', ''teacher'']::public.institution_role[], auth.uid()));',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_update_educator ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update_educator ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'', ''teacher'']::public.institution_role[], auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'', ''teacher'']::public.institution_role[], auth.uid()));',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_delete_educator ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete_educator ON public.%I FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()) OR public.has_institution_role(institution_id, ARRAY[''institution_admin'', ''teacher'']::public.institution_role[], auth.uid()));',
      t, t
    );
  END LOOP;
END $$;

-- exam_versions: append-only (SELECT & INSERT only for educators; ZERO UPDATE/DELETE policies)
DROP POLICY IF EXISTS exam_versions_select_educator ON public.exam_versions;
CREATE POLICY exam_versions_select_educator ON public.exam_versions
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(
      institution_id,
      ARRAY['institution_admin', 'teacher']::public.institution_role[],
      auth.uid()
    )
  );

DROP POLICY IF EXISTS exam_versions_insert_educator ON public.exam_versions;
CREATE POLICY exam_versions_insert_educator ON public.exam_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(
      institution_id,
      ARRAY['institution_admin', 'teacher']::public.institution_role[],
      auth.uid()
    )
  );

-- exam_version_answer_keys: strictly educator/admin SELECT & INSERT only (append-only, never students/invigilators)
DROP POLICY IF EXISTS exam_version_answer_keys_select_educator ON public.exam_version_answer_keys;
CREATE POLICY exam_version_answer_keys_select_educator ON public.exam_version_answer_keys
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(
      institution_id,
      ARRAY['institution_admin', 'teacher']::public.institution_role[],
      auth.uid()
    )
  );

DROP POLICY IF EXISTS exam_version_answer_keys_insert_educator ON public.exam_version_answer_keys;
CREATE POLICY exam_version_answer_keys_insert_educator ON public.exam_version_answer_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_institution_role(
      institution_id,
      ARRAY['institution_admin', 'teacher']::public.institution_role[],
      auth.uid()
    )
  );
