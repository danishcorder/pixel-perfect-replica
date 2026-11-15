import type {
  CourseStatus,
  ExamAssignmentTargetType,
  ExamSectionType,
  ExamStatus,
  Json,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '@/integrations/supabase/types';
import {
  buildStudentSafeQuestionView,
  type QuestionSetWithItems,
  type StudentSafeQuestionView,
} from './question-bank.server';
import {
  AuthorizationError,
  verifyInstitutionAccess,
  type AuthedSupabase,
} from './workspace.server';

const EDUCATOR_ROLES = ['institution_admin', 'teacher'] as const;

export type ExamBuilderCatalog = {
  courses: Array<{ id: string; code: string; title: string; status: CourseStatus }>;
  sessions: Array<{ id: string; name: string; code: string; is_current: boolean }>;
  terms: Array<{ id: string; session_id: string; name: string; is_current: boolean }>;
  classes: Array<{ id: string; code: string; name: string; level_order: number }>;
  sections: Array<{ id: string; class_id: string; name: string; capacity: number }>;
  students: Array<{
    id: string;
    student_code: string;
    full_name: string;
    email: string | null;
    status: string;
  }>;
  questionSets: QuestionSetWithItems[];
};

export type ExamSummaryItem = {
  id: string;
  institution_id: string;
  course_id: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  academic_session_id: string | null;
  sessionName: string | null;
  academic_term_id: string | null;
  termName: string | null;
  title: string;
  description: string | null;
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
  sectionCount: number;
  questionCount: number;
  assignmentCount: number;
  totalAttempts: number;
  isLockedByAttempts: boolean;
  created_by: string;
  updated_at: string;
};

export type ExamSectionQuestionDetail = {
  id: string;
  exam_id: string;
  section_id: string;
  question_id: string;
  sort_order: number;
  marks: number;
  negative_marks: number;
  question: {
    id: string;
    question_type: QuestionType;
    title: string;
    prompt: string;
    topic: string;
    category: string;
    difficulty: QuestionDifficulty;
    default_marks: number;
    default_negative_marks: number;
    expected_word_count: number | null;
    status: QuestionStatus;
    course_id: string | null;
    options: Array<{
      id: string;
      option_key: string;
      option_text: string;
      sort_order: number;
    }>;
    answerKey: {
      correct_option_keys: string[];
      sample_answer: string | null;
      grading_rubric: string | null;
      explanation: string | null;
    };
  };
};

export type ExamSectionDetail = {
  id: string;
  institution_id: string;
  exam_id: string;
  title: string;
  description: string | null;
  section_type: ExamSectionType;
  sort_order: number;
  shuffle_questions: boolean;
  sectionTotalMarks: number;
  questions: ExamSectionQuestionDetail[];
};

export type ExamAssignmentDetail = {
  id: string;
  exam_id: string;
  target_type: ExamAssignmentTargetType;
  class_id: string | null;
  class_section_id: string | null;
  student_id: string | null;
  targetLabel: string;
  targetSublabel: string | null;
  created_at: string;
};

export type ExamSnapshotSection = {
  id: string;
  title: string;
  description: string | null;
  section_type: ExamSectionType;
  sort_order: number;
  shuffle_questions: boolean;
  sectionTotalMarks: number;
  questions: Array<
    StudentSafeQuestionView & {
      section_question_id: string;
      sort_order: number;
      effective_marks: number;
      effective_negative_marks: number;
    }
  >;
};

export type ExamSnapshotPayload = {
  versionNumber: number;
  publishedAt: string;
  examId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number | null;
  passingPercentage: number | null;
  negativeMarkingEnabled: boolean;
  defaultNegativeMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  sections: ExamSnapshotSection[];
  assignments: Array<{
    target_type: ExamAssignmentTargetType;
    target_id: string;
    label: string;
  }>;
};

export type ExamVersionRecord = {
  id: string;
  institution_id: string;
  exam_id: string;
  version_number: number;
  title: string;
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
  attempt_count: number;
  published_by: string;
  published_at: string;
  snapshot_payload: ExamSnapshotPayload;
};

export type ExamDetail = {
  exam: ExamSummaryItem & {
    instructions: string | null;
  };
  sections: ExamSectionDetail[];
  assignments: ExamAssignmentDetail[];
  versions: ExamVersionRecord[];
};

export type SaveExamConfigInput = {
  institutionId: string;
  title: string;
  description?: string | null | undefined;
  courseId?: string | null | undefined;
  academicSessionId?: string | null | undefined;
  academicTermId?: string | null | undefined;
  instructions?: string | null | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  durationMinutes: number;
  passingMarks?: number | null | undefined;
  passingPercentage?: number | null | undefined;
  negativeMarkingEnabled: boolean;
  defaultNegativeMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};

export type ExamPreviewData = {
  examId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  courseLabel: string | null;
  status: ExamStatus;
  versionNumber: number | null;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number | null;
  passingPercentage: number | null;
  negativeMarkingEnabled: boolean;
  defaultNegativeMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  mode: 'educator' | 'student';
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    section_type: ExamSectionType;
    shuffle_questions: boolean;
    questions: Array<{
      question: StudentSafeQuestionView;
      effectiveMarks: number;
      effectiveNegativeMarks: number;
      educatorAnswerKey?: {
        correct_option_keys: string[];
        sample_answer: string | null;
        grading_rubric: string | null;
        explanation: string | null;
      };
    }>;
  }>;
  warnings: string[];
};

async function logExamAudit(
  supabase: AuthedSupabase,
  institutionId: string,
  userId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from('institution_audit_logs').insert({
    institution_id: institutionId,
    actor_user_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata as Json,
  });
}

function validateScheduleAndConfig(input: SaveExamConfigInput, totalMarksForCheck?: number) {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440) {
    throw new AuthorizationError('Exam duration must be between 1 and 1,440 minutes (24 hours)', 400);
  }

  if (input.defaultNegativeMarks < 0 || input.defaultNegativeMarks > 1000) {
    throw new AuthorizationError('Default negative marks must be between 0 and 1,000', 400);
  }

  if (input.passingMarks != null) {
    if (input.passingMarks < 0 || input.passingMarks > 100000) {
      throw new AuthorizationError('Passing marks must be 0 or greater', 400);
    }
    if (totalMarksForCheck !== undefined && totalMarksForCheck > 0 && input.passingMarks > totalMarksForCheck) {
      throw new AuthorizationError(
        `Passing marks (${input.passingMarks}) cannot exceed total exam marks (${totalMarksForCheck})`,
        400,
      );
    }
  }

  if (input.passingPercentage != null) {
    if (input.passingPercentage < 0 || input.passingPercentage > 100) {
      throw new AuthorizationError('Passing percentage must be between 0% and 100%', 400);
    }
  }

  const startsIso = input.startsAt?.trim() || null;
  const endsIso = input.endsAt?.trim() || null;

  if ((startsIso && !endsIso) || (!startsIso && endsIso)) {
    throw new AuthorizationError('Provide both start time and end time, or leave both empty for an unscheduled draft', 400);
  }

  if (startsIso && endsIso) {
    const startMs = Date.parse(startsIso);
    const endMs = Date.parse(endsIso);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new AuthorizationError('Start time and end time must be valid ISO date-times', 400);
    }
    if (endMs <= startMs) {
      throw new AuthorizationError('Exam end time must be strictly after the start time', 400);
    }
    const windowMinutes = Math.floor((endMs - startMs) / 60000);
    if (windowMinutes < input.durationMinutes) {
      throw new AuthorizationError(
        `Exam availability window (${windowMinutes} min) must be at least as long as the duration (${input.durationMinutes} min)`,
        400,
      );
    }
  }
}

function isQuestionTypeCompatibleWithSection(
  sectionType: ExamSectionType,
  questionType: QuestionType,
): boolean {
  if (sectionType === 'mixed') return true;
  if (sectionType === 'mcq') {
    return questionType === 'mcq_single' || questionType === 'mcq_multi';
  }
  return questionType === 'descriptive' || questionType === 'long_answer';
}

async function getExamAndVerifyEditableDraft(
  supabase: AuthedSupabase,
  institutionId: string,
  examId: string,
) {
  const [{ data: exam, error: exErr }, { data: versions, error: verErr }] = await Promise.all([
    supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .eq('institution_id', institutionId)
      .maybeSingle(),
    supabase
      .from('exam_versions')
      .select('id, version_number, attempt_count')
      .eq('exam_id', examId)
      .eq('institution_id', institutionId),
  ]);

  if (exErr) throw new Error(exErr.message);
  if (verErr) throw new Error(verErr.message);
  if (!exam) throw new AuthorizationError('Exam not found in this institution', 404);

  const totalAttempts = (versions ?? []).reduce((sum, v) => sum + Number(v.attempt_count ?? 0), 0);

  if (totalAttempts > 0) {
    throw new AuthorizationError(
      'Published exam content is locked because students have already begun attempting it. Close the exam or clone it into a new draft.',
      409,
    );
  }

  if (exam.status !== 'draft') {
    throw new AuthorizationError(
      `This exam is currently ${exam.status}. Use "Prepare New Revision" to unlock draft editing while keeping published version v${exam.current_version_number} immutable.`,
      409,
    );
  }

  return exam;
}

async function recomputeExamTotalMarks(
  supabase: AuthedSupabase,
  institutionId: string,
  examId: string,
): Promise<number> {
  const { data: items, error } = await supabase
    .from('exam_section_questions')
    .select('marks')
    .eq('exam_id', examId)
    .eq('institution_id', institutionId);

  if (error) throw new Error(error.message);

  const total = Number(
    (items ?? []).reduce((sum, row) => sum + Number(row.marks), 0).toFixed(2),
  );

  const { error: updErr } = await supabase
    .from('exams')
    .update({ total_marks: total })
    .eq('id', examId)
    .eq('institution_id', institutionId);

  if (updErr) throw new Error(updErr.message);
  return total;
}

async function verifyCourseSessionTermRefs(
  supabase: AuthedSupabase,
  institutionId: string,
  refs: {
    courseId?: string | null | undefined;
    academicSessionId?: string | null | undefined;
    academicTermId?: string | null | undefined;
  },
) {
  if (refs.courseId) {
    const { data } = await supabase
      .from('courses')
      .select('id')
      .eq('id', refs.courseId)
      .eq('institution_id', institutionId)
      .maybeSingle();
    if (!data) throw new AuthorizationError('Selected subject/course does not belong to this institution', 400);
  }
  if (refs.academicSessionId) {
    const { data } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('id', refs.academicSessionId)
      .eq('institution_id', institutionId)
      .maybeSingle();
    if (!data) throw new AuthorizationError('Selected academic session does not belong to this institution', 400);
  }
  if (refs.academicTermId) {
    const { data } = await supabase
      .from('academic_terms')
      .select('id, session_id')
      .eq('id', refs.academicTermId)
      .eq('institution_id', institutionId)
      .maybeSingle();
    if (!data) throw new AuthorizationError('Selected academic term does not belong to this institution', 400);
    if (refs.academicSessionId && data.session_id !== refs.academicSessionId) {
      throw new AuthorizationError('Selected term does not belong to the chosen academic session', 400);
    }
  }
}

export async function loadExamBuilderCatalog(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
): Promise<ExamBuilderCatalog> {
  await verifyInstitutionAccess(supabase, userId, institutionId, [...EDUCATOR_ROLES]);

  const [
    coursesRes,
    sessionsRes,
    termsRes,
    classesRes,
    sectionsRes,
    studentsRes,
    setsRes,
    setItemsRes,
    questionsRes,
  ] = await Promise.all([
    supabase
      .from('courses')
      .select('id, code, title, status')
      .eq('institution_id', institutionId)
      .order('code', { ascending: true }),
    supabase
      .from('academic_sessions')
      .select('id, name, code, is_current')
      .eq('institution_id', institutionId)
      .order('starts_on', { ascending: false }),
    supabase
      .from('academic_terms')
      .select('id, session_id, name, is_current')
      .eq('institution_id', institutionId)
      .order('starts_on', { ascending: true }),
    supabase
      .from('academic_classes')
      .select('id, code, name, level_order')
      .eq('institution_id', institutionId)
      .order('level_order', { ascending: true }),
    supabase
      .from('class_sections')
      .select('id, class_id, name, capacity')
      .eq('institution_id', institutionId)
      .order('name', { ascending: true }),
    supabase
      .from('student_records')
      .select('id, student_code, full_name, email, status')
      .eq('institution_id', institutionId)
      .eq('status', 'active')
      .order('full_name', { ascending: true }),
    supabase
      .from('question_sets')
      .select('*')
      .eq('institution_id', institutionId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('question_set_items')
      .select('*')
      .eq('institution_id', institutionId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('questions')
      .select('id, title, question_type, difficulty, marks, topic, status')
      .eq('institution_id', institutionId),
  ]);

  for (const res of [
    coursesRes,
    sessionsRes,
    termsRes,
    classesRes,
    sectionsRes,
    studentsRes,
    setsRes,
    setItemsRes,
    questionsRes,
  ]) {
    if (res.error) throw new Error(res.error.message);
  }

  const cMap = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));
  const qMap = new Map((questionsRes.data ?? []).map((q) => [q.id, q]));
  const itemsBySet = new Map<string, QuestionSetWithItems['items']>();

  for (const it of setItemsRes.data ?? []) {
    const q = qMap.get(it.question_id) ?? null;
    const list = itemsBySet.get(it.question_set_id) ?? [];
    list.push({
      id: it.id,
      question_id: it.question_id,
      sort_order: it.sort_order,
      marks_override:
        it.marks_override != null && Number.isFinite(Number(it.marks_override))
          ? Number(it.marks_override)
          : null,
      question: q ? { ...q, marks: Number(q.marks) } : null,
    });
    itemsBySet.set(it.question_set_id, list);
  }

  const questionSets: QuestionSetWithItems[] = (setsRes.data ?? []).map((set) => {
    const course = set.course_id ? cMap.get(set.course_id) : undefined;
    const setItems = itemsBySet.get(set.id) ?? [];
    const totalMarks = setItems.reduce(
      (sum, item) => sum + (item.marks_override ?? item.question?.marks ?? 0),
      0,
    );
    return {
      ...set,
      courseCode: course?.code ?? null,
      courseTitle: course?.title ?? null,
      totalMarks,
      items: setItems,
    };
  });

  return {
    courses: coursesRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    terms: termsRes.data ?? [],
    classes: classesRes.data ?? [],
    sections: sectionsRes.data ?? [],
    students: studentsRes.data ?? [],
    questionSets,
  };
}

export async function listExams(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
  filters?: {
    search?: string | undefined;
    status?: ExamStatus | undefined;
    courseId?: string | undefined;
  },
): Promise<ExamSummaryItem[]> {
  await verifyInstitutionAccess(supabase, userId, institutionId, [...EDUCATOR_ROLES]);

  let exQuery = supabase
    .from('exams')
    .select('*')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false });

  if (filters?.status) {
    exQuery = exQuery.eq('status', filters.status);
  }
  if (filters?.courseId) {
    exQuery = exQuery.eq('course_id', filters.courseId);
  }

  const [examsRes, coursesRes, sessionsRes, termsRes, secRes, qRes, assignRes, verRes] =
    await Promise.all([
      exQuery,
      supabase.from('courses').select('id, code, title').eq('institution_id', institutionId),
      supabase.from('academic_sessions').select('id, name').eq('institution_id', institutionId),
      supabase.from('academic_terms').select('id, name').eq('institution_id', institutionId),
      supabase.from('exam_sections').select('id, exam_id').eq('institution_id', institutionId),
      supabase.from('exam_section_questions').select('id, exam_id').eq('institution_id', institutionId),
      supabase.from('exam_assignments').select('id, exam_id').eq('institution_id', institutionId),
      supabase
        .from('exam_versions')
        .select('id, exam_id, attempt_count')
        .eq('institution_id', institutionId),
    ]);

  for (const res of [examsRes, coursesRes, sessionsRes, termsRes, secRes, qRes, assignRes, verRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const courseMap = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));
  const sessionMap = new Map((sessionsRes.data ?? []).map((s) => [s.id, s]));
  const termMap = new Map((termsRes.data ?? []).map((t) => [t.id, t]));

  const secCountMap = new Map<string, number>();
  for (const row of secRes.data ?? []) {
    secCountMap.set(row.exam_id, (secCountMap.get(row.exam_id) ?? 0) + 1);
  }

  const qCountMap = new Map<string, number>();
  for (const row of qRes.data ?? []) {
    qCountMap.set(row.exam_id, (qCountMap.get(row.exam_id) ?? 0) + 1);
  }

  const assignCountMap = new Map<string, number>();
  for (const row of assignRes.data ?? []) {
    assignCountMap.set(row.exam_id, (assignCountMap.get(row.exam_id) ?? 0) + 1);
  }

  const attemptsMap = new Map<string, number>();
  for (const row of verRes.data ?? []) {
    attemptsMap.set(row.exam_id, (attemptsMap.get(row.exam_id) ?? 0) + Number(row.attempt_count ?? 0));
  }

  const search = filters?.search?.trim().toLowerCase() ?? '';

  return (examsRes.data ?? [])
    .filter((ex) => {
      if (!search) return true;
      const course = ex.course_id ? courseMap.get(ex.course_id) : undefined;
      const hay = [ex.title, ex.description ?? '', course?.code ?? '', course?.title ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(search);
    })
    .map((ex) => {
      const course = ex.course_id ? courseMap.get(ex.course_id) : undefined;
      const session = ex.academic_session_id ? sessionMap.get(ex.academic_session_id) : undefined;
      const term = ex.academic_term_id ? termMap.get(ex.academic_term_id) : undefined;
      const totalAttempts = attemptsMap.get(ex.id) ?? 0;

      return {
        id: ex.id,
        institution_id: ex.institution_id,
        course_id: ex.course_id,
        courseCode: course?.code ?? null,
        courseTitle: course?.title ?? null,
        academic_session_id: ex.academic_session_id,
        sessionName: session?.name ?? null,
        academic_term_id: ex.academic_term_id,
        termName: term?.name ?? null,
        title: ex.title,
        description: ex.description,
        starts_at: ex.starts_at,
        ends_at: ex.ends_at,
        duration_minutes: ex.duration_minutes,
        total_marks: Number(ex.total_marks),
        passing_marks: ex.passing_marks != null ? Number(ex.passing_marks) : null,
        passing_percentage: ex.passing_percentage != null ? Number(ex.passing_percentage) : null,
        negative_marking_enabled: ex.negative_marking_enabled,
        default_negative_marks: Number(ex.default_negative_marks),
        shuffle_questions: ex.shuffle_questions,
        shuffle_options: ex.shuffle_options,
        status: ex.status,
        current_version_number: ex.current_version_number,
        latest_published_version_id: ex.latest_published_version_id,
        published_at: ex.published_at,
        closed_at: ex.closed_at,
        sectionCount: secCountMap.get(ex.id) ?? 0,
        questionCount: qCountMap.get(ex.id) ?? 0,
        assignmentCount: assignCountMap.get(ex.id) ?? 0,
        totalAttempts,
        isLockedByAttempts: totalAttempts > 0,
        created_by: ex.created_by,
        updated_at: ex.updated_at,
      };
    });
}

export async function getExamDetail(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
  examId: string,
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, institutionId, [...EDUCATOR_ROLES]);

  const { data: exam, error: exErr } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);
  if (!exam) throw new AuthorizationError('Exam not found in this institution', 404);

  const [
    courseRes,
    sessionRes,
    termRes,
    secRes,
    sqRes,
    assignRes,
    verRes,
    classesRes,
    classSecRes,
    studentsRes,
  ] = await Promise.all([
    exam.course_id
      ? supabase
          .from('courses')
          .select('id, code, title')
          .eq('id', exam.course_id)
          .eq('institution_id', institutionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    exam.academic_session_id
      ? supabase
          .from('academic_sessions')
          .select('id, name')
          .eq('id', exam.academic_session_id)
          .eq('institution_id', institutionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    exam.academic_term_id
      ? supabase
          .from('academic_terms')
          .select('id, name')
          .eq('id', exam.academic_term_id)
          .eq('institution_id', institutionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('exam_sections')
      .select('*')
      .eq('exam_id', examId)
      .eq('institution_id', institutionId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('exam_section_questions')
      .select('*')
      .eq('exam_id', examId)
      .eq('institution_id', institutionId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('exam_assignments')
      .select('*')
      .eq('exam_id', examId)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('exam_versions')
      .select('*')
      .eq('exam_id', examId)
      .eq('institution_id', institutionId)
      .order('version_number', { ascending: false }),
    supabase
      .from('academic_classes')
      .select('id, code, name')
      .eq('institution_id', institutionId),
    supabase
      .from('class_sections')
      .select('id, class_id, name')
      .eq('institution_id', institutionId),
    supabase
      .from('student_records')
      .select('id, student_code, full_name, email')
      .eq('institution_id', institutionId),
  ]);

  for (const res of [
    courseRes,
    sessionRes,
    termRes,
    secRes,
    sqRes,
    assignRes,
    verRes,
    classesRes,
    classSecRes,
    studentsRes,
  ]) {
    if (res.error) throw new Error(res.error.message);
  }

  const sqRows = sqRes.data ?? [];
  const qIds = Array.from(new Set(sqRows.map((row) => row.question_id)));

  let qMap = new Map<
    string,
    {
      id: string;
      question_type: QuestionType;
      title: string;
      prompt: string;
      topic: string;
      category: string;
      difficulty: QuestionDifficulty;
      marks: number;
      negative_marks: number;
      expected_word_count: number | null;
      status: QuestionStatus;
      course_id: string | null;
    }
  >();
  const optByQ = new Map<
    string,
    Array<{ id: string; option_key: string; option_text: string; sort_order: number }>
  >();
  let keyByQ = new Map<
    string,
    {
      correct_option_keys: string[];
      sample_answer: string | null;
      grading_rubric: string | null;
      explanation: string | null;
    }
  >();

  if (qIds.length > 0) {
    const [questionsRes, optionsRes, keysRes] = await Promise.all([
      supabase
        .from('questions')
        .select(
          'id, question_type, title, prompt, topic, category, difficulty, marks, negative_marks, expected_word_count, status, course_id',
        )
        .eq('institution_id', institutionId)
        .in('id', qIds),
      supabase
        .from('question_options')
        .select('id, question_id, option_key, option_text, sort_order')
        .eq('institution_id', institutionId)
        .in('question_id', qIds)
        .order('sort_order', { ascending: true }),
      supabase
        .from('question_answer_keys')
        .select('question_id, correct_option_keys, sample_answer, grading_rubric, explanation')
        .eq('institution_id', institutionId)
        .in('question_id', qIds),
    ]);

    if (questionsRes.error) throw new Error(questionsRes.error.message);
    if (optionsRes.error) throw new Error(optionsRes.error.message);
    if (keysRes.error) throw new Error(keysRes.error.message);

    qMap = new Map(
      (questionsRes.data ?? []).map((q) => [
        q.id,
        {
          ...q,
          marks: Number(q.marks),
          negative_marks: Number(q.negative_marks),
        },
      ]),
    );

    for (const opt of optionsRes.data ?? []) {
      const list = optByQ.get(opt.question_id) ?? [];
      list.push({
        id: opt.id,
        option_key: opt.option_key,
        option_text: opt.option_text,
        sort_order: opt.sort_order,
      });
      optByQ.set(opt.question_id, list);
    }

    keyByQ = new Map(
      (keysRes.data ?? []).map((k) => [
        k.question_id,
        {
          correct_option_keys: k.correct_option_keys ?? [],
          sample_answer: k.sample_answer ?? null,
          grading_rubric: k.grading_rubric ?? null,
          explanation: k.explanation ?? null,
        },
      ]),
    );
  }

  const questionsBySec = new Map<string, ExamSectionQuestionDetail[]>();
  for (const sq of sqRows) {
    const q = qMap.get(sq.question_id);
    if (!q) continue;
    const keyRow = keyByQ.get(sq.question_id);
    const list = questionsBySec.get(sq.section_id) ?? [];
    list.push({
      id: sq.id,
      exam_id: sq.exam_id,
      section_id: sq.section_id,
      question_id: sq.question_id,
      sort_order: sq.sort_order,
      marks: Number(sq.marks),
      negative_marks: Number(sq.negative_marks),
      question: {
        id: q.id,
        question_type: q.question_type,
        title: q.title,
        prompt: q.prompt,
        topic: q.topic,
        category: q.category,
        difficulty: q.difficulty,
        default_marks: q.marks,
        default_negative_marks: q.negative_marks,
        expected_word_count: q.expected_word_count,
        status: q.status,
        course_id: q.course_id,
        options: optByQ.get(sq.question_id) ?? [],
        answerKey: keyRow ?? {
          correct_option_keys: [],
          sample_answer: null,
          grading_rubric: null,
          explanation: null,
        },
      },
    });
    questionsBySec.set(sq.section_id, list);
  }

  const sections: ExamSectionDetail[] = (secRes.data ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sec) => {
      const qs = (questionsBySec.get(sec.id) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
      return {
        id: sec.id,
        institution_id: sec.institution_id,
        exam_id: sec.exam_id,
        title: sec.title,
        description: sec.description,
        section_type: sec.section_type,
        sort_order: sec.sort_order,
        shuffle_questions: sec.shuffle_questions,
        sectionTotalMarks: Number(qs.reduce((s, item) => s + item.marks, 0).toFixed(2)),
        questions: qs,
      };
    });

  const classMap = new Map((classesRes.data ?? []).map((c) => [c.id, c]));
  const sectionMap = new Map((classSecRes.data ?? []).map((s) => [s.id, s]));
  const studentMap = new Map((studentsRes.data ?? []).map((st) => [st.id, st]));

  const assignments: ExamAssignmentDetail[] = (assignRes.data ?? []).map((a) => {
    if (a.target_type === 'class' && a.class_id) {
      const cls = classMap.get(a.class_id);
      return {
        id: a.id,
        exam_id: a.exam_id,
        target_type: a.target_type,
        class_id: a.class_id,
        class_section_id: null,
        student_id: null,
        targetLabel: cls ? `${cls.code} — ${cls.name}` : 'Class',
        targetSublabel: 'Entire class',
        created_at: a.created_at,
      };
    }
    if (a.target_type === 'section' && a.class_section_id) {
      const csec = sectionMap.get(a.class_section_id);
      const cls = csec ? classMap.get(csec.class_id) : undefined;
      return {
        id: a.id,
        exam_id: a.exam_id,
        target_type: a.target_type,
        class_id: null,
        class_section_id: a.class_section_id,
        student_id: null,
        targetLabel: csec ? `${cls?.code ?? 'Class'} · ${csec.name}` : 'Section',
        targetSublabel: cls?.name ?? 'Class section',
        created_at: a.created_at,
      };
    }
    const stu = a.student_id ? studentMap.get(a.student_id) : undefined;
    return {
      id: a.id,
      exam_id: a.exam_id,
      target_type: a.target_type,
      class_id: null,
      class_section_id: null,
      student_id: a.student_id,
      targetLabel: stu ? `${stu.full_name} (${stu.student_code})` : 'Student',
      targetSublabel: stu?.email ?? 'Individual student',
      created_at: a.created_at,
    };
  });

  const versions: ExamVersionRecord[] = (verRes.data ?? []).map((v) => ({
    id: v.id,
    institution_id: v.institution_id,
    exam_id: v.exam_id,
    version_number: v.version_number,
    title: v.title,
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    duration_minutes: v.duration_minutes,
    total_marks: Number(v.total_marks),
    passing_marks: v.passing_marks != null ? Number(v.passing_marks) : null,
    passing_percentage: v.passing_percentage != null ? Number(v.passing_percentage) : null,
    negative_marking_enabled: v.negative_marking_enabled,
    default_negative_marks: Number(v.default_negative_marks),
    shuffle_questions: v.shuffle_questions,
    shuffle_options: v.shuffle_options,
    attempt_count: Number(v.attempt_count ?? 0),
    published_by: v.published_by,
    published_at: v.published_at,
    snapshot_payload: v.snapshot_payload as unknown as ExamSnapshotPayload,
  }));

  const totalAttempts = versions.reduce((sum, v) => sum + v.attempt_count, 0);
  const computedTotalMarks = Number(
    sections.reduce((sum, sec) => sum + sec.sectionTotalMarks, 0).toFixed(2),
  );

  return {
    exam: {
      id: exam.id,
      institution_id: exam.institution_id,
      course_id: exam.course_id,
      courseCode: courseRes.data?.code ?? null,
      courseTitle: courseRes.data?.title ?? null,
      academic_session_id: exam.academic_session_id,
      sessionName: sessionRes.data?.name ?? null,
      academic_term_id: exam.academic_term_id,
      termName: termRes.data?.name ?? null,
      title: exam.title,
      description: exam.description,
      instructions: exam.instructions,
      starts_at: exam.starts_at,
      ends_at: exam.ends_at,
      duration_minutes: exam.duration_minutes,
      total_marks: computedTotalMarks,
      passing_marks: exam.passing_marks != null ? Number(exam.passing_marks) : null,
      passing_percentage: exam.passing_percentage != null ? Number(exam.passing_percentage) : null,
      negative_marking_enabled: exam.negative_marking_enabled,
      default_negative_marks: Number(exam.default_negative_marks),
      shuffle_questions: exam.shuffle_questions,
      shuffle_options: exam.shuffle_options,
      status: exam.status,
      current_version_number: exam.current_version_number,
      latest_published_version_id: exam.latest_published_version_id,
      published_at: exam.published_at,
      closed_at: exam.closed_at,
      sectionCount: sections.length,
      questionCount: sqRows.length,
      assignmentCount: assignments.length,
      totalAttempts,
      isLockedByAttempts: totalAttempts > 0,
      created_by: exam.created_by,
      updated_at: exam.updated_at,
    },
    sections,
    assignments,
    versions,
  };
}

export async function createExamDraft(
  supabase: AuthedSupabase,
  userId: string,
  input: SaveExamConfigInput,
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  validateScheduleAndConfig(input);
  await verifyCourseSessionTermRefs(supabase, input.institutionId, {
    courseId: input.courseId,
    academicSessionId: input.academicSessionId,
    academicTermId: input.academicTermId,
  });

  const { data: created, error } = await supabase
    .from('exams')
    .insert({
      institution_id: input.institutionId,
      course_id: input.courseId ?? null,
      academic_session_id: input.academicSessionId ?? null,
      academic_term_id: input.academicTermId ?? null,
      title: input.title.trim(),
      description: input.description ? input.description.trim() : null,
      instructions: input.instructions ? input.instructions.trim() : null,
      starts_at: input.startsAt?.trim() || null,
      ends_at: input.endsAt?.trim() || null,
      duration_minutes: input.durationMinutes,
      total_marks: 0,
      passing_marks: input.passingMarks ?? null,
      passing_percentage: input.passingPercentage ?? null,
      negative_marking_enabled: input.negativeMarkingEnabled,
      default_negative_marks: input.negativeMarkingEnabled ? input.defaultNegativeMarks : 0,
      shuffle_questions: input.shuffleQuestions,
      shuffle_options: input.shuffleOptions,
      status: 'draft',
      current_version_number: 0,
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (error || !created) throw new Error(error?.message ?? 'Failed to create exam draft');

  await logExamAudit(supabase, input.institutionId, userId, 'exam.created', 'exam', created.id, {
    title: created.title,
  });

  return getExamDetail(supabase, userId, input.institutionId, created.id);
}

export async function updateExamDraft(
  supabase: AuthedSupabase,
  userId: string,
  input: SaveExamConfigInput & { examId: string },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const existing = await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);
  validateScheduleAndConfig(input, Number(existing.total_marks));
  await verifyCourseSessionTermRefs(supabase, input.institutionId, {
    courseId: input.courseId,
    academicSessionId: input.academicSessionId,
    academicTermId: input.academicTermId,
  });

  const { error } = await supabase
    .from('exams')
    .update({
      course_id: input.courseId ?? null,
      academic_session_id: input.academicSessionId ?? null,
      academic_term_id: input.academicTermId ?? null,
      title: input.title.trim(),
      description: input.description ? input.description.trim() : null,
      instructions: input.instructions ? input.instructions.trim() : null,
      starts_at: input.startsAt?.trim() || null,
      ends_at: input.endsAt?.trim() || null,
      duration_minutes: input.durationMinutes,
      passing_marks: input.passingMarks ?? null,
      passing_percentage: input.passingPercentage ?? null,
      negative_marking_enabled: input.negativeMarkingEnabled,
      default_negative_marks: input.negativeMarkingEnabled ? input.defaultNegativeMarks : 0,
      shuffle_questions: input.shuffleQuestions,
      shuffle_options: input.shuffleOptions,
      updated_by: userId,
    })
    .eq('id', input.examId)
    .eq('institution_id', input.institutionId);

  if (error) throw new Error(error.message);

  await logExamAudit(supabase, input.institutionId, userId, 'exam.updated', 'exam', input.examId, {
    title: input.title.trim(),
  });

  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function addExamSection(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    examId: string;
    title: string;
    description?: string | null | undefined;
    sectionType: ExamSectionType;
    shuffleQuestions?: boolean | undefined;
  },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  const { data: existingSecs, error: secErr } = await supabase
    .from('exam_sections')
    .select('sort_order')
    .eq('exam_id', input.examId)
    .eq('institution_id', input.institutionId);

  if (secErr) throw new Error(secErr.message);
  const nextOrder = (existingSecs ?? []).reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;

  const { error } = await supabase.from('exam_sections').insert({
    institution_id: input.institutionId,
    exam_id: input.examId,
    title: input.title.trim(),
    description: input.description ? input.description.trim() : null,
    section_type: input.sectionType,
    sort_order: nextOrder,
    shuffle_questions: input.shuffleQuestions ?? false,
  });

  if (error) throw new Error(error.message);

  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function updateExamSection(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    examId: string;
    sectionId: string;
    title: string;
    description?: string | null | undefined;
    sectionType: ExamSectionType;
    shuffleQuestions: boolean;
  },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  // Check existing questions in this section remain compatible with the new sectionType
  const { data: secQuestions, error: sqErr } = await supabase
    .from('exam_section_questions')
    .select('question_id')
    .eq('section_id', input.sectionId)
    .eq('exam_id', input.examId)
    .eq('institution_id', input.institutionId);
  if (sqErr) throw new Error(sqErr.message);

  const qIds = (secQuestions ?? []).map((r) => r.question_id);
  if (qIds.length > 0 && input.sectionType !== 'mixed') {
    const { data: qTypes, error: qtErr } = await supabase
      .from('questions')
      .select('id, question_type')
      .eq('institution_id', input.institutionId)
      .in('id', qIds);
    if (qtErr) throw new Error(qtErr.message);
    const incompatible = (qTypes ?? []).find(
      (q) => !isQuestionTypeCompatibleWithSection(input.sectionType, q.question_type),
    );
    if (incompatible) {
      throw new AuthorizationError(
        `Cannot switch section to "${input.sectionType}" because it already contains incompatible questions.`,
        400,
      );
    }
  }

  const { data: updated, error } = await supabase
    .from('exam_sections')
    .update({
      title: input.title.trim(),
      description: input.description ? input.description.trim() : null,
      section_type: input.sectionType,
      shuffle_questions: input.shuffleQuestions,
    })
    .eq('id', input.sectionId)
    .eq('exam_id', input.examId)
    .eq('institution_id', input.institutionId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw new AuthorizationError('Exam section not found', 404);

  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function deleteExamSection(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; examId: string; sectionId: string },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  const { error } = await supabase
    .from('exam_sections')
    .delete()
    .eq('id', input.sectionId)
    .eq('exam_id', input.examId)
    .eq('institution_id', input.institutionId);

  if (error) throw new Error(error.message);
  await recomputeExamTotalMarks(supabase, input.institutionId, input.examId);
  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function addQuestionsToExamSection(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    examId: string;
    sectionId: string;
    questionIds: string[];
  },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const exam = await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  const [{ data: section, error: secErr }, { data: existingInExam, error: exQErr }] =
    await Promise.all([
      supabase
        .from('exam_sections')
        .select('*')
        .eq('id', input.sectionId)
        .eq('exam_id', input.examId)
        .eq('institution_id', input.institutionId)
        .maybeSingle(),
      supabase
        .from('exam_section_questions')
        .select('question_id, section_id, sort_order')
        .eq('exam_id', input.examId)
        .eq('institution_id', input.institutionId),
    ]);

  if (secErr) throw new Error(secErr.message);
  if (exQErr) throw new Error(exQErr.message);
  if (!section) throw new AuthorizationError('Exam section not found in this exam', 404);

  const existingQuestionIds = new Set((existingInExam ?? []).map((q) => q.question_id));
  const candidateIds = Array.from(new Set(input.questionIds)).filter(
    (id) => !existingQuestionIds.has(id),
  );

  if (candidateIds.length === 0) {
    return getExamDetail(supabase, userId, input.institutionId, input.examId);
  }

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, title, question_type, status, marks, negative_marks')
    .eq('institution_id', input.institutionId)
    .in('id', candidateIds);

  if (qErr) throw new Error(qErr.message);

  const qMap = new Map((questions ?? []).map((q) => [q.id, q]));
  const rowsToInsert: Array<{
    institution_id: string;
    exam_id: string;
    section_id: string;
    question_id: string;
    sort_order: number;
    marks: number;
    negative_marks: number;
  }> = [];

  let nextOrder =
    (existingInExam ?? [])
      .filter((r) => r.section_id === input.sectionId)
      .reduce((max, r) => Math.max(max, r.sort_order), -1) + 1;

  for (const qId of candidateIds) {
    const q = qMap.get(qId);
    if (!q) {
      throw new AuthorizationError('Selected question was not found in this institution', 404);
    }
    if (q.status === 'archived') {
      throw new AuthorizationError(`Question "${q.title}" is archived and cannot be added to an exam`, 400);
    }
    if (!isQuestionTypeCompatibleWithSection(section.section_type, q.question_type)) {
      throw new AuthorizationError(
        `Question "${q.title}" (${q.question_type}) is not compatible with "${section.section_type}" section "${section.title}"`,
        400,
      );
    }

    const negMarks = exam.negative_marking_enabled
      ? Number(q.negative_marks) > 0
        ? Number(q.negative_marks)
        : Number(exam.default_negative_marks)
      : 0;

    rowsToInsert.push({
      institution_id: input.institutionId,
      exam_id: input.examId,
      section_id: input.sectionId,
      question_id: q.id,
      sort_order: nextOrder++,
      marks: Number(q.marks),
      negative_marks: negMarks,
    });
  }

  const { error: insErr } = await supabase.from('exam_section_questions').insert(rowsToInsert);
  if (insErr) throw new Error(insErr.message);

  await recomputeExamTotalMarks(supabase, input.institutionId, input.examId);
  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function importQuestionSetToExamSection(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    examId: string;
    sectionId: string;
    questionSetId: string;
  },
): Promise<{ detail: ExamDetail; addedCount: number; skippedCount: number }> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const exam = await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  const [secRes, setItemsRes, existingRes] = await Promise.all([
    supabase
      .from('exam_sections')
      .select('*')
      .eq('id', input.sectionId)
      .eq('exam_id', input.examId)
      .eq('institution_id', input.institutionId)
      .maybeSingle(),
    supabase
      .from('question_set_items')
      .select('question_id, marks_override, sort_order')
      .eq('question_set_id', input.questionSetId)
      .eq('institution_id', input.institutionId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('exam_section_questions')
      .select('question_id, section_id, sort_order')
      .eq('exam_id', input.examId)
      .eq('institution_id', input.institutionId),
  ]);

  if (secRes.error) throw new Error(secRes.error.message);
  if (setItemsRes.error) throw new Error(setItemsRes.error.message);
  if (existingRes.error) throw new Error(existingRes.error.message);

  const section = secRes.data;
  if (!section) throw new AuthorizationError('Exam section not found', 404);

  const setItems = setItemsRes.data ?? [];
  if (setItems.length === 0) {
    throw new AuthorizationError('Selected Question Set has no questions', 400);
  }

  const existingIds = new Set((existingRes.data ?? []).map((r) => r.question_id));
  const candidateIds = setItems.map((i) => i.question_id);

  const { data: qRows, error: qErr } = await supabase
    .from('questions')
    .select('id, question_type, status, marks, negative_marks')
    .eq('institution_id', input.institutionId)
    .in('id', candidateIds);
  if (qErr) throw new Error(qErr.message);

  const qMap = new Map((qRows ?? []).map((q) => [q.id, q]));
  let nextOrder =
    (existingRes.data ?? [])
      .filter((r) => r.section_id === input.sectionId)
      .reduce((max, r) => Math.max(max, r.sort_order), -1) + 1;

  const toInsert: Array<{
    institution_id: string;
    exam_id: string;
    section_id: string;
    question_id: string;
    sort_order: number;
    marks: number;
    negative_marks: number;
  }> = [];
  let skippedCount = 0;

  for (const item of setItems) {
    const q = qMap.get(item.question_id);
    if (
      !q ||
      existingIds.has(q.id) ||
      q.status === 'archived' ||
      !isQuestionTypeCompatibleWithSection(section.section_type, q.question_type)
    ) {
      skippedCount++;
      continue;
    }
    existingIds.add(q.id);
    const effectiveMarks =
      item.marks_override != null && Number.isFinite(Number(item.marks_override))
        ? Number(item.marks_override)
        : Number(q.marks);
    const negMarks = exam.negative_marking_enabled
      ? Number(q.negative_marks) > 0
        ? Number(q.negative_marks)
        : Number(exam.default_negative_marks)
      : 0;

    toInsert.push({
      institution_id: input.institutionId,
      exam_id: input.examId,
      section_id: input.sectionId,
      question_id: q.id,
      sort_order: nextOrder++,
      marks: effectiveMarks,
      negative_marks: negMarks,
    });
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('exam_section_questions').insert(toInsert);
    if (insErr) throw new Error(insErr.message);
    await recomputeExamTotalMarks(supabase, input.institutionId, input.examId);
  }

  const detail = await getExamDetail(supabase, userId, input.institutionId, input.examId);
  return { detail, addedCount: toInsert.length, skippedCount };
}

export async function updateExamQuestionConfig(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    examId: string;
    sectionQuestionId: string;
    marks: number;
    negativeMarks: number;
  },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  if (input.marks <= 0 || input.marks > 1000) {
    throw new AuthorizationError('Question marks must be greater than 0 and at most 1,000', 400);
  }
  if (input.negativeMarks < 0 || input.negativeMarks > 1000) {
    throw new AuthorizationError('Negative marks must be between 0 and 1,000', 400);
  }

  const { data: updated, error } = await supabase
    .from('exam_section_questions')
    .update({
      marks: input.marks,
      negative_marks: input.negativeMarks,
    })
    .eq('id', input.sectionQuestionId)
    .eq('exam_id', input.examId)
    .eq('institution_id', input.institutionId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw new AuthorizationError('Exam question entry not found', 404);

  await recomputeExamTotalMarks(supabase, input.institutionId, input.examId);
  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function removeExamQuestion(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    examId: string;
    sectionQuestionId: string;
  },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  const { error } = await supabase
    .from('exam_section_questions')
    .delete()
    .eq('id', input.sectionQuestionId)
    .eq('exam_id', input.examId)
    .eq('institution_id', input.institutionId);

  if (error) throw new Error(error.message);
  await recomputeExamTotalMarks(supabase, input.institutionId, input.examId);
  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function setExamAssignments(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    examId: string;
    classIds: string[];
    sectionIds: string[];
    studentIds: string[];
  },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  const cleanClassIds = Array.from(new Set(input.classIds));
  const cleanSectionIds = Array.from(new Set(input.sectionIds));
  const cleanStudentIds = Array.from(new Set(input.studentIds));

  // Verify every target belongs to this exact institution
  const [clsCheck, secCheck, stuCheck] = await Promise.all([
    cleanClassIds.length > 0
      ? supabase
          .from('academic_classes')
          .select('id')
          .eq('institution_id', input.institutionId)
          .in('id', cleanClassIds)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
    cleanSectionIds.length > 0
      ? supabase
          .from('class_sections')
          .select('id')
          .eq('institution_id', input.institutionId)
          .in('id', cleanSectionIds)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
    cleanStudentIds.length > 0
      ? supabase
          .from('student_records')
          .select('id')
          .eq('institution_id', input.institutionId)
          .in('id', cleanStudentIds)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
  ]);

  if (clsCheck.error) throw new Error(clsCheck.error.message);
  if (secCheck.error) throw new Error(secCheck.error.message);
  if (stuCheck.error) throw new Error(stuCheck.error.message);

  if ((clsCheck.data ?? []).length !== cleanClassIds.length) {
    throw new AuthorizationError('One or more selected classes do not belong to this institution', 403);
  }
  if ((secCheck.data ?? []).length !== cleanSectionIds.length) {
    throw new AuthorizationError('One or more selected sections do not belong to this institution', 403);
  }
  if ((stuCheck.data ?? []).length !== cleanStudentIds.length) {
    throw new AuthorizationError('One or more selected students do not belong to this institution', 403);
  }

  const { error: delErr } = await supabase
    .from('exam_assignments')
    .delete()
    .eq('exam_id', input.examId)
    .eq('institution_id', input.institutionId);
  if (delErr) throw new Error(delErr.message);

  const rows: Array<{
    institution_id: string;
    exam_id: string;
    target_type: ExamAssignmentTargetType;
    class_id: string | null;
    class_section_id: string | null;
    student_id: string | null;
    assigned_by: string;
  }> = [
    ...cleanClassIds.map((id) => ({
      institution_id: input.institutionId,
      exam_id: input.examId,
      target_type: 'class' as const,
      class_id: id,
      class_section_id: null,
      student_id: null,
      assigned_by: userId,
    })),
    ...cleanSectionIds.map((id) => ({
      institution_id: input.institutionId,
      exam_id: input.examId,
      target_type: 'section' as const,
      class_id: null,
      class_section_id: id,
      student_id: null,
      assigned_by: userId,
    })),
    ...cleanStudentIds.map((id) => ({
      institution_id: input.institutionId,
      exam_id: input.examId,
      target_type: 'student' as const,
      class_id: null,
      class_section_id: null,
      student_id: id,
      assigned_by: userId,
    })),
  ];

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('exam_assignments').insert(rows);
    if (insErr) throw new Error(insErr.message);
  }

  await logExamAudit(supabase, input.institutionId, userId, 'exam.assignments_updated', 'exam', input.examId, {
    classes: cleanClassIds.length,
    sections: cleanSectionIds.length,
    students: cleanStudentIds.length,
  });

  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

function deterministicPreviewOrder<T>(items: T[], enabled: boolean): T[] {
  if (!enabled || items.length <= 1) return items;
  // Deterministic preview rotation so educators can see randomization effect predictably
  return [...items.slice(1), items[0]!];
}

export async function previewExam(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
  examId: string,
  mode: 'educator' | 'student' = 'educator',
): Promise<ExamPreviewData> {
  const detail = await getExamDetail(supabase, userId, institutionId, examId);
  const { exam, sections, assignments } = detail;

  const warnings: string[] = [];
  if (!exam.starts_at || !exam.ends_at) {
    warnings.push('Start and end schedule times are not yet configured.');
  } else {
    const windowMins = Math.floor((Date.parse(exam.ends_at) - Date.parse(exam.starts_at)) / 60000);
    if (windowMins < exam.duration_minutes) {
      warnings.push('Availability window is shorter than exam duration.');
    }
  }
  if (sections.length === 0) {
    warnings.push('Add at least one MCQ or Descriptive section before publishing.');
  }
  if (exam.questionCount === 0) {
    warnings.push('Select at least one question from the Question Bank.');
  }
  const emptySec = sections.find((s) => s.questions.length === 0);
  if (emptySec) {
    warnings.push(`Section "${emptySec.title}" has no questions.`);
  }
  if (assignments.length === 0) {
    warnings.push('Assign at least one class, section, or student cohort before publishing.');
  }
  if (exam.passing_marks != null && exam.total_marks > 0 && exam.passing_marks > exam.total_marks) {
    warnings.push('Passing marks exceed total exam marks.');
  }

  return {
    examId: exam.id,
    title: exam.title,
    description: exam.description,
    instructions: exam.instructions,
    courseLabel: exam.courseCode ? `${exam.courseCode} — ${exam.courseTitle}` : null,
    status: exam.status,
    versionNumber: exam.current_version_number > 0 ? exam.current_version_number : null,
    startsAt: exam.starts_at,
    endsAt: exam.ends_at,
    durationMinutes: exam.duration_minutes,
    totalMarks: exam.total_marks,
    passingMarks: exam.passing_marks,
    passingPercentage: exam.passing_percentage,
    negativeMarkingEnabled: exam.negative_marking_enabled,
    defaultNegativeMarks: exam.default_negative_marks,
    shuffleQuestions: exam.shuffle_questions,
    shuffleOptions: exam.shuffle_options,
    mode,
    sections: sections.map((sec) => {
      const shouldShuffleQ = exam.shuffle_questions || sec.shuffle_questions;
      const orderedQuestions = deterministicPreviewOrder(sec.questions, shouldShuffleQ);

      return {
        id: sec.id,
        title: sec.title,
        description: sec.description,
        section_type: sec.section_type,
        shuffle_questions: sec.shuffle_questions,
        questions: orderedQuestions.map((item) => {
          const orderedOptions = deterministicPreviewOrder(item.question.options, exam.shuffle_options);
          const safeQuestion = buildStudentSafeQuestionView({
            id: item.question.id,
            institution_id: exam.institution_id,
            course_id: item.question.course_id,
            question_type: item.question.question_type,
            title: item.question.title,
            prompt: item.question.prompt,
            marks: item.marks,
            negative_marks: exam.negative_marking_enabled ? item.negative_marks : 0,
            expected_word_count: item.question.expected_word_count,
            options: orderedOptions,
          });

          if (mode === 'student') {
            return {
              question: safeQuestion,
              effectiveMarks: item.marks,
              effectiveNegativeMarks: exam.negative_marking_enabled ? item.negative_marks : 0,
            };
          }

          return {
            question: safeQuestion,
            effectiveMarks: item.marks,
            effectiveNegativeMarks: exam.negative_marking_enabled ? item.negative_marks : 0,
            educatorAnswerKey: item.question.answerKey,
          };
        }),
      };
    }),
    warnings,
  };
}

export async function publishExam(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; examId: string },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);

  const detail = await getExamDetail(supabase, userId, input.institutionId, input.examId);
  const { exam, sections, assignments } = detail;

  // Strict server-side publication validation
  if (!exam.starts_at || !exam.ends_at) {
    throw new AuthorizationError('Set both exam start time and end time before publishing', 400);
  }
  validateScheduleAndConfig(
    {
      institutionId: input.institutionId,
      title: exam.title,
      description: exam.description,
      courseId: exam.course_id,
      academicSessionId: exam.academic_session_id,
      academicTermId: exam.academic_term_id,
      instructions: exam.instructions,
      startsAt: exam.starts_at,
      endsAt: exam.ends_at,
      durationMinutes: exam.duration_minutes,
      passingMarks: exam.passing_marks,
      passingPercentage: exam.passing_percentage,
      negativeMarkingEnabled: exam.negative_marking_enabled,
      defaultNegativeMarks: exam.default_negative_marks,
      shuffleQuestions: exam.shuffle_questions,
      shuffleOptions: exam.shuffle_options,
    },
    exam.total_marks,
  );

  if (sections.length === 0) {
    throw new AuthorizationError('Exam must contain at least one section before publishing', 400);
  }
  if (exam.questionCount === 0 || exam.total_marks <= 0) {
    throw new AuthorizationError('Exam must contain at least one question before publishing', 400);
  }
  for (const sec of sections) {
    if (sec.questions.length === 0) {
      throw new AuthorizationError(`Section "${sec.title}" cannot be empty when publishing`, 400);
    }
    for (const item of sec.questions) {
      if (item.question.status === 'archived') {
        throw new AuthorizationError(
          `Question "${item.question.title}" is archived. Remove or replace it before publishing.`,
          400,
        );
      }
      if (!isQuestionTypeCompatibleWithSection(sec.section_type, item.question.question_type)) {
        throw new AuthorizationError(
          `Question "${item.question.title}" is incompatible with section "${sec.title}".`,
          400,
        );
      }
      if (
        (item.question.question_type === 'mcq_single' ||
          item.question.question_type === 'mcq_multi') &&
        (item.question.options.length < 2 || item.question.answerKey.correct_option_keys.length === 0)
      ) {
        throw new AuthorizationError(
          `MCQ "${item.question.title}" is missing options or a valid answer key.`,
          400,
        );
      }
    }
  }

  if (assignments.length === 0) {
    throw new AuthorizationError(
      'Assign the exam to at least one class, section, or student before publishing',
      400,
    );
  }

  const nextVersionNumber = exam.current_version_number + 1;
  const publishedAt = new Date().toISOString();

  // Build student-safe immutable snapshot (ZERO answer keys, rubrics, sample answers, or explanations)
  const snapshotPayload: ExamSnapshotPayload = {
    versionNumber: nextVersionNumber,
    publishedAt,
    examId: exam.id,
    title: exam.title,
    description: exam.description,
    instructions: exam.instructions,
    courseCode: exam.courseCode,
    courseTitle: exam.courseTitle,
    startsAt: exam.starts_at,
    endsAt: exam.ends_at,
    durationMinutes: exam.duration_minutes,
    totalMarks: exam.total_marks,
    passingMarks: exam.passing_marks,
    passingPercentage: exam.passing_percentage,
    negativeMarkingEnabled: exam.negative_marking_enabled,
    defaultNegativeMarks: exam.default_negative_marks,
    shuffleQuestions: exam.shuffle_questions,
    shuffleOptions: exam.shuffle_options,
    sections: sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      description: sec.description,
      section_type: sec.section_type,
      sort_order: sec.sort_order,
      shuffle_questions: sec.shuffle_questions,
      sectionTotalMarks: sec.sectionTotalMarks,
      questions: sec.questions.map((item) => ({
        ...buildStudentSafeQuestionView({
          id: item.question.id,
          institution_id: exam.institution_id,
          course_id: item.question.course_id,
          question_type: item.question.question_type,
          title: item.question.title,
          prompt: item.question.prompt,
          marks: item.marks,
          negative_marks: exam.negative_marking_enabled ? item.negative_marks : 0,
          expected_word_count: item.question.expected_word_count,
          options: item.question.options,
        }),
        section_question_id: item.id,
        sort_order: item.sort_order,
        effective_marks: item.marks,
        effective_negative_marks: exam.negative_marking_enabled ? item.negative_marks : 0,
      })),
    })),
    assignments: assignments.map((a) => ({
      target_type: a.target_type,
      target_id: (a.class_id ?? a.class_section_id ?? a.student_id)!,
      label: a.targetLabel,
    })),
  };

  // Build private frozen answer keys snapshot stored ONLY in exam_version_answer_keys
  const frozenAnswerKeys: Record<
    string,
    {
      question_type: QuestionType;
      marks: number;
      negative_marks: number;
      correct_option_keys: string[];
      sample_answer: string | null;
      grading_rubric: string | null;
      explanation: string | null;
    }
  > = {};

  for (const sec of sections) {
    for (const item of sec.questions) {
      frozenAnswerKeys[item.question_id] = {
        question_type: item.question.question_type,
        marks: item.marks,
        negative_marks: exam.negative_marking_enabled ? item.negative_marks : 0,
        correct_option_keys: item.question.answerKey.correct_option_keys,
        sample_answer: item.question.answerKey.sample_answer,
        grading_rubric: item.question.answerKey.grading_rubric,
        explanation: item.question.answerKey.explanation,
      };
    }
  }

  const { data: versionRow, error: verErr } = await supabase
    .from('exam_versions')
    .insert({
      institution_id: input.institutionId,
      exam_id: exam.id,
      version_number: nextVersionNumber,
      title: exam.title,
      description: exam.description,
      instructions: exam.instructions,
      course_id: exam.course_id,
      course_code: exam.courseCode,
      course_title: exam.courseTitle,
      starts_at: exam.starts_at,
      ends_at: exam.ends_at,
      duration_minutes: exam.duration_minutes,
      total_marks: exam.total_marks,
      passing_marks: exam.passing_marks,
      passing_percentage: exam.passing_percentage,
      negative_marking_enabled: exam.negative_marking_enabled,
      default_negative_marks: exam.default_negative_marks,
      shuffle_questions: exam.shuffle_questions,
      shuffle_options: exam.shuffle_options,
      snapshot_payload: snapshotPayload as unknown as Json,
      attempt_count: 0,
      published_by: userId,
      published_at: publishedAt,
    })
    .select('*')
    .single();

  if (verErr || !versionRow) {
    throw new Error(verErr?.message ?? 'Failed to publish immutable exam version');
  }

  const { error: keysErr } = await supabase.from('exam_version_answer_keys').insert({
    version_id: versionRow.id,
    institution_id: input.institutionId,
    exam_id: exam.id,
    keys_payload: frozenAnswerKeys as unknown as Json,
  });

  if (keysErr) {
    throw new Error(keysErr.message);
  }

  const { error: updErr } = await supabase
    .from('exams')
    .update({
      status: 'published',
      total_marks: exam.total_marks,
      current_version_number: nextVersionNumber,
      latest_published_version_id: versionRow.id,
      published_at: publishedAt,
      updated_by: userId,
    })
    .eq('id', exam.id)
    .eq('institution_id', input.institutionId);

  if (updErr) throw new Error(updErr.message);

  await logExamAudit(supabase, input.institutionId, userId, 'exam.published', 'exam', exam.id, {
    version_number: nextVersionNumber,
    version_id: versionRow.id,
    total_marks: exam.total_marks,
    question_count: exam.questionCount,
  });

  return getExamDetail(supabase, userId, input.institutionId, exam.id);
}

export async function createDraftRevision(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; examId: string },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const [{ data: exam, error: exErr }, { data: versions, error: verErr }] = await Promise.all([
    supabase
      .from('exams')
      .select('*')
      .eq('id', input.examId)
      .eq('institution_id', input.institutionId)
      .maybeSingle(),
    supabase
      .from('exam_versions')
      .select('id, version_number, attempt_count')
      .eq('exam_id', input.examId)
      .eq('institution_id', input.institutionId),
  ]);

  if (exErr) throw new Error(exErr.message);
  if (verErr) throw new Error(verErr.message);
  if (!exam) throw new AuthorizationError('Exam not found in this institution', 404);

  if (exam.status !== 'published') {
    throw new AuthorizationError('Only published exams can open a new draft revision', 409);
  }

  const totalAttempts = (versions ?? []).reduce((sum, v) => sum + Number(v.attempt_count ?? 0), 0);
  if (totalAttempts > 0) {
    throw new AuthorizationError(
      'Cannot unlock published exam for revision after students have begun attempting it. Close the exam or clone it into a new draft instead.',
      409,
    );
  }

  const { error: updErr } = await supabase
    .from('exams')
    .update({ status: 'draft', updated_by: userId })
    .eq('id', input.examId)
    .eq('institution_id', input.institutionId);

  if (updErr) throw new Error(updErr.message);

  await logExamAudit(supabase, input.institutionId, userId, 'exam.revision_opened', 'exam', input.examId, {
    previous_version: exam.current_version_number,
  });

  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function closeExam(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; examId: string },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const { data: exam, error: exErr } = await supabase
    .from('exams')
    .select('*')
    .eq('id', input.examId)
    .eq('institution_id', input.institutionId)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);
  if (!exam) throw new AuthorizationError('Exam not found in this institution', 404);
  if (exam.status !== 'published') {
    throw new AuthorizationError('Only published exams can be closed', 409);
  }

  const closedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('exams')
    .update({ status: 'closed', closed_at: closedAt, updated_by: userId })
    .eq('id', input.examId)
    .eq('institution_id', input.institutionId);

  if (updErr) throw new Error(updErr.message);

  await logExamAudit(supabase, input.institutionId, userId, 'exam.closed', 'exam', input.examId, {
    closed_at: closedAt,
    version_number: exam.current_version_number,
  });

  return getExamDetail(supabase, userId, input.institutionId, input.examId);
}

export async function cloneExam(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; examId: string },
): Promise<ExamDetail> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const source = await getExamDetail(supabase, userId, input.institutionId, input.examId);

  const cloneTitle = `Copy of ${source.exam.title}`.slice(0, 180);
  const { data: clonedExam, error: insErr } = await supabase
    .from('exams')
    .insert({
      institution_id: input.institutionId,
      course_id: source.exam.course_id,
      academic_session_id: source.exam.academic_session_id,
      academic_term_id: source.exam.academic_term_id,
      title: cloneTitle,
      description: source.exam.description,
      instructions: source.exam.instructions,
      starts_at: source.exam.starts_at,
      ends_at: source.exam.ends_at,
      duration_minutes: source.exam.duration_minutes,
      total_marks: source.exam.total_marks,
      passing_marks: source.exam.passing_marks,
      passing_percentage: source.exam.passing_percentage,
      negative_marking_enabled: source.exam.negative_marking_enabled,
      default_negative_marks: source.exam.default_negative_marks,
      shuffle_questions: source.exam.shuffle_questions,
      shuffle_options: source.exam.shuffle_options,
      status: 'draft',
      current_version_number: 0,
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (insErr || !clonedExam) throw new Error(insErr?.message ?? 'Failed to clone exam');

  for (const sec of source.sections) {
    const { data: newSec, error: secErr } = await supabase
      .from('exam_sections')
      .insert({
        institution_id: input.institutionId,
        exam_id: clonedExam.id,
        title: sec.title,
        description: sec.description,
        section_type: sec.section_type,
        sort_order: sec.sort_order,
        shuffle_questions: sec.shuffle_questions,
      })
      .select('*')
      .single();

    if (secErr || !newSec) throw new Error(secErr?.message ?? 'Failed to clone section');

    if (sec.questions.length > 0) {
      const { error: sqErr } = await supabase.from('exam_section_questions').insert(
        sec.questions.map((item) => ({
          institution_id: input.institutionId,
          exam_id: clonedExam.id,
          section_id: newSec.id,
          question_id: item.question_id,
          sort_order: item.sort_order,
          marks: item.marks,
          negative_marks: item.negative_marks,
        })),
      );
      if (sqErr) throw new Error(sqErr.message);
    }
  }

  if (source.assignments.length > 0) {
    const { error: aErr } = await supabase.from('exam_assignments').insert(
      source.assignments.map((a) => ({
        institution_id: input.institutionId,
        exam_id: clonedExam.id,
        target_type: a.target_type,
        class_id: a.class_id,
        class_section_id: a.class_section_id,
        student_id: a.student_id,
        assigned_by: userId,
      })),
    );
    if (aErr) throw new Error(aErr.message);
  }

  await logExamAudit(supabase, input.institutionId, userId, 'exam.cloned', 'exam', clonedExam.id, {
    source_exam_id: source.exam.id,
  });

  return getExamDetail(supabase, userId, input.institutionId, clonedExam.id);
}

export async function deleteExamDraft(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; examId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const exam = await getExamAndVerifyEditableDraft(supabase, input.institutionId, input.examId);
  if (exam.current_version_number > 0) {
    throw new AuthorizationError(
      'Cannot delete an exam that already has immutable published version history',
      409,
    );
  }

  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('id', input.examId)
    .eq('institution_id', input.institutionId);

  if (error) throw new Error(error.message);

  await logExamAudit(supabase, input.institutionId, userId, 'exam.draft_deleted', 'exam', input.examId, {
    title: exam.title,
  });
}
