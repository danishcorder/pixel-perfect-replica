import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import {
  addExamSection,
  addQuestionsToExamSection,
  cloneExam,
  closeExam,
  createDraftRevision,
  createExamDraft,
  deleteExamDraft,
  deleteExamSection,
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
  updateExamSection,
} from './exams.server';

const instSchema = z.object({ institutionId: z.string().uuid() });
const examIdSchema = z.object({ institutionId: z.string().uuid(), examId: z.string().uuid() });

const saveExamConfigSchema = z.object({
  institutionId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(4000).nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  academicSessionId: z.string().uuid().nullable().optional(),
  academicTermId: z.string().uuid().nullable().optional(),
  instructions: z.string().trim().max(15000).nullable().optional(),
  startsAt: z.string().trim().nullable().optional(),
  endsAt: z.string().trim().nullable().optional(),
  durationMinutes: z.number().int().min(1).max(1440),
  passingMarks: z.number().min(0).max(100000).nullable().optional(),
  passingPercentage: z.number().min(0).max(100).nullable().optional(),
  negativeMarkingEnabled: z.boolean(),
  defaultNegativeMarks: z.number().min(0).max(1000),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
});

export const getExamBuilderCatalogFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => instSchema.parse(data))
  .handler(async ({ context, data }) =>
    loadExamBuilderCatalog(context.supabase, context.userId, data.institutionId),
  );

export const listExamsFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        search: z.string().optional(),
        status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
        courseId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    listExams(context.supabase, context.userId, data.institutionId, {
      ...(data.search !== undefined ? { search: data.search } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.courseId !== undefined ? { courseId: data.courseId } : {}),
    }),
  );

export const getExamDetailFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => examIdSchema.parse(data))
  .handler(async ({ context, data }) =>
    getExamDetail(context.supabase, context.userId, data.institutionId, data.examId),
  );

export const createExamDraftFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveExamConfigSchema.parse(data))
  .handler(async ({ context, data }) => createExamDraft(context.supabase, context.userId, data));

export const updateExamDraftFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    saveExamConfigSchema.extend({ examId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => updateExamDraft(context.supabase, context.userId, data));

export const addExamSectionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        title: z.string().trim().min(2).max(150),
        description: z.string().trim().max(1500).nullable().optional(),
        sectionType: z.enum(['mcq', 'descriptive', 'mixed']),
        shuffleQuestions: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => addExamSection(context.supabase, context.userId, data));

export const updateExamSectionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        sectionId: z.string().uuid(),
        title: z.string().trim().min(2).max(150),
        description: z.string().trim().max(1500).nullable().optional(),
        sectionType: z.enum(['mcq', 'descriptive', 'mixed']),
        shuffleQuestions: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => updateExamSection(context.supabase, context.userId, data));

export const deleteExamSectionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        sectionId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => deleteExamSection(context.supabase, context.userId, data));

export const addQuestionsToExamSectionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        sectionId: z.string().uuid(),
        questionIds: z.array(z.string().uuid()).min(1).max(300),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    addQuestionsToExamSection(context.supabase, context.userId, data),
  );

export const importQuestionSetToExamSectionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        sectionId: z.string().uuid(),
        questionSetId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    importQuestionSetToExamSection(context.supabase, context.userId, data),
  );

export const updateExamQuestionConfigFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        sectionQuestionId: z.string().uuid(),
        marks: z.number().positive().max(1000),
        negativeMarks: z.number().min(0).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    updateExamQuestionConfig(context.supabase, context.userId, data),
  );

export const removeExamQuestionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        sectionQuestionId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => removeExamQuestion(context.supabase, context.userId, data));

export const setExamAssignmentsFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        classIds: z.array(z.string().uuid()).max(200),
        sectionIds: z.array(z.string().uuid()).max(300),
        studentIds: z.array(z.string().uuid()).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => setExamAssignments(context.supabase, context.userId, data));

export const previewExamFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        examId: z.string().uuid(),
        mode: z.enum(['educator', 'student']).default('educator'),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    previewExam(context.supabase, context.userId, data.institutionId, data.examId, data.mode),
  );

export const publishExamFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => examIdSchema.parse(data))
  .handler(async ({ context, data }) => publishExam(context.supabase, context.userId, data));

export const createDraftRevisionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => examIdSchema.parse(data))
  .handler(async ({ context, data }) =>
    createDraftRevision(context.supabase, context.userId, data),
  );

export const closeExamFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => examIdSchema.parse(data))
  .handler(async ({ context, data }) => closeExam(context.supabase, context.userId, data));

export const cloneExamFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => examIdSchema.parse(data))
  .handler(async ({ context, data }) => cloneExam(context.supabase, context.userId, data));

export const deleteExamDraftFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => examIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    await deleteExamDraft(context.supabase, context.userId, data);
    return { ok: true };
  });
