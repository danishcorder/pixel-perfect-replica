-- Phase 4: ExamFlow Question Bank (Institution-Scoped + Multi-Tenant RLS + Private Answer Keys)
-- Depends on Phase 2 and Phase 3 migrations.

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.question_type AS ENUM (
    'mcq_single',
    'mcq_multi',
    'descriptive',
    'long_answer'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.question_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. TABLES (with composite tenant keys & strict answer-key separation)
-- ============================================================================

-- Allow csv_import_jobs to track both 'students' and 'questions' imports
ALTER TABLE public.csv_import_jobs
  DROP CONSTRAINT IF EXISTS csv_import_jobs_entity_type_check;
ALTER TABLE public.csv_import_jobs
  ADD CONSTRAINT csv_import_jobs_entity_type_check
  CHECK (entity_type IN ('students', 'questions'));

-- 2.1 Questions (contains ONLY question metadata & prompt; ZERO answer keys/rubrics/explanations)
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  question_type public.question_type NOT NULL DEFAULT 'mcq_single',
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 180),
  prompt text NOT NULL CHECK (char_length(trim(prompt)) >= 3),
  topic text NOT NULL DEFAULT 'General' CHECK (char_length(trim(topic)) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'Conceptual' CHECK (char_length(trim(category)) BETWEEN 1 AND 80),
  difficulty public.question_difficulty NOT NULL DEFAULT 'medium',
  marks numeric(6, 2) NOT NULL DEFAULT 1.00 CHECK (marks > 0 AND marks <= 1000),
  negative_marks numeric(6, 2) NOT NULL DEFAULT 0.00 CHECK (negative_marks >= 0 AND negative_marks <= 1000),
  expected_word_count integer CHECK (expected_word_count IS NULL OR (expected_word_count BETWEEN 10 AND 20000)),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  status public.question_status NOT NULL DEFAULT 'active',
  source_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_questions_inst_status_course
  ON public.questions (institution_id, status, course_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_inst_topic_category
  ON public.questions (institution_id, topic, category, question_type);

-- 2.2 Question Options (stores ONLY option key/text/order; NEVER correctness flags)
CREATE TABLE IF NOT EXISTS public.question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  option_key text NOT NULL CHECK (char_length(trim(option_key)) BETWEEN 1 AND 8),
  option_text text NOT NULL CHECK (char_length(trim(option_text)) >= 1),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id, institution_id)
    REFERENCES public.questions(id, institution_id) ON DELETE CASCADE,
  UNIQUE (question_id, option_key),
  UNIQUE (id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_question_options_q
  ON public.question_options (question_id, sort_order);

-- 2.3 Question Answer Keys (PRIVATE table: never readable by students or invigilators)
CREATE TABLE IF NOT EXISTS public.question_answer_keys (
  question_id uuid PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  correct_option_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  sample_answer text,
  grading_rubric text,
  explanation text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id, institution_id)
    REFERENCES public.questions(id, institution_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_answer_keys_inst
  ON public.question_answer_keys (institution_id);

-- 2.4 Question Attachments (metadata referencing private Supabase Storage objects)
CREATE TABLE IF NOT EXISTS public.question_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  file_name text NOT NULL CHECK (char_length(trim(file_name)) BETWEEN 1 AND 255),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (
    mime_type IN (
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  attachment_kind text NOT NULL CHECK (attachment_kind IN ('image', 'document')),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id, institution_id)
    REFERENCES public.questions(id, institution_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_attachments_q
  ON public.question_attachments (institution_id, question_id);

-- 2.5 Reusable Exam Question Sets (for exam assembly & blueprint reuse)
CREATE TABLE IF NOT EXISTS public.question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 150),
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, title),
  UNIQUE (id, institution_id)
);

CREATE TABLE IF NOT EXISTS public.question_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  question_set_id uuid NOT NULL,
  question_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  marks_override numeric(6, 2) CHECK (marks_override IS NULL OR (marks_override > 0 AND marks_override <= 1000)),
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_set_id, institution_id)
    REFERENCES public.question_sets(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, institution_id)
    REFERENCES public.questions(id, institution_id) ON DELETE CASCADE,
  UNIQUE (question_set_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_set_items_set
  ON public.question_set_items (question_set_id, sort_order);

-- ============================================================================
-- 3. TRIGGERS & SAME-INSTITUTION INVARIANTS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_question_answer_keys_updated_at ON public.question_answer_keys;
CREATE TRIGGER trg_question_answer_keys_updated_at
  BEFORE UPDATE ON public.question_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_question_sets_updated_at ON public.question_sets;
CREATE TRIGGER trg_question_sets_updated_at
  BEFORE UPDATE ON public.question_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.verify_question_bank_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'questions' THEN
    IF NEW.course_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = NEW.course_id AND c.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Question course must belong to the same institution' USING ERRCODE = '23503';
    END IF;
    IF NEW.source_question_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = NEW.source_question_id AND q.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Duplicated source question must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'question_sets' THEN
    IF NEW.course_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = NEW.course_id AND c.institution_id = NEW.institution_id
    ) THEN
      RAISE EXCEPTION 'Question set course must belong to the same institution' USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_questions_same_inst ON public.questions;
CREATE TRIGGER trg_questions_same_inst
  BEFORE INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.verify_question_bank_refs();

DROP TRIGGER IF EXISTS trg_question_sets_same_inst ON public.question_sets;
CREATE TRIGGER trg_question_sets_same_inst
  BEFORE INSERT OR UPDATE ON public.question_sets
  FOR EACH ROW EXECUTE FUNCTION public.verify_question_bank_refs();

-- ============================================================================
-- 4. GRANTS & ROW LEVEL SECURITY POLICIES
-- ============================================================================

REVOKE ALL ON public.questions FROM anon;
REVOKE ALL ON public.question_options FROM anon;
REVOKE ALL ON public.question_answer_keys FROM anon;
REVOKE ALL ON public.question_attachments FROM anon;
REVOKE ALL ON public.question_sets FROM anon;
REVOKE ALL ON public.question_set_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_answer_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_set_items TO authenticated;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_set_items ENABLE ROW LEVEL SECURITY;

-- Educators (institution_admin + teacher) and Platform Super Admins manage & view the Question Bank.
-- Students and Invigilators are STRICTLY blocked from reading Question Bank tables or answer keys.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'questions',
    'question_options',
    'question_answer_keys',
    'question_attachments',
    'question_sets',
    'question_set_items'
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

-- ============================================================================
-- 5. SUPABASE STORAGE BUCKET & TENANT-SCOPED OBJECT POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-attachments',
  'question-attachments',
  false,
  10485760,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object path must always start with "<institution_uuid>/..."
DROP POLICY IF EXISTS question_attachments_storage_select ON storage.objects;
CREATE POLICY question_attachments_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'question-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(
        ((storage.foldername(name))[1])::uuid,
        ARRAY['institution_admin', 'teacher']::public.institution_role[],
        auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS question_attachments_storage_insert ON storage.objects;
CREATE POLICY question_attachments_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'question-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(
        ((storage.foldername(name))[1])::uuid,
        ARRAY['institution_admin', 'teacher']::public.institution_role[],
        auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS question_attachments_storage_delete ON storage.objects;
CREATE POLICY question_attachments_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'question-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_institution_role(
        ((storage.foldername(name))[1])::uuid,
        ARRAY['institution_admin', 'teacher']::public.institution_role[],
        auth.uid()
      )
    )
  );
