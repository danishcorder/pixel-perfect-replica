import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import {
  addQuestionsToSet,
  attachQuestionFile,
  createQuestion,
  createQuestionSet,
  deleteQuestion,
  deleteQuestionAttachment,
  deleteQuestionSet,
  duplicateQuestion,
  getQuestionById,
  importQuestionsFromCsv,
  listQuestionImportJobs,
  listQuestionsPaginated,
  listQuestionSets,
  loadQuestionBankCatalog,
  removeQuestionFromSet,
  setQuestionStatus,
  updateQuestion,
} from './question-bank.server';

const instSchema = z.object({ institutionId: z.string().uuid() });

const saveQuestionSchema = z.object({
  institutionId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  questionType: z.enum(['mcq_single', 'mcq_multi', 'descriptive', 'long_answer']),
  title: z.string().trim().min(2).max(180),
  prompt: z.string().trim().min(3).max(15000),
  topic: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  marks: z.number().positive().max(1000),
  negativeMarks: z.number().min(0).max(1000),
  expectedWordCount: z.number().int().min(10).max(20000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  options: z
    .array(
      z.object({
        optionKey: z.string().trim().min(1).max(8),
        optionText: z.string().trim().min(1).max(2000),
        sortOrder: z.number().int().min(0),
      }),
    )
    .max(8)
    .optional(),
  correctOptionKeys: z.array(z.string().trim().min(1).max(8)).max(8).optional(),
  sampleAnswer: z.string().trim().max(15000).nullable().optional(),
  gradingRubric: z.string().trim().max(15000).nullable().optional(),
  explanation: z.string().trim().max(10000).nullable().optional(),
});

export const getQuestionBankCatalogFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => instSchema.parse(data))
  .handler(async ({ context, data }) =>
    loadQuestionBankCatalog(context.supabase, context.userId, data.institutionId),
  );

export const listQuestionsFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        search: z.string().optional(),
        courseId: z.string().uuid().optional(),
        topic: z.string().optional(),
        category: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        questionType: z.enum(['mcq_single', 'mcq_multi', 'descriptive', 'long_answer']).optional(),
        status: z.enum(['draft', 'active', 'archived']).optional(),
        includeArchived: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    listQuestionsPaginated(context.supabase, context.userId, data),
  );

export const getQuestionFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), questionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) =>
    getQuestionById(context.supabase, context.userId, data.institutionId, data.questionId),
  );

export const createQuestionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveQuestionSchema.parse(data))
  .handler(async ({ context, data }) => createQuestion(context.supabase, context.userId, data));

export const updateQuestionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    saveQuestionSchema.extend({ questionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => updateQuestion(context.supabase, context.userId, data));

export const duplicateQuestionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), questionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => duplicateQuestion(context.supabase, context.userId, data));

export const setQuestionStatusFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        questionId: z.string().uuid(),
        status: z.enum(['draft', 'active', 'archived']),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => setQuestionStatus(context.supabase, context.userId, data));

export const deleteQuestionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), questionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteQuestion(context.supabase, context.userId, data);
    return { ok: true };
  });

export const attachQuestionFileFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        questionId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(255),
        storagePath: z.string().trim().min(3).max(500),
        mimeType: z.string().trim().min(3).max(150),
        fileSizeBytes: z.number().int().positive().max(10_485_760),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    attachQuestionFile(context.supabase, context.userId, data),
  );

export const deleteQuestionAttachmentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), attachmentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteQuestionAttachment(context.supabase, context.userId, data);
    return { ok: true };
  });

export const importQuestionsCsvFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200),
        csvText: z.string().min(1).max(2_000_000),
        defaultCourseId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    importQuestionsFromCsv(context.supabase, context.userId, data),
  );

export const listQuestionImportJobsFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => instSchema.parse(data))
  .handler(async ({ context, data }) =>
    listQuestionImportJobs(context.supabase, context.userId, data.institutionId),
  );

export const listQuestionSetsFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => instSchema.parse(data))
  .handler(async ({ context, data }) =>
    listQuestionSets(context.supabase, context.userId, data.institutionId),
  );

export const createQuestionSetFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        title: z.string().trim().min(2).max(150),
        description: z.string().trim().max(1000).nullable().optional(),
        courseId: z.string().uuid().nullable().optional(),
        questionIds: z.array(z.string().uuid()).max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => createQuestionSet(context.supabase, context.userId, data));

export const addQuestionsToSetFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        questionSetId: z.string().uuid(),
        questionIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => addQuestionsToSet(context.supabase, context.userId, data));

export const removeQuestionFromSetFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), itemId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await removeQuestionFromSet(context.supabase, context.userId, data);
    return { ok: true };
  });

export const deleteQuestionSetFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), questionSetId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteQuestionSet(context.supabase, context.userId, data);
    return { ok: true };
  });
