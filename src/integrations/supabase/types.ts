export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type InstitutionRole =
  | 'institution_admin'
  | 'teacher'
  | 'student'
  | 'invigilator';

export type MembershipStatus = 'active' | 'suspended';
export type InstitutionStatus = 'active' | 'suspended';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type AcademicCycleStatus = 'planned' | 'active' | 'archived';
export type CourseStatus = 'active' | 'archived';
export type StudentRecordStatus = 'active' | 'graduated' | 'withdrawn' | 'suspended';
export type EnrollmentStatus = 'enrolled' | 'dropped' | 'completed';
export type QuestionType = 'mcq_single' | 'mcq_multi' | 'descriptive' | 'long_answer';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'draft' | 'active' | 'archived';
export type QuestionAttachmentKind = 'image' | 'document';
export type ExamStatus = 'draft' | 'published' | 'closed' | 'archived';
export type ExamSectionType = 'mcq' | 'descriptive' | 'mixed';
export type ExamAssignmentTargetType = 'class' | 'section' | 'student';

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          timezone: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          phone?: string | null;
          timezone?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          timezone?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          granted_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          granted_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          granted_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      institutions: {
        Row: {
          id: string;
          name: string;
          slug: string;
          institution_type: 'school' | 'college' | 'university' | 'training_centre';
          status: InstitutionStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          institution_type?: 'school' | 'college' | 'university' | 'training_centre';
          status?: InstitutionStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          institution_type?: 'school' | 'college' | 'university' | 'training_centre';
          status?: InstitutionStatus;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      institution_memberships: {
        Row: {
          id: string;
          institution_id: string;
          user_id: string;
          role: InstitutionRole;
          status: MembershipStatus;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          user_id: string;
          role: InstitutionRole;
          status?: MembershipStatus;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          user_id?: string;
          role?: InstitutionRole;
          status?: MembershipStatus;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'institution_memberships_institution_id_fkey';
            columns: ['institution_id'];
            isOneToOne: false;
            referencedRelation: 'institutions';
            referencedColumns: ['id'];
          },
        ];
      };
      institution_invitations: {
        Row: {
          id: string;
          institution_id: string;
          email: string;
          role: InstitutionRole;
          token: string;
          status: InvitationStatus;
          invited_by: string;
          accepted_by: string | null;
          expires_at: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          institution_id: string;
          email: string;
          role: InstitutionRole;
          token?: string;
          status?: InvitationStatus;
          invited_by: string;
          accepted_by?: string | null;
          expires_at?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          institution_id?: string;
          email?: string;
          role?: InstitutionRole;
          token?: string;
          status?: InvitationStatus;
          invited_by?: string;
          accepted_by?: string | null;
          expires_at?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'institution_invitations_institution_id_fkey';
            columns: ['institution_id'];
            isOneToOne: false;
            referencedRelation: 'institutions';
            referencedColumns: ['id'];
          },
        ];
      };
      institution_audit_logs: {
        Row: {
          id: string;
          institution_id: string;
          actor_user_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          actor_user_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          actor_user_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'institution_audit_logs_institution_id_fkey';
            columns: ['institution_id'];
            isOneToOne: false;
            referencedRelation: 'institutions';
            referencedColumns: ['id'];
          },
        ];
      };
      academic_sessions: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          code: string;
          starts_on: string;
          ends_on: string;
          is_current: boolean;
          status: AcademicCycleStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          code: string;
          starts_on: string;
          ends_on: string;
          is_current?: boolean;
          status?: AcademicCycleStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          name?: string;
          code?: string;
          starts_on?: string;
          ends_on?: string;
          is_current?: boolean;
          status?: AcademicCycleStatus;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      academic_terms: {
        Row: {
          id: string;
          institution_id: string;
          session_id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          is_current: boolean;
          status: AcademicCycleStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          session_id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          is_current?: boolean;
          status?: AcademicCycleStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          session_id?: string;
          name?: string;
          starts_on?: string;
          ends_on?: string;
          is_current?: boolean;
          status?: AcademicCycleStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          code: string;
          description: string | null;
          head_membership_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          code: string;
          description?: string | null;
          head_membership_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          head_membership_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          institution_id: string;
          department_id: string | null;
          name: string;
          code: string;
          duration_years: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          department_id?: string | null;
          name: string;
          code: string;
          duration_years?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          department_id?: string | null;
          name?: string;
          code?: string;
          duration_years?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      academic_classes: {
        Row: {
          id: string;
          institution_id: string;
          program_id: string | null;
          name: string;
          code: string;
          level_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          program_id?: string | null;
          name: string;
          code: string;
          level_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          program_id?: string | null;
          name?: string;
          code?: string;
          level_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      class_sections: {
        Row: {
          id: string;
          institution_id: string;
          class_id: string;
          name: string;
          capacity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          class_id: string;
          name: string;
          capacity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          class_id?: string;
          name?: string;
          capacity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          institution_id: string;
          department_id: string | null;
          program_id: string | null;
          class_id: string | null;
          code: string;
          title: string;
          credits: number;
          description: string | null;
          status: CourseStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          department_id?: string | null;
          program_id?: string | null;
          class_id?: string | null;
          code: string;
          title: string;
          credits?: number;
          description?: string | null;
          status?: CourseStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          department_id?: string | null;
          program_id?: string | null;
          class_id?: string | null;
          code?: string;
          title?: string;
          credits?: number;
          description?: string | null;
          status?: CourseStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teacher_assignments: {
        Row: {
          id: string;
          institution_id: string;
          membership_id: string;
          course_id: string;
          academic_session_id: string;
          academic_term_id: string | null;
          class_section_id: string | null;
          assigned_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          membership_id: string;
          course_id: string;
          academic_session_id: string;
          academic_term_id?: string | null;
          class_section_id?: string | null;
          assigned_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          membership_id?: string;
          course_id?: string;
          academic_session_id?: string;
          academic_term_id?: string | null;
          class_section_id?: string | null;
          assigned_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      student_records: {
        Row: {
          id: string;
          institution_id: string;
          membership_id: string | null;
          student_code: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          status: StudentRecordStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          membership_id?: string | null;
          student_code: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          status?: StudentRecordStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          membership_id?: string | null;
          student_code?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          status?: StudentRecordStatus;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_enrollments: {
        Row: {
          id: string;
          institution_id: string;
          student_id: string;
          academic_session_id: string;
          academic_term_id: string | null;
          class_section_id: string;
          status: EnrollmentStatus;
          enrolled_by: string;
          enrolled_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          student_id: string;
          academic_session_id: string;
          academic_term_id?: string | null;
          class_section_id: string;
          status?: EnrollmentStatus;
          enrolled_by: string;
          enrolled_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          student_id?: string;
          academic_session_id?: string;
          academic_term_id?: string | null;
          class_section_id?: string;
          status?: EnrollmentStatus;
          enrolled_by?: string;
          enrolled_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      csv_import_jobs: {
        Row: {
          id: string;
          institution_id: string;
          uploaded_by: string;
          entity_type: 'students' | 'questions';
          file_name: string;
          total_rows: number;
          imported_count: number;
          error_count: number;
          errors: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          uploaded_by: string;
          entity_type?: 'students' | 'questions';
          file_name: string;
          total_rows?: number;
          imported_count?: number;
          error_count?: number;
          errors?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          uploaded_by?: string;
          entity_type?: 'students' | 'questions';
          file_name?: string;
          total_rows?: number;
          imported_count?: number;
          error_count?: number;
          errors?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          institution_id: string;
          course_id: string | null;
          question_type: QuestionType;
          title: string;
          prompt: string;
          topic: string;
          category: string;
          difficulty: QuestionDifficulty;
          marks: number;
          negative_marks: number;
          expected_word_count: number | null;
          tags: string[];
          status: QuestionStatus;
          source_question_id: string | null;
          created_by: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          course_id?: string | null;
          question_type?: QuestionType;
          title: string;
          prompt: string;
          topic?: string;
          category?: string;
          difficulty?: QuestionDifficulty;
          marks?: number;
          negative_marks?: number;
          expected_word_count?: number | null;
          tags?: string[];
          status?: QuestionStatus;
          source_question_id?: string | null;
          created_by: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          course_id?: string | null;
          question_type?: QuestionType;
          title?: string;
          prompt?: string;
          topic?: string;
          category?: string;
          difficulty?: QuestionDifficulty;
          marks?: number;
          negative_marks?: number;
          expected_word_count?: number | null;
          tags?: string[];
          status?: QuestionStatus;
          source_question_id?: string | null;
          created_by?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_options: {
        Row: {
          id: string;
          institution_id: string;
          question_id: string;
          option_key: string;
          option_text: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          question_id: string;
          option_key: string;
          option_text: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          question_id?: string;
          option_key?: string;
          option_text?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      question_answer_keys: {
        Row: {
          question_id: string;
          institution_id: string;
          correct_option_keys: string[];
          sample_answer: string | null;
          grading_rubric: string | null;
          explanation: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          question_id: string;
          institution_id: string;
          correct_option_keys?: string[];
          sample_answer?: string | null;
          grading_rubric?: string | null;
          explanation?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          question_id?: string;
          institution_id?: string;
          correct_option_keys?: string[];
          sample_answer?: string | null;
          grading_rubric?: string | null;
          explanation?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_attachments: {
        Row: {
          id: string;
          institution_id: string;
          question_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size_bytes: number;
          attachment_kind: QuestionAttachmentKind;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          question_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size_bytes: number;
          attachment_kind: QuestionAttachmentKind;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          question_id?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          file_size_bytes?: number;
          attachment_kind?: QuestionAttachmentKind;
          uploaded_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      question_sets: {
        Row: {
          id: string;
          institution_id: string;
          course_id: string | null;
          title: string;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          course_id?: string | null;
          title: string;
          description?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          course_id?: string | null;
          title?: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_set_items: {
        Row: {
          id: string;
          institution_id: string;
          question_set_id: string;
          question_id: string;
          sort_order: number;
          marks_override: number | null;
          added_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          question_set_id: string;
          question_id: string;
          sort_order?: number;
          marks_override?: number | null;
          added_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          question_set_id?: string;
          question_id?: string;
          sort_order?: number;
          marks_override?: number | null;
          added_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exams: {
        Row: {
          id: string;
          institution_id: string;
          course_id: string | null;
          academic_session_id: string | null;
          academic_term_id: string | null;
          title: string;
          description: string | null;
          instructions: string | null;
          starts_at: string | null;
          ends_at: string | null;
          duration_minutes: number;
          total_marks: number;
          passing_marks: number | null;
          passing_percentage: number | null;
          negative_marking_enabled: boolean;
          default_negative_marks: number;
          shuffle_questions: boolean;
          shuffle_options: boolean;
          status: ExamStatus;
          current_version_number: number;
          latest_published_version_id: string | null;
          published_at: string | null;
          closed_at: string | null;
          created_by: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          course_id?: string | null;
          academic_session_id?: string | null;
          academic_term_id?: string | null;
          title: string;
          description?: string | null;
          instructions?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          duration_minutes?: number;
          total_marks?: number;
          passing_marks?: number | null;
          passing_percentage?: number | null;
          negative_marking_enabled?: boolean;
          default_negative_marks?: number;
          shuffle_questions?: boolean;
          shuffle_options?: boolean;
          status?: ExamStatus;
          current_version_number?: number;
          latest_published_version_id?: string | null;
          published_at?: string | null;
          closed_at?: string | null;
          created_by: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          course_id?: string | null;
          academic_session_id?: string | null;
          academic_term_id?: string | null;
          title?: string;
          description?: string | null;
          instructions?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          duration_minutes?: number;
          total_marks?: number;
          passing_marks?: number | null;
          passing_percentage?: number | null;
          negative_marking_enabled?: boolean;
          default_negative_marks?: number;
          shuffle_questions?: boolean;
          shuffle_options?: boolean;
          status?: ExamStatus;
          current_version_number?: number;
          latest_published_version_id?: string | null;
          published_at?: string | null;
          closed_at?: string | null;
          created_by?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_sections: {
        Row: {
          id: string;
          institution_id: string;
          exam_id: string;
          title: string;
          description: string | null;
          section_type: ExamSectionType;
          sort_order: number;
          shuffle_questions: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          exam_id: string;
          title: string;
          description?: string | null;
          section_type?: ExamSectionType;
          sort_order?: number;
          shuffle_questions?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          exam_id?: string;
          title?: string;
          description?: string | null;
          section_type?: ExamSectionType;
          sort_order?: number;
          shuffle_questions?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_section_questions: {
        Row: {
          id: string;
          institution_id: string;
          exam_id: string;
          section_id: string;
          question_id: string;
          sort_order: number;
          marks: number;
          negative_marks: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          exam_id: string;
          section_id: string;
          question_id: string;
          sort_order?: number;
          marks: number;
          negative_marks?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          exam_id?: string;
          section_id?: string;
          question_id?: string;
          sort_order?: number;
          marks?: number;
          negative_marks?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      exam_assignments: {
        Row: {
          id: string;
          institution_id: string;
          exam_id: string;
          target_type: ExamAssignmentTargetType;
          class_id: string | null;
          class_section_id: string | null;
          student_id: string | null;
          assigned_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          exam_id: string;
          target_type: ExamAssignmentTargetType;
          class_id?: string | null;
          class_section_id?: string | null;
          student_id?: string | null;
          assigned_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          exam_id?: string;
          target_type?: ExamAssignmentTargetType;
          class_id?: string | null;
          class_section_id?: string | null;
          student_id?: string | null;
          assigned_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exam_versions: {
        Row: {
          id: string;
          institution_id: string;
          exam_id: string;
          version_number: number;
          title: string;
          description: string | null;
          instructions: string | null;
          course_id: string | null;
          course_code: string | null;
          course_title: string | null;
          starts_at: string;
          ends_at: string;
          duration_minutes: number;
          total_marks: number;
          passing_marks: number | null;
          passing_percentage: number | null;
          negative_marking_enabled: boolean;
          default_negative_marks: number;
          shuffle_questions: boolean;
          shuffle_options: boolean;
          snapshot_payload: Json;
          attempt_count: number;
          published_by: string;
          published_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          exam_id: string;
          version_number: number;
          title: string;
          description?: string | null;
          instructions?: string | null;
          course_id?: string | null;
          course_code?: string | null;
          course_title?: string | null;
          starts_at: string;
          ends_at: string;
          duration_minutes: number;
          total_marks: number;
          passing_marks?: number | null;
          passing_percentage?: number | null;
          negative_marking_enabled: boolean;
          default_negative_marks: number;
          shuffle_questions: boolean;
          shuffle_options: boolean;
          snapshot_payload: Json;
          attempt_count?: number;
          published_by: string;
          published_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          exam_id?: string;
          version_number?: number;
          title?: string;
          description?: string | null;
          instructions?: string | null;
          course_id?: string | null;
          course_code?: string | null;
          course_title?: string | null;
          starts_at?: string;
          ends_at?: string;
          duration_minutes?: number;
          total_marks?: number;
          passing_marks?: number | null;
          passing_percentage?: number | null;
          negative_marking_enabled?: boolean;
          default_negative_marks?: number;
          shuffle_questions?: boolean;
          shuffle_options?: boolean;
          snapshot_payload?: Json;
          attempt_count?: number;
          published_by?: string;
          published_at?: string;
        };
        Relationships: [];
      };
      exam_version_answer_keys: {
        Row: {
          version_id: string;
          institution_id: string;
          exam_id: string;
          keys_payload: Json;
          created_at: string;
        };
        Insert: {
          version_id: string;
          institution_id: string;
          exam_id: string;
          keys_payload: Json;
          created_at?: string;
        };
        Update: {
          version_id?: string;
          institution_id?: string;
          exam_id?: string;
          keys_payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_platform_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      is_institution_member: {
        Args: { p_institution_id: string; p_user_id?: string };
        Returns: boolean;
      };
      has_institution_role: {
        Args: {
          p_institution_id: string;
          p_roles: InstitutionRole[];
          p_user_id?: string;
        };
        Returns: boolean;
      };
      shares_institution_with: {
        Args: { p_other_user_id: string; p_user_id?: string };
        Returns: boolean;
      };
      current_user_email: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      create_institution_with_owner: {
        Args: {
          p_name: string;
          p_slug: string;
          p_institution_type?: string;
        };
        Returns: Database['public']['Tables']['institutions']['Row'];
      };
      accept_institution_invitation: {
        Args: { p_token: string };
        Returns: Database['public']['Tables']['institution_memberships']['Row'];
      };
      get_my_pending_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          institution_id: string;
          institution_name: string;
          institution_slug: string;
          email: string;
          role: InstitutionRole;
          token: string;
          expires_at: string;
          created_at: string;
        }[];
      };
      is_own_student_record: {
        Args: { p_student_id: string; p_user_id?: string };
        Returns: boolean;
      };
    };
    Enums: {
      institution_role: InstitutionRole;
      membership_status: MembershipStatus;
      institution_status: InstitutionStatus;
      invitation_status: InvitationStatus;
      academic_cycle_status: AcademicCycleStatus;
      course_status: CourseStatus;
      student_record_status: StudentRecordStatus;
      enrollment_status: EnrollmentStatus;
      question_type: QuestionType;
      question_difficulty: QuestionDifficulty;
      question_status: QuestionStatus;
      exam_status: ExamStatus;
      exam_section_type: ExamSectionType;
      exam_assignment_target_type: ExamAssignmentTargetType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
