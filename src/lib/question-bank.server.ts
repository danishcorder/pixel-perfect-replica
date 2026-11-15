import type {
  CourseStatus,
  Json,
  QuestionAttachmentKind,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '@/integrations/supabase/types';
import type { PaginatedResult } from './academic.server';
import {
  parseAndValidateQuestionCsv,
  type QuestionCsvImportError,
} from './question-csv';
import {
  AuthorizationError,
  verifyInstitutionAccess,
  type AuthedSupabase,
} from './workspace.server';

import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  QUESTION_ATTACHMENT_BUCKET,
} from './question-attachments';

export {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  QUESTION_ATTACHMENT_BUCKET,
};

export type QuestionOptionInput = {
  optionKey: string;
  optionText: string;
  sortOrder: number;
};

export type QuestionAttachmentWithUrl = {
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
  signedUrl: string | null;
};

export type EducatorQuestionItem = {
  id: string;
  institution_id: string;
  course_id: string | null;
  courseCode: string | null;
  courseTitle: string | null;
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
  attachments: QuestionAttachmentWithUrl[];
};

/**
 * Projection intentionally stripped of all answer keys, sample answers, rubrics, and explanations.
 * Used when preparing student-facing exam payloads (Phase 5+).
 */
export type StudentSafeQuestionView = {
  id: string;
  institution_id: string;
  course_id: string | null;
  question_type: QuestionType;
  title: string;
  prompt: string;
  marks: number;
  negative_marks: number;
  expected_word_count: number | null;
  options: Array<{
    id: string;
    option_key: string;
    option_text: string;
    sort_order: number;
  }>;
};

export type QuestionBankCatalog = {
  courses: Array<{ id: string; code: string; title: string; status: CourseStatus }>;
  topics: string[];
  categories: string[];
  stats: {
    total: number;
    active: number;
    draft: number;
    archived: number;
    mcqCount: number;
    writtenCount: number;
  };
};

export type QuestionCsvImportSummary = {
  totalRows: number;
  validRows: number;
  importedCount: number;
  errorCount: number;
  errors: QuestionCsvImportError[];
};

export type QuestionSetWithItems = {
  id: string;
  institution_id: string;
  course_id: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  totalMarks: number;
  items: Array<{
    id: string;
    question_id: string;
    sort_order: number;
    marks_override: number | null;
    question: {
      id: string;
      title: string;
      question_type: QuestionType;
      difficulty: QuestionDifficulty;
      marks: number;
      topic: string;
      status: QuestionStatus;
    } | null;
  }>;
};

export type SaveQuestionInput = {
  institutionId: string;
  courseId?: string | null | undefined;
  questionType: QuestionType;
  title: string;
  prompt: string;
  topic: string;
  category: string;
  difficulty: QuestionDifficulty;
  marks: number;
  negativeMarks: number;
  expectedWordCount?: number | null | undefined;
  tags?: string[] | undefined;
  status?: QuestionStatus | undefined;
  options?: QuestionOptionInput[] | undefined;
  correctOptionKeys?: string[] | undefined;
  sampleAnswer?: string | null | undefined;
  gradingRubric?: string | null | undefined;
  explanation?: string | null | undefined;
};

const EDUCATOR_ROLES = ['institution_admin', 'teacher'] as const;

async function logQuestionBankAudit(
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

function validateQuestionPayload(input: SaveQuestionInput) {
  if (input.marks <= 0 || input.marks > 1000) {
    throw new AuthorizationError('Marks must be greater than 0 and at most 1000', 400);
  }
  if (input.negativeMarks < 0 || input.negativeMarks > 1000) {
    throw new AuthorizationError('Negative marks must be between 0 and 1000', 400);
  }

  const isMcq = input.questionType === 'mcq_single' || input.questionType === 'mcq_multi';
  if (isMcq) {
    const cleanOptions = (input.options ?? [])
      .map((o, idx) => ({
        optionKey: o.optionKey.trim().toUpperCase(),
        optionText: o.optionText.trim(),
        sortOrder: Number.isFinite(o.sortOrder) ? o.sortOrder : idx,
      }))
      .filter((o) => o.optionText.length > 0 && o.optionKey.length > 0);

    if (cleanOptions.length < 2) {
      throw new AuthorizationError('MCQ questions require at least 2 non-empty answer options', 400);
    }

    const optionKeys = new Set(cleanOptions.map((o) => o.optionKey));
    if (optionKeys.size !== cleanOptions.length) {
      throw new AuthorizationError('MCQ option keys must be unique', 400);
    }

    const cleanCorrect = Array.from(
      new Set((input.correctOptionKeys ?? []).map((k) => k.trim().toUpperCase())),
    ).filter((k) => optionKeys.has(k));

    if (cleanCorrect.length === 0) {
      throw new AuthorizationError('Select at least 1 correct option for this MCQ', 400);
    }
    if (input.questionType === 'mcq_single' && cleanCorrect.length !== 1) {
      throw new AuthorizationError(
        'Single-choice MCQs must have exactly 1 correct option (use Multiple-Select MCQ for multiple answers)',
        400,
      );
    }

    return {
      isMcq: true,
      options: cleanOptions,
      correctOptionKeys: cleanCorrect,
    };
  }

  return {
    isMcq: false,
    options: [] as QuestionOptionInput[],
    correctOptionKeys: [] as string[],
  };
}

export function validateAttachmentDescriptor(input: {
  institutionId: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
}): QuestionAttachmentKind {
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(input.mimeType)) {
    throw new AuthorizationError(
      'Unsupported file type. Permitted: PNG, JPEG, WebP, GIF, PDF, TXT, or DOCX.',
      400,
    );
  }
  if (input.fileSizeBytes <= 0 || input.fileSizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new AuthorizationError('Attachment must be greater than 0 bytes and at most 10 MB', 400);
  }
  if (
    !input.storagePath.startsWith(`${input.institutionId}/`) ||
    input.storagePath.includes('..')
  ) {
    throw new AuthorizationError('Invalid tenant storage path for attachment', 400);
  }
  return ALLOWED_IMAGE_MIME_TYPES.includes(
    input.mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
  )
    ? 'image'
    : 'document';
}

async function resolveSignedAttachmentUrl(
  supabase: AuthedSupabase,
  storagePath: string,
): Promise<string | null> {
  try {
    const storageApi = (
      supabase as unknown as {
        storage?: {
          from: (bucket: string) => {
            createSignedUrl: (
              path: string,
              expiresIn: number,
            ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
          };
        };
      }
    ).storage;
    if (!storageApi) return null;
    const { data, error } = await storageApi
      .from(QUESTION_ATTACHMENT_BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export function buildStudentSafeQuestionView(
  question: Pick<
    EducatorQuestionItem,
    | 'id'
    | 'institution_id'
    | 'course_id'
    | 'question_type'
    | 'title'
    | 'prompt'
    | 'marks'
    | 'negative_marks'
    | 'expected_word_count'
    | 'options'
  >,
): StudentSafeQuestionView {
  return {
    id: question.id,
    institution_id: question.institution_id,
    course_id: question.course_id,
    question_type: question.question_type,
    title: question.title,
    prompt: question.prompt,
    marks: Number(question.marks),
    negative_marks: Number(question.negative_marks),
    expected_word_count: question.expected_word_count,
    options: question.options.map((o) => ({
      id: o.id,
      option_key: o.option_key,
      option_text: o.option_text,
      sort_order: o.sort_order,
    })),
  };
}

export async function loadQuestionBankCatalog(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
): Promise<QuestionBankCatalog> {
  await verifyInstitutionAccess(supabase, userId, institutionId, [...EDUCATOR_ROLES]);

  const [coursesRes, questionsRes] = await Promise.all([
    supabase
      .from('courses')
      .select('id, code, title, status')
      .eq('institution_id', institutionId)
      .order('code', { ascending: true }),
    supabase
      .from('questions')
      .select('id, topic, category, status, question_type')
      .eq('institution_id', institutionId),
  ]);

  if (coursesRes.error) throw new Error(coursesRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);

  const qRows = questionsRes.data ?? [];
  const topics = Array.from(new Set(qRows.map((q) => q.topic).filter(Boolean))).sort();
  const categories = Array.from(new Set(qRows.map((q) => q.category).filter(Boolean))).sort();

  return {
    courses: coursesRes.data ?? [],
    topics,
    categories,
    stats: {
      total: qRows.length,
      active: qRows.filter((q) => q.status === 'active').length,
      draft: qRows.filter((q) => q.status === 'draft').length,
      archived: qRows.filter((q) => q.status === 'archived').length,
      mcqCount: qRows.filter(
        (q) => q.question_type === 'mcq_single' || q.question_type === 'mcq_multi',
      ).length,
      writtenCount: qRows.filter(
        (q) => q.question_type === 'descriptive' || q.question_type === 'long_answer',
      ).length,
    },
  };
}

export async function listQuestionsPaginated(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    search?: string | undefined;
    courseId?: string | undefined;
    topic?: string | undefined;
    category?: string | undefined;
    difficulty?: QuestionDifficulty | undefined;
    questionType?: QuestionType | undefined;
    status?: QuestionStatus | undefined;
    includeArchived?: boolean | undefined;
    page: number;
    pageSize: number;
  },
): Promise<PaginatedResult<EducatorQuestionItem>> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  let qQuery = supabase
    .from('questions')
    .select('*')
    .eq('institution_id', input.institutionId)
    .order('updated_at', { ascending: false });

  if (input.status) {
    qQuery = qQuery.eq('status', input.status);
  } else if (!input.includeArchived) {
    qQuery = qQuery.in('status', ['active', 'draft']);
  }
  if (input.courseId) {
    qQuery = qQuery.eq('course_id', input.courseId);
  }
  if (input.difficulty) {
    qQuery = qQuery.eq('difficulty', input.difficulty);
  }
  if (input.questionType) {
    qQuery = qQuery.eq('question_type', input.questionType);
  }

  const [qRes, coursesRes] = await Promise.all([
    qQuery,
    supabase
      .from('courses')
      .select('id, code, title')
      .eq('institution_id', input.institutionId),
  ]);

  if (qRes.error) throw new Error(qRes.error.message);
  if (coursesRes.error) throw new Error(coursesRes.error.message);

  const courseMap = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));
  const topicFilter = input.topic?.trim().toLowerCase() ?? '';
  const categoryFilter = input.category?.trim().toLowerCase() ?? '';
  const search = input.search?.trim().toLowerCase() ?? '';

  const filteredBase = (qRes.data ?? []).filter((q) => {
    if (topicFilter && q.topic.toLowerCase() !== topicFilter) return false;
    if (categoryFilter && q.category.toLowerCase() !== categoryFilter) return false;
    if (search) {
      const course = q.course_id ? courseMap.get(q.course_id) : undefined;
      const hay = [
        q.title,
        q.prompt,
        q.topic,
        q.category,
        ...(q.tags ?? []),
        course?.code ?? '',
        course?.title ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const total = filteredBase.length;
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const safePage = Math.min(Math.max(1, input.page), totalPages);
  const start = (safePage - 1) * input.pageSize;
  const pageQuestions = filteredBase.slice(start, start + input.pageSize);

  const qIds = pageQuestions.map((q) => q.id);
  if (qIds.length === 0) {
    return {
      items: [],
      total,
      page: safePage,
      pageSize: input.pageSize,
      totalPages,
    };
  }

  const [optRes, keyRes, attRes] = await Promise.all([
    supabase
      .from('question_options')
      .select('*')
      .eq('institution_id', input.institutionId)
      .in('question_id', qIds)
      .order('sort_order', { ascending: true }),
    supabase
      .from('question_answer_keys')
      .select('*')
      .eq('institution_id', input.institutionId)
      .in('question_id', qIds),
    supabase
      .from('question_attachments')
      .select('*')
      .eq('institution_id', input.institutionId)
      .in('question_id', qIds)
      .order('created_at', { ascending: true }),
  ]);

  if (optRes.error) throw new Error(optRes.error.message);
  if (keyRes.error) throw new Error(keyRes.error.message);
  if (attRes.error) throw new Error(attRes.error.message);

  const optionsByQ = new Map<string, EducatorQuestionItem['options']>();
  for (const opt of optRes.data ?? []) {
    const list = optionsByQ.get(opt.question_id) ?? [];
    list.push({
      id: opt.id,
      option_key: opt.option_key,
      option_text: opt.option_text,
      sort_order: opt.sort_order,
    });
    optionsByQ.set(opt.question_id, list);
  }

  const keyByQ = new Map((keyRes.data ?? []).map((k) => [k.question_id, k]));

  const attachmentsWithUrls = await Promise.all(
    (attRes.data ?? []).map(async (att) => ({
      ...att,
      signedUrl: await resolveSignedAttachmentUrl(supabase, att.storage_path),
    })),
  );
  const attByQ = new Map<string, QuestionAttachmentWithUrl[]>();
  for (const att of attachmentsWithUrls) {
    const list = attByQ.get(att.question_id) ?? [];
    list.push(att);
    attByQ.set(att.question_id, list);
  }

  const items: EducatorQuestionItem[] = pageQuestions.map((q) => {
    const course = q.course_id ? courseMap.get(q.course_id) : undefined;
    const keyRow = keyByQ.get(q.id);
    return {
      ...q,
      marks: Number(q.marks),
      negative_marks: Number(q.negative_marks),
      courseCode: course?.code ?? null,
      courseTitle: course?.title ?? null,
      options: optionsByQ.get(q.id) ?? [],
      answerKey: {
        correct_option_keys: keyRow?.correct_option_keys ?? [],
        sample_answer: keyRow?.sample_answer ?? null,
        grading_rubric: keyRow?.grading_rubric ?? null,
        explanation: keyRow?.explanation ?? null,
      },
      attachments: attByQ.get(q.id) ?? [],
    };
  });

  return {
    items,
    total,
    page: safePage,
    pageSize: input.pageSize,
    totalPages,
  };
}

export async function getQuestionById(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
  questionId: string,
): Promise<EducatorQuestionItem> {
  await verifyInstitutionAccess(supabase, userId, institutionId, [...EDUCATOR_ROLES]);

  const { data: q, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (qErr) throw new Error(qErr.message);
  if (!q) throw new AuthorizationError('Question not found in this institution', 404);

  const [courseRes, optRes, keyRes, attRes] = await Promise.all([
    q.course_id
      ? supabase
          .from('courses')
          .select('id, code, title')
          .eq('id', q.course_id)
          .eq('institution_id', institutionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('question_options')
      .select('*')
      .eq('question_id', q.id)
      .eq('institution_id', institutionId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('question_answer_keys')
      .select('*')
      .eq('question_id', q.id)
      .eq('institution_id', institutionId)
      .maybeSingle(),
    supabase
      .from('question_attachments')
      .select('*')
      .eq('question_id', q.id)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: true }),
  ]);

  if (courseRes.error) throw new Error(courseRes.error.message);
  if (optRes.error) throw new Error(optRes.error.message);
  if (keyRes.error) throw new Error(keyRes.error.message);
  if (attRes.error) throw new Error(attRes.error.message);

  const attachments = await Promise.all(
    (attRes.data ?? []).map(async (att) => ({
      ...att,
      signedUrl: await resolveSignedAttachmentUrl(supabase, att.storage_path),
    })),
  );

  return {
    ...q,
    marks: Number(q.marks),
    negative_marks: Number(q.negative_marks),
    courseCode: courseRes.data?.code ?? null,
    courseTitle: courseRes.data?.title ?? null,
    options: (optRes.data ?? []).map((o) => ({
      id: o.id,
      option_key: o.option_key,
      option_text: o.option_text,
      sort_order: o.sort_order,
    })),
    answerKey: {
      correct_option_keys: keyRes.data?.correct_option_keys ?? [],
      sample_answer: keyRes.data?.sample_answer ?? null,
      grading_rubric: keyRes.data?.grading_rubric ?? null,
      explanation: keyRes.data?.explanation ?? null,
    },
    attachments,
  };
}

export async function createQuestion(
  supabase: AuthedSupabase,
  userId: string,
  input: SaveQuestionInput,
): Promise<EducatorQuestionItem> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const validated = validateQuestionPayload(input);

  const { data: q, error: qErr } = await supabase
    .from('questions')
    .insert({
      institution_id: input.institutionId,
      course_id: input.courseId ?? null,
      question_type: input.questionType,
      title: input.title.trim(),
      prompt: input.prompt.trim(),
      topic: input.topic.trim() || 'General',
      category: input.category.trim() || 'Conceptual',
      difficulty: input.difficulty,
      marks: input.marks,
      negative_marks: input.negativeMarks,
      expected_word_count: validated.isMcq ? null : (input.expectedWordCount ?? null),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      status: input.status ?? 'active',
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (qErr || !q) throw new Error(qErr?.message ?? 'Failed to create question');

  if (validated.isMcq && validated.options.length > 0) {
    const { error: optErr } = await supabase.from('question_options').insert(
      validated.options.map((o) => ({
        institution_id: input.institutionId,
        question_id: q.id,
        option_key: o.optionKey,
        option_text: o.optionText,
        sort_order: o.sortOrder,
      })),
    );
    if (optErr) {
      await supabase.from('questions').delete().eq('id', q.id).eq('institution_id', input.institutionId);
      throw new Error(optErr.message);
    }
  }

  const { error: keyErr } = await supabase.from('question_answer_keys').insert({
    question_id: q.id,
    institution_id: input.institutionId,
    correct_option_keys: validated.correctOptionKeys,
    sample_answer: input.sampleAnswer ? input.sampleAnswer.trim() : null,
    grading_rubric: input.gradingRubric ? input.gradingRubric.trim() : null,
    explanation: input.explanation ? input.explanation.trim() : null,
    updated_by: userId,
  });

  if (keyErr) {
    await supabase.from('questions').delete().eq('id', q.id).eq('institution_id', input.institutionId);
    throw new Error(keyErr.message);
  }

  await logQuestionBankAudit(
    supabase,
    input.institutionId,
    userId,
    'question.created',
    'question',
    q.id,
    { question_type: q.question_type, title: q.title },
  );

  return getQuestionById(supabase, userId, input.institutionId, q.id);
}

export async function updateQuestion(
  supabase: AuthedSupabase,
  userId: string,
  input: SaveQuestionInput & { questionId: string },
): Promise<EducatorQuestionItem> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const validated = validateQuestionPayload(input);

  const { data: updated, error: updErr } = await supabase
    .from('questions')
    .update({
      course_id: input.courseId ?? null,
      question_type: input.questionType,
      title: input.title.trim(),
      prompt: input.prompt.trim(),
      topic: input.topic.trim() || 'General',
      category: input.category.trim() || 'Conceptual',
      difficulty: input.difficulty,
      marks: input.marks,
      negative_marks: input.negativeMarks,
      expected_word_count: validated.isMcq ? null : (input.expectedWordCount ?? null),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      status: input.status ?? 'active',
      updated_by: userId,
    })
    .eq('id', input.questionId)
    .eq('institution_id', input.institutionId)
    .select('*')
    .maybeSingle();

  if (updErr) throw new Error(updErr.message);
  if (!updated) throw new AuthorizationError('Question not found in this institution', 404);

  // Replace options cleanly
  const { error: delOptErr } = await supabase
    .from('question_options')
    .delete()
    .eq('question_id', input.questionId)
    .eq('institution_id', input.institutionId);
  if (delOptErr) throw new Error(delOptErr.message);

  if (validated.isMcq && validated.options.length > 0) {
    const { error: insOptErr } = await supabase.from('question_options').insert(
      validated.options.map((o) => ({
        institution_id: input.institutionId,
        question_id: input.questionId,
        option_key: o.optionKey,
        option_text: o.optionText,
        sort_order: o.sortOrder,
      })),
    );
    if (insOptErr) throw new Error(insOptErr.message);
  }

  // Upsert private answer key
  const { data: existingKey } = await supabase
    .from('question_answer_keys')
    .select('question_id')
    .eq('question_id', input.questionId)
    .eq('institution_id', input.institutionId)
    .maybeSingle();

  if (existingKey) {
    const { error: keyErr } = await supabase
      .from('question_answer_keys')
      .update({
        correct_option_keys: validated.correctOptionKeys,
        sample_answer: input.sampleAnswer ? input.sampleAnswer.trim() : null,
        grading_rubric: input.gradingRubric ? input.gradingRubric.trim() : null,
        explanation: input.explanation ? input.explanation.trim() : null,
        updated_by: userId,
      })
      .eq('question_id', input.questionId)
      .eq('institution_id', input.institutionId);
    if (keyErr) throw new Error(keyErr.message);
  } else {
    const { error: keyInsErr } = await supabase.from('question_answer_keys').insert({
      question_id: input.questionId,
      institution_id: input.institutionId,
      correct_option_keys: validated.correctOptionKeys,
      sample_answer: input.sampleAnswer ? input.sampleAnswer.trim() : null,
      grading_rubric: input.gradingRubric ? input.gradingRubric.trim() : null,
      explanation: input.explanation ? input.explanation.trim() : null,
      updated_by: userId,
    });
    if (keyInsErr) throw new Error(keyInsErr.message);
  }

  await logQuestionBankAudit(
    supabase,
    input.institutionId,
    userId,
    'question.updated',
    'question',
    input.questionId,
    { title: updated.title },
  );

  return getQuestionById(supabase, userId, input.institutionId, input.questionId);
}

export async function duplicateQuestion(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; questionId: string },
): Promise<EducatorQuestionItem> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const source = await getQuestionById(supabase, userId, input.institutionId, input.questionId);

  const cloneTitle = `Copy of ${source.title}`.slice(0, 180);
  const { data: clone, error: cloneErr } = await supabase
    .from('questions')
    .insert({
      institution_id: input.institutionId,
      course_id: source.course_id,
      question_type: source.question_type,
      title: cloneTitle,
      prompt: source.prompt,
      topic: source.topic,
      category: source.category,
      difficulty: source.difficulty,
      marks: source.marks,
      negative_marks: source.negative_marks,
      expected_word_count: source.expected_word_count,
      tags: source.tags,
      status: 'draft',
      source_question_id: source.id,
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (cloneErr || !clone) throw new Error(cloneErr?.message ?? 'Failed to duplicate question');

  if (source.options.length > 0) {
    const { error: optErr } = await supabase.from('question_options').insert(
      source.options.map((o) => ({
        institution_id: input.institutionId,
        question_id: clone.id,
        option_key: o.option_key,
        option_text: o.option_text,
        sort_order: o.sort_order,
      })),
    );
    if (optErr) throw new Error(optErr.message);
  }

  const { error: keyErr } = await supabase.from('question_answer_keys').insert({
    question_id: clone.id,
    institution_id: input.institutionId,
    correct_option_keys: source.answerKey.correct_option_keys,
    sample_answer: source.answerKey.sample_answer,
    grading_rubric: source.answerKey.grading_rubric,
    explanation: source.answerKey.explanation,
    updated_by: userId,
  });
  if (keyErr) throw new Error(keyErr.message);

  await logQuestionBankAudit(
    supabase,
    input.institutionId,
    userId,
    'question.duplicated',
    'question',
    clone.id,
    { source_question_id: source.id },
  );

  return getQuestionById(supabase, userId, input.institutionId, clone.id);
}

export async function setQuestionStatus(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; questionId: string; status: QuestionStatus },
): Promise<EducatorQuestionItem> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const { data: updated, error } = await supabase
    .from('questions')
    .update({ status: input.status, updated_by: userId })
    .eq('id', input.questionId)
    .eq('institution_id', input.institutionId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw new AuthorizationError('Question not found in this institution', 404);

  await logQuestionBankAudit(
    supabase,
    input.institutionId,
    userId,
    `question.${input.status}`,
    'question',
    input.questionId,
  );

  return getQuestionById(supabase, userId, input.institutionId, input.questionId);
}

export async function deleteQuestion(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; questionId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', input.questionId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function attachQuestionFile(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    questionId: string;
    fileName: string;
    storagePath: string;
    mimeType: string;
    fileSizeBytes: number;
  },
): Promise<QuestionAttachmentWithUrl> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const kind = validateAttachmentDescriptor(input);

  const { data: q } = await supabase
    .from('questions')
    .select('id')
    .eq('id', input.questionId)
    .eq('institution_id', input.institutionId)
    .maybeSingle();
  if (!q) {
    throw new AuthorizationError('Question not found in this institution', 404);
  }

  const { data: att, error } = await supabase
    .from('question_attachments')
    .insert({
      institution_id: input.institutionId,
      question_id: input.questionId,
      file_name: input.fileName.trim(),
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      attachment_kind: kind,
      uploaded_by: userId,
    })
    .select('*')
    .single();

  if (error || !att) throw new Error(error?.message ?? 'Failed to record attachment');

  return {
    ...att,
    signedUrl: await resolveSignedAttachmentUrl(supabase, att.storage_path),
  };
}

export async function deleteQuestionAttachment(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; attachmentId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const { data: att, error: findErr } = await supabase
    .from('question_attachments')
    .select('*')
    .eq('id', input.attachmentId)
    .eq('institution_id', input.institutionId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!att) throw new AuthorizationError('Attachment not found in this institution', 404);

  // Best-effort remove from Supabase Storage first
  try {
    const storageApi = (
      supabase as unknown as {
        storage?: {
          from: (bucket: string) => {
            remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
          };
        };
      }
    ).storage;
    if (storageApi) {
      await storageApi.from(QUESTION_ATTACHMENT_BUCKET).remove([att.storage_path]);
    }
  } catch {
    // Ignore storage cleanup errors in test/offline environments
  }

  const { error: delErr } = await supabase
    .from('question_attachments')
    .delete()
    .eq('id', input.attachmentId)
    .eq('institution_id', input.institutionId);
  if (delErr) throw new Error(delErr.message);
}

export async function importQuestionsFromCsv(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    fileName: string;
    csvText: string;
    defaultCourseId?: string | null | undefined;
  },
): Promise<QuestionCsvImportSummary> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const parsed = parseAndValidateQuestionCsv(input.csvText);
  const errors: QuestionCsvImportError[] = [...parsed.errors];

  if (parsed.validRows.length === 0) {
    await supabase.from('csv_import_jobs').insert({
      institution_id: input.institutionId,
      uploaded_by: userId,
      entity_type: 'questions',
      file_name: input.fileName,
      total_rows: parsed.totalRows,
      imported_count: 0,
      error_count: errors.length,
      errors: errors as unknown as Json,
    });
    return {
      totalRows: parsed.totalRows,
      validRows: 0,
      importedCount: 0,
      errorCount: errors.length,
      errors,
    };
  }

  const { data: coursesData, error: courseErr } = await supabase
    .from('courses')
    .select('id, code')
    .eq('institution_id', input.institutionId);
  if (courseErr) throw new Error(courseErr.message);

  const courseByCode = new Map(
    (coursesData ?? []).map((c) => [c.code.trim().toUpperCase(), c.id]),
  );

  let importedCount = 0;

  for (const row of parsed.validRows) {
    let courseId = input.defaultCourseId ?? null;
    if (row.subject_code) {
      const matched = courseByCode.get(row.subject_code.toUpperCase());
      if (!matched) {
        errors.push({
          row: row.row,
          field: 'subject_code',
          title: row.title,
          message: `Unknown subject_code "${row.subject_code}" in this institution`,
        });
        continue;
      }
      courseId = matched;
    }

    const { data: q, error: insErr } = await supabase
      .from('questions')
      .insert({
        institution_id: input.institutionId,
        course_id: courseId,
        question_type: row.question_type,
        title: row.title,
        prompt: row.prompt,
        topic: row.topic,
        category: row.category,
        difficulty: row.difficulty,
        marks: row.marks,
        negative_marks: row.negative_marks,
        expected_word_count: row.expected_word_count,
        tags: row.tags,
        status: row.status,
        created_by: userId,
        updated_by: userId,
      })
      .select('*')
      .single();

    if (insErr || !q) {
      errors.push({
        row: row.row,
        title: row.title,
        message: insErr?.message ?? 'Failed to insert question row',
      });
      continue;
    }

    if (row.options.length > 0) {
      const { error: optErr } = await supabase.from('question_options').insert(
        row.options.map((o) => ({
          institution_id: input.institutionId,
          question_id: q.id,
          option_key: o.option_key,
          option_text: o.option_text,
          sort_order: o.sort_order,
        })),
      );
      if (optErr) {
        await supabase.from('questions').delete().eq('id', q.id).eq('institution_id', input.institutionId);
        errors.push({
          row: row.row,
          title: row.title,
          message: `Options insert failed: ${optErr.message}`,
        });
        continue;
      }
    }

    const { error: keyErr } = await supabase.from('question_answer_keys').insert({
      question_id: q.id,
      institution_id: input.institutionId,
      correct_option_keys: row.correct_option_keys,
      sample_answer: row.sample_answer,
      grading_rubric: row.grading_rubric,
      explanation: row.explanation,
      updated_by: userId,
    });
    if (keyErr) {
      await supabase.from('questions').delete().eq('id', q.id).eq('institution_id', input.institutionId);
      errors.push({
        row: row.row,
        title: row.title,
        message: `Answer key insert failed: ${keyErr.message}`,
      });
      continue;
    }

    importedCount++;
  }

  await supabase.from('csv_import_jobs').insert({
    institution_id: input.institutionId,
    uploaded_by: userId,
    entity_type: 'questions',
    file_name: input.fileName,
    total_rows: parsed.totalRows,
    imported_count: importedCount,
    error_count: errors.length,
    errors: errors as unknown as Json,
  });

  await logQuestionBankAudit(
    supabase,
    input.institutionId,
    userId,
    'questions.csv_imported',
    'csv_import_job',
    null,
    {
      file_name: input.fileName,
      total_rows: parsed.totalRows,
      imported_count: importedCount,
      error_count: errors.length,
    },
  );

  return {
    totalRows: parsed.totalRows,
    validRows: parsed.validRows.length,
    importedCount,
    errorCount: errors.length,
    errors,
  };
}

export async function listQuestionImportJobs(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
) {
  await verifyInstitutionAccess(supabase, userId, institutionId, [...EDUCATOR_ROLES]);
  const { data, error } = await supabase
    .from('csv_import_jobs')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('entity_type', 'questions')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ============================================================================
// REUSABLE QUESTION SETS (FOR FUTURE EXAM ASSEMBLY)
// ============================================================================

export async function listQuestionSets(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
): Promise<QuestionSetWithItems[]> {
  await verifyInstitutionAccess(supabase, userId, institutionId, [...EDUCATOR_ROLES]);

  const [setsRes, itemsRes, questionsRes, coursesRes] = await Promise.all([
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
    supabase
      .from('courses')
      .select('id, code, title')
      .eq('institution_id', institutionId),
  ]);

  if (setsRes.error) throw new Error(setsRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);
  if (coursesRes.error) throw new Error(coursesRes.error.message);

  const qMap = new Map((questionsRes.data ?? []).map((q) => [q.id, q]));
  const cMap = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));

  const itemsBySet = new Map<string, QuestionSetWithItems['items']>();
  for (const it of itemsRes.data ?? []) {
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
      question: q
        ? {
            ...q,
            marks: Number(q.marks),
          }
        : null,
    });
    itemsBySet.set(it.question_set_id, list);
  }

  return (setsRes.data ?? []).map((set) => {
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
}

export async function createQuestionSet(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    title: string;
    description?: string | null | undefined;
    courseId?: string | null | undefined;
    questionIds?: string[] | undefined;
  },
) {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const { data: setRow, error } = await supabase
    .from('question_sets')
    .insert({
      institution_id: input.institutionId,
      course_id: input.courseId ?? null,
      title: input.title.trim(),
      description: input.description ? input.description.trim() : null,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error || !setRow) throw new Error(error?.message ?? 'Failed to create question set');

  const uniqueIds = Array.from(new Set(input.questionIds ?? []));
  if (uniqueIds.length > 0) {
    const { error: itemErr } = await supabase.from('question_set_items').insert(
      uniqueIds.map((qId, idx) => ({
        institution_id: input.institutionId,
        question_set_id: setRow.id,
        question_id: qId,
        sort_order: idx,
        marks_override: null,
        added_by: userId,
      })),
    );
    if (itemErr) throw new Error(itemErr.message);
  }

  return setRow;
}

export async function addQuestionsToSet(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; questionSetId: string; questionIds: string[] },
) {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);

  const { data: existing, error: exErr } = await supabase
    .from('question_set_items')
    .select('question_id, sort_order')
    .eq('question_set_id', input.questionSetId)
    .eq('institution_id', input.institutionId);
  if (exErr) throw new Error(exErr.message);

  const existingIds = new Set((existing ?? []).map((e) => e.question_id));
  const nextOrderBase =
    (existing ?? []).reduce((max, e) => Math.max(max, e.sort_order), -1) + 1;

  const toAdd = Array.from(new Set(input.questionIds)).filter((id) => !existingIds.has(id));
  if (toAdd.length === 0) return { added: 0 };

  const { error: insErr } = await supabase.from('question_set_items').insert(
    toAdd.map((qId, idx) => ({
      institution_id: input.institutionId,
      question_set_id: input.questionSetId,
      question_id: qId,
      sort_order: nextOrderBase + idx,
      marks_override: null,
      added_by: userId,
    })),
  );
  if (insErr) throw new Error(insErr.message);
  return { added: toAdd.length };
}

export async function removeQuestionFromSet(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; itemId: string },
) {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const { error } = await supabase
    .from('question_set_items')
    .delete()
    .eq('id', input.itemId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function deleteQuestionSet(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; questionSetId: string },
) {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [...EDUCATOR_ROLES]);
  const { error } = await supabase
    .from('question_sets')
    .delete()
    .eq('id', input.questionSetId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}
