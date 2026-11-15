import { describe, expect, it } from 'vitest';
import {
  addExamSection,
  addQuestionsToExamSection,
  cloneExam,
  closeExam,
  createDraftRevision,
  createExamDraft,
  deleteExamDraft,
  getExamDetail,
  importQuestionSetToExamSection,
  listExams,
  loadExamBuilderCatalog,
  previewExam,
  publishExam,
  removeExamQuestion,
  setExamAssignments,
  updateExamDraft,
  updateExamQuestionConfig,
} from '@/lib/exams.server';
import { createQuestion, createQuestionSet } from '@/lib/question-bank.server';
import { AuthorizationError, type AuthedSupabase } from '@/lib/workspace.server';
import type {
  CourseStatus,
  ExamAssignmentTargetType,
  ExamSectionType,
  ExamStatus,
  InstitutionRole,
  InstitutionStatus,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '@/integrations/supabase/types';

type ExamBuilderMockDb = {
  platform_admins: Array<{ user_id: string }>;
  institutions: Array<{
    id: string;
    name: string;
    slug: string;
    institution_type: 'school' | 'college' | 'university' | 'training_centre';
    status: InstitutionStatus;
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;
  institution_memberships: Array<{
    id: string;
    institution_id: string;
    user_id: string;
    role: InstitutionRole;
    status: 'active' | 'suspended';
    invited_by: string | null;
    created_at: string;
    updated_at: string;
  }>;
  academic_sessions: Array<{
    id: string;
    institution_id: string;
    name: string;
    code: string;
    starts_on: string;
    ends_on: string;
    is_current: boolean;
    status: 'planned' | 'active' | 'archived';
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;
  academic_terms: Array<{
    id: string;
    institution_id: string;
    session_id: string;
    name: string;
    starts_on: string;
    ends_on: string;
    is_current: boolean;
    status: 'planned' | 'active' | 'archived';
    created_at: string;
    updated_at: string;
  }>;
  academic_classes: Array<{
    id: string;
    institution_id: string;
    program_id: string | null;
    name: string;
    code: string;
    level_order: number;
    created_at: string;
    updated_at: string;
  }>;
  class_sections: Array<{
    id: string;
    institution_id: string;
    class_id: string;
    name: string;
    capacity: number;
    created_at: string;
    updated_at: string;
  }>;
  student_records: Array<{
    id: string;
    institution_id: string;
    membership_id: string | null;
    student_code: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    status: 'active' | 'graduated' | 'withdrawn' | 'suspended';
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;
  courses: Array<{
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
  }>;
  questions: Array<{
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
  }>;
  question_options: Array<{
    id: string;
    institution_id: string;
    question_id: string;
    option_key: string;
    option_text: string;
    sort_order: number;
    created_at: string;
  }>;
  question_answer_keys: Array<{
    question_id: string;
    institution_id: string;
    correct_option_keys: string[];
    sample_answer: string | null;
    grading_rubric: string | null;
    explanation: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  }>;
  question_attachments: Array<Record<string, unknown>>;
  question_sets: Array<{
    id: string;
    institution_id: string;
    course_id: string | null;
    title: string;
    description: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;
  question_set_items: Array<{
    id: string;
    institution_id: string;
    question_set_id: string;
    question_id: string;
    sort_order: number;
    marks_override: number | null;
    added_by: string;
    created_at: string;
  }>;
  exams: Array<{
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
  }>;
  exam_sections: Array<{
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
  }>;
  exam_section_questions: Array<{
    id: string;
    institution_id: string;
    exam_id: string;
    section_id: string;
    question_id: string;
    sort_order: number;
    marks: number;
    negative_marks: number;
    created_at: string;
  }>;
  exam_assignments: Array<{
    id: string;
    institution_id: string;
    exam_id: string;
    target_type: ExamAssignmentTargetType;
    class_id: string | null;
    class_section_id: string | null;
    student_id: string | null;
    assigned_by: string;
    created_at: string;
  }>;
  exam_versions: Array<Record<string, unknown>>;
  exam_version_answer_keys: Array<Record<string, unknown>>;
  institution_audit_logs: Array<Record<string, unknown>>;
};

function makeSeedDb(): ExamBuilderMockDb {
  const now = '2026-11-15T00:00:00.000Z';
  return {
    platform_admins: [{ user_id: 'user-super' }],
    institutions: [
      {
        id: 'inst-oak',
        name: 'Oakridge University',
        slug: 'oakridge',
        institution_type: 'university',
        status: 'active',
        created_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'inst-crest',
        name: 'Crestview College',
        slug: 'crestview',
        institution_type: 'college',
        status: 'active',
        created_by: 'user-crest-admin',
        created_at: now,
        updated_at: now,
      },
    ],
    institution_memberships: [
      {
        id: 'mem-oak-admin',
        institution_id: 'inst-oak',
        user_id: 'user-oak-admin',
        role: 'institution_admin',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-oak-teacher',
        institution_id: 'inst-oak',
        user_id: 'user-oak-teacher',
        role: 'teacher',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-oak-student',
        institution_id: 'inst-oak',
        user_id: 'user-oak-student',
        role: 'student',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-oak-invig',
        institution_id: 'inst-oak',
        user_id: 'user-oak-invig',
        role: 'invigilator',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-crest-admin',
        institution_id: 'inst-crest',
        user_id: 'user-crest-admin',
        role: 'institution_admin',
        status: 'active',
        invited_by: 'user-crest-admin',
        created_at: now,
        updated_at: now,
      },
    ],
    academic_sessions: [
      {
        id: 'sess-oak-2026',
        institution_id: 'inst-oak',
        name: '2026–2027',
        code: 'AY26',
        starts_on: '2026-09-01',
        ends_on: '2027-06-30',
        is_current: true,
        status: 'active',
        created_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
    ],
    academic_terms: [
      {
        id: 'term-oak-fall',
        institution_id: 'inst-oak',
        session_id: 'sess-oak-2026',
        name: 'Fall Term',
        starts_on: '2026-09-01',
        ends_on: '2026-12-20',
        is_current: true,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ],
    academic_classes: [
      {
        id: 'cls-oak-y1',
        institution_id: 'inst-oak',
        program_id: null,
        name: 'Year 1 Computer Science',
        code: 'CS-Y1',
        level_order: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'cls-crest-y1',
        institution_id: 'inst-crest',
        program_id: null,
        name: 'Crestview Year 1',
        code: 'CR-Y1',
        level_order: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    class_sections: [
      {
        id: 'sec-oak-a',
        institution_id: 'inst-oak',
        class_id: 'cls-oak-y1',
        name: 'Section A',
        capacity: 50,
        created_at: now,
        updated_at: now,
      },
    ],
    student_records: [
      {
        id: 'stu-oak-1',
        institution_id: 'inst-oak',
        membership_id: 'mem-oak-student',
        student_code: 'OAK-001',
        full_name: 'Amina Tariq',
        email: 'amina@oakridge.edu',
        phone: null,
        status: 'active',
        created_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
    ],
    courses: [
      {
        id: 'course-oak-cs101',
        institution_id: 'inst-oak',
        department_id: null,
        program_id: null,
        class_id: null,
        code: 'CS101',
        title: 'Algorithms & Data Structures',
        credits: 4,
        description: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ],
    questions: [],
    question_options: [],
    question_answer_keys: [],
    question_attachments: [],
    question_sets: [],
    question_set_items: [],
    exams: [],
    exam_sections: [],
    exam_section_questions: [],
    exam_assignments: [],
    exam_versions: [],
    exam_version_answer_keys: [],
    institution_audit_logs: [],
  };
}

function createRlsExamClient(db: ExamBuilderMockDb, actorId: string): AuthedSupabase {
  let seq = 1;
  const isSuper = () => db.platform_admins.some((p) => p.user_id === actorId);
  const isMember = (instId: string) =>
    db.institution_memberships.some(
      (m) => m.institution_id === instId && m.user_id === actorId && m.status === 'active',
    );
  const isEducator = (instId: string) =>
    db.institution_memberships.some(
      (m) =>
        m.institution_id === instId &&
        m.user_id === actorId &&
        m.status === 'active' &&
        (m.role === 'institution_admin' || m.role === 'teacher'),
    );

  const selectRows = (table: string): Record<string, unknown>[] => {
    switch (table) {
      case 'platform_admins':
        return isSuper()
          ? db.platform_admins
          : db.platform_admins.filter((p) => p.user_id === actorId);
      case 'institutions':
        return db.institutions.filter((i) => isSuper() || isMember(i.id));
      case 'institution_memberships':
        return db.institution_memberships.filter(
          (m) => m.user_id === actorId || isSuper() || isMember(m.institution_id),
        );
      case 'academic_sessions':
      case 'academic_terms':
      case 'academic_classes':
      case 'class_sections':
      case 'courses':
        return (db[table] as Record<string, unknown>[]).filter(
          (r) => isSuper() || isMember(String(r['institution_id'])),
        );
      case 'student_records':
      case 'questions':
      case 'question_options':
      case 'question_answer_keys':
      case 'question_attachments':
      case 'question_sets':
      case 'question_set_items':
      case 'exams':
      case 'exam_sections':
      case 'exam_section_questions':
      case 'exam_assignments':
      case 'exam_versions':
      case 'exam_version_answer_keys':
      case 'institution_audit_logs':
        return (db[table] as Record<string, unknown>[]).filter(
          (r) => isSuper() || isEducator(String(r['institution_id'])),
        );
      default:
        return [];
    }
  };

  function makeBuilder(table: string) {
    let filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payloadRows: Record<string, unknown>[] = [];
    let updatePayload: Record<string, unknown> | null = null;
    let maxRows: number | null = null;

    const applyFilters = (rows: Record<string, unknown>[]) => {
      const matched = rows.filter((r) => filters.every((fn) => fn(r)));
      return maxRows !== null ? matched.slice(0, maxRows) : matched;
    };

    const exec = async () => {
      if (mode === 'select') {
        return { data: applyFilters(selectRows(table)), error: null };
      }
      if (mode === 'insert') {
        const inserted: Record<string, unknown>[] = [];
        for (const row of payloadRows) {
          const instId = String(row['institution_id'] ?? '');
          if (!isSuper() && !isEducator(instId)) {
            return { data: null, error: { message: 'new row violates row-level security policy' } };
          }
          const now = new Date(Date.UTC(2026, 10, 15, 0, 0, seq)).toISOString();
          const created: Record<string, unknown> = {
            id: `${table}-${seq++}`,
            created_at: now,
            updated_at: now,
            ...row,
          };
          const arr = (db as Record<string, unknown[]>)[table];
          if (Array.isArray(arr)) arr.push(created);
          inserted.push(created);
        }
        return { data: inserted, error: null };
      }
      if (mode === 'update' && updatePayload) {
        if (table === 'exam_versions' || table === 'exam_version_answer_keys') {
          return { data: null, error: { message: 'Published exam versions are immutable' } };
        }
        const matched = applyFilters(selectRows(table));
        for (const r of matched) {
          const instId = String(r['institution_id'] ?? '');
          if (!isSuper() && !isEducator(instId)) {
            return { data: null, error: { message: 'update violates row-level security policy' } };
          }
          Object.assign(r, updatePayload, { updated_at: '2026-11-15T05:00:00.000Z' });
        }
        return { data: matched, error: null };
      }
      if (mode === 'delete') {
        if (table === 'exam_versions' || table === 'exam_version_answer_keys') {
          return { data: null, error: { message: 'Published exam versions are immutable' } };
        }
        const matched = applyFilters(selectRows(table));
        const ids = new Set(matched.map((r) => r['id'] ?? r['question_id'] ?? r['version_id']));
        const arr = (db as Record<string, Record<string, unknown>[] | undefined>)[table];
        if (Array.isArray(arr)) {
          (db as Record<string, unknown[]>)[table] = arr.filter(
            (r) => !ids.has(r['id'] ?? r['question_id'] ?? r['version_id']),
          );
        }
        return { data: matched, error: null };
      }
      return { data: [], error: null };
    };

    const builder = {
      select: (_cols?: string) => builder,
      insert: (rowOrRows: Record<string, unknown> | Record<string, unknown>[]) => {
        mode = 'insert';
        payloadRows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        return builder;
      },
      update: (row: Record<string, unknown>) => {
        mode = 'update';
        updatePayload = row;
        return builder;
      },
      delete: () => {
        mode = 'delete';
        return builder;
      },
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      order: (_col: string, _opts?: unknown) => builder,
      limit: (n: number) => {
        maxRows = n;
        return builder;
      },
      maybeSingle: async () => {
        const res = await exec();
        if (res.error) return { data: null, error: res.error };
        const arr = Array.isArray(res.data) ? res.data : [];
        return { data: arr[0] ?? null, error: null };
      },
      single: async () => {
        const res = await exec();
        if (res.error) return { data: null, error: res.error };
        const arr = Array.isArray(res.data) ? res.data : [];
        if (!arr[0]) return { data: null, error: { message: 'Row not found' } };
        return { data: arr[0], error: null };
      },
      then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        exec().then(resolve, reject),
    };

    return builder;
  }

  return {
    from: (table: string) => makeBuilder(table),
  } as unknown as AuthedSupabase;
}

describe('Phase 5 Exam Builder workflows, validation, immutability & multi-tenant isolation', () => {
  it('completes full teacher exam creation, section/question selection, marking, randomization, cohort assignment, preview, and publication', async () => {
    const db = makeSeedDb();
    const teacher = createRlsExamClient(db, 'user-oak-teacher');

    // Seed Question Bank with MCQ + Descriptive + Question Set
    const mcq1 = await createQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-cs101',
      questionType: 'mcq_single',
      title: 'Merge Sort Complexity',
      prompt: 'What is the worst-case time complexity of Merge Sort?',
      topic: 'Sorting',
      category: 'Conceptual',
      difficulty: 'easy',
      marks: 2,
      negativeMarks: 0.5,
      options: [
        { optionKey: 'A', optionText: 'O(n)', sortOrder: 0 },
        { optionKey: 'B', optionText: 'O(n log n)', sortOrder: 1 },
        { optionKey: 'C', optionText: 'O(n^2)', sortOrder: 2 },
      ],
      correctOptionKeys: ['B'],
      explanation: 'Merge sort divides log n levels and merges in O(n).',
    });

    const mcq2 = await createQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-cs101',
      questionType: 'mcq_multi',
      title: 'Linear Structures',
      prompt: 'Select linear data structures.',
      topic: 'Data Structures',
      category: 'Conceptual',
      difficulty: 'easy',
      marks: 3,
      negativeMarks: 0,
      options: [
        { optionKey: 'A', optionText: 'Stack', sortOrder: 0 },
        { optionKey: 'B', optionText: 'Queue', sortOrder: 1 },
        { optionKey: 'C', optionText: 'Binary Heap', sortOrder: 2 },
      ],
      correctOptionKeys: ['A', 'B'],
    });

    const desc1 = await createQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-cs101',
      questionType: 'long_answer',
      title: 'Master Theorem Derivation',
      prompt: 'Derive the asymptotic bound for T(n) = 2T(n/2) + n.',
      topic: 'Recurrences',
      category: 'Analytical',
      difficulty: 'hard',
      marks: 10,
      negativeMarks: 0,
      expectedWordCount: 250,
      sampleAnswer: 'Case 2 yields Theta(n log n).',
      gradingRubric: '5 pts recursion tree, 5 pts summation.',
    });

    const reusableSet = await createQuestionSet(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      title: 'CS101 Core MCQs',
      courseId: 'course-oak-cs101',
      questionIds: [mcq1.id, mcq2.id],
    });

    const catalog = await loadExamBuilderCatalog(teacher, 'user-oak-teacher', 'inst-oak');
    expect(catalog.courses).toHaveLength(1);
    expect(catalog.classes).toHaveLength(1);
    expect(catalog.sections).toHaveLength(1);
    expect(catalog.students).toHaveLength(1);
    expect(catalog.questionSets).toHaveLength(1);

    // 1. Server validation rejects invalid schedule windows (end <= start, or window < duration)
    await expect(
      createExamDraft(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        title: 'Invalid Schedule Exam',
        startsAt: '2026-12-01T10:00:00.000Z',
        endsAt: '2026-12-01T09:00:00.000Z',
        durationMinutes: 60,
        negativeMarkingEnabled: false,
        defaultNegativeMarks: 0,
        shuffleQuestions: false,
        shuffleOptions: false,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      createExamDraft(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        title: 'Window Too Short Exam',
        startsAt: '2026-12-01T10:00:00.000Z',
        endsAt: '2026-12-01T10:30:00.000Z',
        durationMinutes: 60,
        negativeMarkingEnabled: false,
        defaultNegativeMarks: 0,
        shuffleQuestions: false,
        shuffleOptions: false,
      }),
    ).rejects.toThrow(AuthorizationError);

    // 2. Create valid draft
    const draft = await createExamDraft(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      title: 'CS101 Midterm Examination',
      description: 'Covers asymptotics, sorting, and linear structures.',
      courseId: 'course-oak-cs101',
      academicSessionId: 'sess-oak-2026',
      academicTermId: 'term-oak-fall',
      instructions: 'Answer all sections. No external notes allowed.',
      startsAt: '2026-12-10T09:00:00.000Z',
      endsAt: '2026-12-10T11:30:00.000Z',
      durationMinutes: 90,
      passingPercentage: 50,
      negativeMarkingEnabled: true,
      defaultNegativeMarks: 0.25,
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    expect(draft.exam.status).toBe('draft');
    expect(draft.exam.shuffle_questions).toBe(true);
    expect(draft.exam.shuffle_options).toBe(true);

    // Cannot publish an empty draft without sections, questions, or assignments
    await expect(
      publishExam(teacher, 'user-oak-teacher', { institutionId: 'inst-oak', examId: draft.exam.id }),
    ).rejects.toThrow(AuthorizationError);

    // 3. Add MCQ section & Descriptive section
    const withMcqSec = await addExamSection(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      title: 'Part A — Objective MCQs',
      sectionType: 'mcq',
      shuffleQuestions: true,
    });
    const mcqSectionId = withMcqSec.sections[0]!.id;

    const withBothSecs = await addExamSection(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      title: 'Part B — Written Proofs',
      sectionType: 'descriptive',
      shuffleQuestions: false,
    });
    const descSectionId = withBothSecs.sections[1]!.id;

    // Adding a descriptive question to an MCQ section is blocked
    await expect(
      addQuestionsToExamSection(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        examId: draft.exam.id,
        sectionId: mcqSectionId,
        questionIds: [desc1.id],
      }),
    ).rejects.toThrow(AuthorizationError);

    // Import reusable MCQ set into Part A, and add long-answer question to Part B
    const importedRes = await importQuestionSetToExamSection(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      sectionId: mcqSectionId,
      questionSetId: reusableSet.id,
    });
    expect(importedRes.addedCount).toBe(2);

    let updated = await addQuestionsToExamSection(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      sectionId: descSectionId,
      questionIds: [desc1.id],
    });
    expect(updated.exam.questionCount).toBe(3);
    expect(updated.exam.total_marks).toBe(15); // 2 + 3 + 10

    // Customize marks for desc1 from 10 -> 15 and set passingMarks = 10
    const descSqId = updated.sections[1]!.questions[0]!.id;
    updated = await updateExamQuestionConfig(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      sectionQuestionId: descSqId,
      marks: 15,
      negativeMarks: 0,
    });
    expect(updated.exam.total_marks).toBe(20);

    // Setting passingMarks > total_marks fails server validation
    await expect(
      updateExamDraft(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        examId: draft.exam.id,
        title: 'CS101 Midterm Examination',
        startsAt: '2026-12-10T09:00:00.000Z',
        endsAt: '2026-12-10T11:30:00.000Z',
        durationMinutes: 90,
        passingMarks: 25,
        negativeMarkingEnabled: true,
        defaultNegativeMarks: 0.25,
        shuffleQuestions: true,
        shuffleOptions: true,
      }),
    ).rejects.toThrow(AuthorizationError);

    updated = await updateExamDraft(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      title: 'CS101 Midterm Examination',
      description: 'Updated description',
      courseId: 'course-oak-cs101',
      academicSessionId: 'sess-oak-2026',
      academicTermId: 'term-oak-fall',
      instructions: 'Answer all sections cleanly.',
      startsAt: '2026-12-10T09:00:00.000Z',
      endsAt: '2026-12-10T11:30:00.000Z',
      durationMinutes: 90,
      passingMarks: 10,
      passingPercentage: 50,
      negativeMarkingEnabled: true,
      defaultNegativeMarks: 0.25,
      shuffleQuestions: true,
      shuffleOptions: true,
    });

    // 4. Assign to classes, sections, and students (and block cross-institution class IDs)
    await expect(
      setExamAssignments(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        examId: draft.exam.id,
        classIds: ['cls-crest-y1'],
        sectionIds: [],
        studentIds: [],
      }),
    ).rejects.toThrow(AuthorizationError);

    updated = await setExamAssignments(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      classIds: ['cls-oak-y1'],
      sectionIds: ['sec-oak-a'],
      studentIds: ['stu-oak-1'],
    });
    expect(updated.assignments).toHaveLength(3);

    // 5. Preview exam in student mode vs educator mode
    const studentPreview = await previewExam(
      teacher,
      'user-oak-teacher',
      'inst-oak',
      draft.exam.id,
      'student',
    );
    expect(studentPreview.warnings).toHaveLength(0);
    expect(studentPreview.totalMarks).toBe(20);
    expect(studentPreview.sections[0]?.questions[0]?.educatorAnswerKey).toBeUndefined();

    const educatorPreview = await previewExam(
      teacher,
      'user-oak-teacher',
      'inst-oak',
      draft.exam.id,
      'educator',
    );
    expect(educatorPreview.sections[0]?.questions[0]?.educatorAnswerKey).toBeDefined();

    // 6. Publish v1
    const published = await publishExam(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
    });
    expect(published.exam.status).toBe('published');
    expect(published.exam.current_version_number).toBe(1);
    expect(published.versions).toHaveLength(1);
    expect(published.versions[0]?.total_marks).toBe(20);
    expect(db.exam_version_answer_keys).toHaveLength(1);

    // Verify published snapshot contains ZERO answer keys
    const snapJson = JSON.stringify(published.versions[0]?.snapshot_payload);
    expect(snapJson).not.toContain('correct_option_keys');
    expect(snapJson).not.toContain('grading_rubric');
  });

  it('maintains immutable published versions, prevents changes once attempts begin, and supports revision, clone & close', async () => {
    const db = makeSeedDb();
    const teacher = createRlsExamClient(db, 'user-oak-teacher');

    const q1 = await createQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-cs101',
      questionType: 'mcq_single',
      title: 'Stack LIFO',
      prompt: 'Which principle governs a stack?',
      topic: 'Stacks',
      category: 'Conceptual',
      difficulty: 'easy',
      marks: 5,
      negativeMarks: 0,
      options: [
        { optionKey: 'A', optionText: 'FIFO', sortOrder: 0 },
        { optionKey: 'B', optionText: 'LIFO', sortOrder: 1 },
      ],
      correctOptionKeys: ['B'],
    });

    const draft = await createExamDraft(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      title: 'Immutable Version Exam',
      startsAt: '2026-12-15T10:00:00.000Z',
      endsAt: '2026-12-15T12:00:00.000Z',
      durationMinutes: 60,
      negativeMarkingEnabled: false,
      defaultNegativeMarks: 0,
      shuffleQuestions: false,
      shuffleOptions: false,
    });
    const withSec = await addExamSection(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      title: 'Section 1',
      sectionType: 'mcq',
    });
    await addQuestionsToExamSection(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      sectionId: withSec.sections[0]!.id,
      questionIds: [q1.id],
    });
    await setExamAssignments(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      classIds: ['cls-oak-y1'],
      sectionIds: [],
      studentIds: [],
    });

    const pubV1 = await publishExam(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
    });
    expect(pubV1.exam.current_version_number).toBe(1);

    // Direct edit while published is blocked
    await expect(
      updateExamDraft(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        examId: draft.exam.id,
        title: 'Silent Mutation Attempt',
        startsAt: '2026-12-15T10:00:00.000Z',
        endsAt: '2026-12-15T12:00:00.000Z',
        durationMinutes: 60,
        negativeMarkingEnabled: false,
        defaultNegativeMarks: 0,
        shuffleQuestions: false,
        shuffleOptions: false,
      }),
    ).rejects.toThrow(AuthorizationError);

    // While attempt_count === 0, teacher can explicitly open draft revision & publish v2; v1 stays frozen!
    await createDraftRevision(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
    });
    await updateExamDraft(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
      title: 'Immutable Version Exam (Revised)',
      startsAt: '2026-12-15T10:00:00.000Z',
      endsAt: '2026-12-15T12:00:00.000Z',
      durationMinutes: 75,
      negativeMarkingEnabled: false,
      defaultNegativeMarks: 0,
      shuffleQuestions: true,
      shuffleOptions: false,
    });

    const pubV2 = await publishExam(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
    });
    expect(pubV2.exam.current_version_number).toBe(2);
    expect(pubV2.versions).toHaveLength(2);
    const v1 = pubV2.versions.find((v) => v.version_number === 1)!;
    const v2 = pubV2.versions.find((v) => v.version_number === 2)!;
    expect(v1.title).toBe('Immutable Version Exam');
    expect(v1.duration_minutes).toBe(60);
    expect(v2.title).toBe('Immutable Version Exam (Revised)');
    expect(v2.duration_minutes).toBe(75);

    // Simulate a student starting an attempt on v2
    const rawV2 = db.exam_versions.find((v) => v['version_number'] === 2)!;
    rawV2['attempt_count'] = 1;

    // Now opening a draft revision OR editing OR deleting is strictly blocked!
    await expect(
      createDraftRevision(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        examId: draft.exam.id,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      removeExamQuestion(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        examId: draft.exam.id,
        sectionQuestionId: pubV2.sections[0]!.questions[0]!.id,
      }),
    ).rejects.toThrow(AuthorizationError);

    // Cannot delete an exam with published versions
    await expect(
      deleteExamDraft(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        examId: draft.exam.id,
      }),
    ).rejects.toThrow(AuthorizationError);

    // Teacher can clone into a fresh editable draft & close the live exam
    const cloned = await cloneExam(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
    });
    expect(cloned.exam.status).toBe('draft');
    expect(cloned.exam.current_version_number).toBe(0);
    expect(cloned.sections).toHaveLength(1);
    expect(cloned.sections[0]?.questions).toHaveLength(1);

    // Unused draft (v0) CAN be deleted
    await deleteExamDraft(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: cloned.exam.id,
    });

    const closed = await closeExam(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      examId: draft.exam.id,
    });
    expect(closed.exam.status).toBe('closed');
    expect(closed.exam.closed_at).not.toBeNull();
  });

  it('enforces role permissions and multi-tenant isolation on exam builder operations', async () => {
    const db = makeSeedDb();
    const oakTeacher = createRlsExamClient(db, 'user-oak-teacher');
    const oakStudent = createRlsExamClient(db, 'user-oak-student');
    const oakInvig = createRlsExamClient(db, 'user-oak-invig');
    const crestAdmin = createRlsExamClient(db, 'user-crest-admin');

    const oakExam = await createExamDraft(oakTeacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      title: 'Oakridge Confidential Exam',
      durationMinutes: 60,
      negativeMarkingEnabled: false,
      defaultNegativeMarks: 0,
      shuffleQuestions: false,
      shuffleOptions: false,
    });

    // Students & Invigilators cannot access Exam Builder endpoints or direct RLS reads
    await expect(
      listExams(oakStudent, 'user-oak-student', 'inst-oak'),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      getExamDetail(oakStudent, 'user-oak-student', 'inst-oak', oakExam.exam.id),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      createExamDraft(oakInvig, 'user-oak-invig', {
        institutionId: 'inst-oak',
        title: 'Invig Rogue Exam',
        durationMinutes: 30,
        negativeMarkingEnabled: false,
        defaultNegativeMarks: 0,
        shuffleQuestions: false,
        shuffleOptions: false,
      }),
    ).rejects.toThrow(AuthorizationError);

    const directStudentRead = await oakStudent.from('exams').select('*').eq('institution_id', 'inst-oak');
    expect(directStudentRead.data).toEqual([]);

    // Cross-tenant admin (Crestview) cannot read, edit, or publish Oakridge exams
    await expect(
      listExams(crestAdmin, 'user-crest-admin', 'inst-oak'),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      publishExam(crestAdmin, 'user-crest-admin', {
        institutionId: 'inst-oak',
        examId: oakExam.exam.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
