import { describe, expect, it } from 'vitest';
import {
  addQuestionsToSet,
  attachQuestionFile,
  buildStudentSafeQuestionView,
  createQuestion,
  createQuestionSet,
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
} from '@/lib/question-bank.server';
import { parseAndValidateQuestionCsv, SAMPLE_QUESTION_CSV } from '@/lib/question-csv';
import { AuthorizationError, type AuthedSupabase } from '@/lib/workspace.server';
import type {
  CourseStatus,
  InstitutionRole,
  InstitutionStatus,
  QuestionAttachmentKind,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '@/integrations/supabase/types';

type QuestionBankMockDb = {
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
  question_attachments: Array<{
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
  }>;
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
  csv_import_jobs: Array<Record<string, unknown>>;
  institution_audit_logs: Array<Record<string, unknown>>;
};

function makeSeedDb(): QuestionBankMockDb {
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
      {
        id: 'course-oak-math201',
        institution_id: 'inst-oak',
        department_id: null,
        program_id: null,
        class_id: null,
        code: 'MATH201',
        title: 'Linear Algebra',
        credits: 3,
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
    csv_import_jobs: [],
    institution_audit_logs: [],
  };
}

function createRlsQuestionClient(db: QuestionBankMockDb, actorId: string): AuthedSupabase {
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
      case 'courses':
        return db.courses.filter((c) => isSuper() || isMember(c.institution_id));
      case 'questions':
      case 'question_options':
      case 'question_answer_keys':
      case 'question_attachments':
      case 'question_sets':
      case 'question_set_items':
      case 'csv_import_jobs':
        // Strict educator RLS: students and invigilators get ZERO rows even if querying directly
        return (db[table] as Record<string, unknown>[]).filter(
          (r) => isSuper() || isEducator(String(r['institution_id'])),
        );
      case 'institution_audit_logs':
        return db.institution_audit_logs.filter(
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
        const matched = applyFilters(selectRows(table));
        for (const r of matched) {
          const instId = String(r['institution_id'] ?? '');
          if (!isSuper() && !isEducator(instId)) {
            return { data: null, error: { message: 'update violates row-level security policy' } };
          }
          Object.assign(r, updatePayload, { updated_at: '2026-11-15T02:00:00.000Z' });
        }
        return { data: matched, error: null };
      }
      if (mode === 'delete') {
        const matched = applyFilters(selectRows(table));
        const ids = new Set(matched.map((r) => r['id'] ?? r['question_id']));
        const arr = (db as Record<string, Record<string, unknown>[] | undefined>)[table];
        if (Array.isArray(arr)) {
          (db as Record<string, unknown[]>)[table] = arr.filter(
            (r) => !ids.has(r['id'] ?? r['question_id']),
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
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.local/signed/${path}` },
          error: null,
        }),
        remove: async () => ({ error: null }),
      }),
    },
  } as unknown as AuthedSupabase;
}

describe('Phase 4 Question Bank workflows, privacy & multi-tenant isolation', () => {
  it('supports creating MCQ (single & multi), descriptive, and long-answer questions with attachments, edit, duplicate, archive, and retrieve', async () => {
    const db = makeSeedDb();
    const teacher = createRlsQuestionClient(db, 'user-oak-teacher');

    // 1. Create Single-Choice MCQ
    const mcq1 = await createQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-cs101',
      questionType: 'mcq_single',
      title: 'Binary Search Bound',
      prompt: 'What is the worst-case time complexity of binary search?',
      topic: 'Searching',
      category: 'Conceptual',
      difficulty: 'easy',
      marks: 2,
      negativeMarks: 0.5,
      tags: ['complexity', 'midterm'],
      status: 'active',
      options: [
        { optionKey: 'A', optionText: 'O(1)', sortOrder: 0 },
        { optionKey: 'B', optionText: 'O(log n)', sortOrder: 1 },
        { optionKey: 'C', optionText: 'O(n)', sortOrder: 2 },
        { optionKey: 'D', optionText: 'O(n^2)', sortOrder: 3 },
      ],
      correctOptionKeys: ['B'],
      explanation: 'Each step halves the remaining interval.',
    });

    expect(mcq1.options).toHaveLength(4);
    expect(mcq1.answerKey.correct_option_keys).toEqual(['B']);
    expect(mcq1.marks).toBe(2);
    expect(mcq1.negative_marks).toBe(0.5);

    // Invalid mcq_single with 2 correct answers is rejected
    await expect(
      createQuestion(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        questionType: 'mcq_single',
        title: 'Invalid Single Choice',
        prompt: 'Pick one only',
        topic: 'Testing',
        category: 'Conceptual',
        difficulty: 'easy',
        marks: 1,
        negativeMarks: 0,
        options: [
          { optionKey: 'A', optionText: 'Yes', sortOrder: 0 },
          { optionKey: 'B', optionText: 'No', sortOrder: 1 },
        ],
        correctOptionKeys: ['A', 'B'],
      }),
    ).rejects.toThrow(AuthorizationError);

    // 2. Create Multi-Select MCQ & Long Answer with rubric
    const mcqMulti = await createQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-cs101',
      questionType: 'mcq_multi',
      title: 'ACID Properties',
      prompt: 'Select all properties guaranteed by ACID transactions.',
      topic: 'Databases',
      category: 'Analytical',
      difficulty: 'medium',
      marks: 4,
      negativeMarks: 1,
      options: [
        { optionKey: 'A', optionText: 'Atomicity', sortOrder: 0 },
        { optionKey: 'B', optionText: 'Eventual Consistency', sortOrder: 1 },
        { optionKey: 'C', optionText: 'Isolation', sortOrder: 2 },
      ],
      correctOptionKeys: ['A', 'C'],
    });
    expect(mcqMulti.answerKey.correct_option_keys).toEqual(['A', 'C']);

    const essay = await createQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-math201',
      questionType: 'long_answer',
      title: 'Eigenvalue Decomposition Proof',
      prompt: 'Prove that symmetric real matrices admit orthogonal eigenvectors.',
      topic: 'Eigenvalues',
      category: 'Analytical',
      difficulty: 'hard',
      marks: 10,
      negativeMarks: 0,
      expectedWordCount: 350,
      sampleAnswer: 'Take distinct eigenvalues lambda_1 != lambda_2...',
      gradingRubric: '4 pts dot-product symmetry step, 6 pts spectral induction',
      explanation: 'Key insight: <Ax, y> = <x, Ay>.',
    });
    expect(essay.expected_word_count).toBe(350);
    expect(essay.answerKey.grading_rubric).toContain('spectral induction');

    // 3. Attach image & document files + reject disallowed MIME or cross-tenant path
    const imgAtt = await attachQuestionFile(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      questionId: mcq1.id,
      fileName: 'binary-tree.png',
      storagePath: `inst-oak/${mcq1.id}/1-binary-tree.png`,
      mimeType: 'image/png',
      fileSizeBytes: 24500,
    });
    expect(imgAtt.attachment_kind).toBe('image');
    expect(imgAtt.signedUrl).toContain('binary-tree.png');

    await expect(
      attachQuestionFile(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        questionId: mcq1.id,
        fileName: 'malware.exe',
        storagePath: `inst-oak/${mcq1.id}/malware.exe`,
        mimeType: 'application/x-msdownload',
        fileSizeBytes: 1024,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      attachQuestionFile(teacher, 'user-oak-teacher', {
        institutionId: 'inst-oak',
        questionId: mcq1.id,
        fileName: 'diagram.png',
        storagePath: `inst-crest/${mcq1.id}/diagram.png`,
        mimeType: 'image/png',
        fileSizeBytes: 1024,
      }),
    ).rejects.toThrow(AuthorizationError);

    // 4. Edit question
    const edited = await updateQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      questionId: mcq1.id,
      courseId: 'course-oak-cs101',
      questionType: 'mcq_single',
      title: 'Binary Search Complexity (Updated)',
      prompt: 'Worst-case comparison count in binary search over n sorted elements?',
      topic: 'Searching',
      category: 'Conceptual',
      difficulty: 'medium',
      marks: 3,
      negativeMarks: 0.5,
      status: 'active',
      options: [
        { optionKey: 'A', optionText: 'O(1)', sortOrder: 0 },
        { optionKey: 'B', optionText: 'O(n)', sortOrder: 1 },
        { optionKey: 'C', optionText: 'O(log n)', sortOrder: 2 },
      ],
      correctOptionKeys: ['C'],
      explanation: 'Updated explanation',
    });
    expect(edited.title).toBe('Binary Search Complexity (Updated)');
    expect(edited.marks).toBe(3);
    expect(edited.answerKey.correct_option_keys).toEqual(['C']);
    expect(edited.attachments).toHaveLength(1);

    await deleteQuestionAttachment(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      attachmentId: imgAtt.id,
    });
    const afterAttDelete = await getQuestionById(teacher, 'user-oak-teacher', 'inst-oak', mcq1.id);
    expect(afterAttDelete.attachments).toHaveLength(0);

    // 5. Duplicate question (creates Draft linked via source_question_id)
    const cloned = await duplicateQuestion(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      questionId: mcq1.id,
    });
    expect(cloned.title).toBe('Copy of Binary Search Complexity (Updated)');
    expect(cloned.status).toBe('draft');
    expect(cloned.source_question_id).toBe(mcq1.id);
    expect(cloned.answerKey.correct_option_keys).toEqual(['C']);

    // 6. Archive & restore workflow + search/filtering/pagination
    await setQuestionStatus(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      questionId: cloned.id,
      status: 'archived',
    });

    const activeList = await listQuestionsPaginated(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      includeArchived: false,
      page: 1,
      pageSize: 10,
    });
    expect(activeList.total).toBe(3); // mcq1, mcqMulti, essay (archived clone excluded)

    const archivedOnly = await listQuestionsPaginated(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      status: 'archived',
      page: 1,
      pageSize: 10,
    });
    expect(archivedOnly.total).toBe(1);
    expect(archivedOnly.items[0]?.id).toBe(cloned.id);

    const searchFiltered = await listQuestionsPaginated(teacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-math201',
      difficulty: 'hard',
      search: 'Eigenvalue',
      page: 1,
      pageSize: 10,
    });
    expect(searchFiltered.total).toBe(1);
    expect(searchFiltered.items[0]?.id).toBe(essay.id);

    const catalog = await loadQuestionBankCatalog(teacher, 'user-oak-teacher', 'inst-oak');
    expect(catalog.stats.total).toBe(4);
    expect(catalog.stats.archived).toBe(1);
  });

  it('imports questions from validated CSV template with error reporting and manages reusable exam sets', async () => {
    const db = makeSeedDb();
    const admin = createRlsQuestionClient(db, 'user-oak-admin');

    const parsedSample = parseAndValidateQuestionCsv(SAMPLE_QUESTION_CSV);
    expect(parsedSample.totalRows).toBe(4);
    expect(parsedSample.validRows).toHaveLength(4);
    expect(parsedSample.errors).toHaveLength(0);

    const mixedCsv = [
      'question_type,title,prompt,subject_code,topic,category,difficulty,marks,negative_marks,options,correct_options,explanation,grading_rubric,expected_word_count,tags,status',
      'mcq_single,Queue Ordering,Which ordering principle does a standard FIFO queue follow?,CS101,Queues,Conceptual,easy,2,0,LIFO|FIFO|Priority|Random,B,FIFO means first-in first-out.,,,queues,active',
      'descriptive,Recursion Base Case,Explain why every recursive function needs a base case.,CS101,Recursion,Conceptual,easy,3,0,,,,Prevents infinite stack growth.,100,recursion,active',
      'mcq_single,Missing Answer Key,What is 2+2?,CS101,Math,Conceptual,easy,1,0,3|4|5,,Missing key should error,,,,active',
      'mcq_single,Multi Keys On Single,Pick two,CS101,Logic,Conceptual,easy,2,0,A1|B1|C1,A;B,Should fail single-choice validation,,,,active',
      'descriptive,Unknown Subject Row,Describe Dijkstra algorithm.,NOPE999,Graphs,Analytical,hard,5,0,,,,Rubric here,200,,active',
    ].join('\n');

    const importSummary = await importQuestionsFromCsv(admin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      fileName: 'cs101-import.csv',
      csvText: mixedCsv,
    });

    expect(importSummary.totalRows).toBe(5);
    expect(importSummary.importedCount).toBe(2);
    expect(importSummary.errorCount).toBe(3);
    expect(importSummary.errors.map((e) => e.row)).toEqual([4, 5, 6]);

    const jobs = await listQuestionImportJobs(admin, 'user-oak-admin', 'inst-oak');
    expect(jobs).toHaveLength(1);

    const listRes = await listQuestionsPaginated(admin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      page: 1,
      pageSize: 10,
    });
    expect(listRes.total).toBe(2);
    const qIds = listRes.items.map((q) => q.id);

    // Save reusable exam question set
    const setRow = await createQuestionSet(admin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      title: 'CS101 Quiz 1 Pool',
      description: 'Reusable selection for Quiz 1',
      courseId: 'course-oak-cs101',
      questionIds: qIds[0] ? [qIds[0]] : [],
    });

    if (qIds[1]) {
      await addQuestionsToSet(admin, 'user-oak-admin', {
        institutionId: 'inst-oak',
        questionSetId: setRow.id,
        questionIds: [qIds[1]],
      });
    }

    const sets = await listQuestionSets(admin, 'user-oak-admin', 'inst-oak');
    expect(sets).toHaveLength(1);
    expect(sets[0]?.items).toHaveLength(2);
    expect(sets[0]?.totalMarks).toBe(5);

    const firstItemId = sets[0]?.items[0]?.id;
    if (firstItemId) {
      await removeQuestionFromSet(admin, 'user-oak-admin', {
        institutionId: 'inst-oak',
        itemId: firstItemId,
      });
    }
    const setsAfterRemove = await listQuestionSets(admin, 'user-oak-admin', 'inst-oak');
    expect(setsAfterRemove[0]?.items).toHaveLength(1);

    await deleteQuestionSet(admin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      questionSetId: setRow.id,
    });
    const setsAfterDelete = await listQuestionSets(admin, 'user-oak-admin', 'inst-oak');
    expect(setsAfterDelete).toHaveLength(0);
  });

  it('keeps correct answers, explanations, and rubrics strictly private from students and isolates institutions', async () => {
    const db = makeSeedDb();
    const oakTeacher = createRlsQuestionClient(db, 'user-oak-teacher');
    const oakStudent = createRlsQuestionClient(db, 'user-oak-student');
    const oakInvig = createRlsQuestionClient(db, 'user-oak-invig');
    const crestAdmin = createRlsQuestionClient(db, 'user-crest-admin');

    const secretQ = await createQuestion(oakTeacher, 'user-oak-teacher', {
      institutionId: 'inst-oak',
      courseId: 'course-oak-cs101',
      questionType: 'mcq_single',
      title: 'Private Key Question',
      prompt: 'Which traversal yields sorted order in a BST?',
      topic: 'Trees',
      category: 'Conceptual',
      difficulty: 'easy',
      marks: 2,
      negativeMarks: 0.5,
      options: [
        { optionKey: 'A', optionText: 'Pre-order', sortOrder: 0 },
        { optionKey: 'B', optionText: 'In-order', sortOrder: 1 },
        { optionKey: 'C', optionText: 'Post-order', sortOrder: 2 },
      ],
      correctOptionKeys: ['B'],
      sampleAnswer: 'In-order traversal visits left subtree, node, right subtree.',
      gradingRubric: 'Full credit for B only.',
      explanation: 'BST invariant guarantees left < root < right.',
    });

    // 1. Direct Supabase RLS reads by Student or Invigilator on question_answer_keys / questions return ZERO rows
    const studentDirectKeyRead = await oakStudent
      .from('question_answer_keys')
      .select('*')
      .eq('question_id', secretQ.id);
    expect(studentDirectKeyRead.data).toEqual([]);

    const studentDirectQRead = await oakStudent
      .from('questions')
      .select('*')
      .eq('institution_id', 'inst-oak');
    expect(studentDirectQRead.data).toEqual([]);

    // 2. Question Bank endpoints throw 403 for students and invigilators
    await expect(
      listQuestionsPaginated(oakStudent, 'user-oak-student', {
        institutionId: 'inst-oak',
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      getQuestionById(oakStudent, 'user-oak-student', 'inst-oak', secretQ.id),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      listQuestionsPaginated(oakInvig, 'user-oak-invig', {
        institutionId: 'inst-oak',
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(AuthorizationError);

    // 3. Student-safe projection strips all answer keys, rubrics, sample answers, and explanations
    const studentSafe = buildStudentSafeQuestionView(secretQ);
    expect(studentSafe.options).toHaveLength(3);
    expect('answerKey' in studentSafe).toBe(false);
    expect('correct_option_keys' in studentSafe).toBe(false);
    expect('explanation' in studentSafe).toBe(false);
    expect('grading_rubric' in studentSafe).toBe(false);
    expect('sample_answer' in studentSafe).toBe(false);

    // 4. Cross-tenant isolation: Crestview Admin cannot read, edit, duplicate, archive, or import into Oakridge
    await expect(
      listQuestionsPaginated(crestAdmin, 'user-crest-admin', {
        institutionId: 'inst-oak',
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      duplicateQuestion(crestAdmin, 'user-crest-admin', {
        institutionId: 'inst-oak',
        questionId: secretQ.id,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      setQuestionStatus(crestAdmin, 'user-crest-admin', {
        institutionId: 'inst-oak',
        questionId: secretQ.id,
        status: 'archived',
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      importQuestionsFromCsv(crestAdmin, 'user-crest-admin', {
        institutionId: 'inst-oak',
        fileName: 'hijack.csv',
        csvText: SAMPLE_QUESTION_CSV,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
