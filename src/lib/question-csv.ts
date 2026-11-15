import { z } from 'zod';
import { parseCsvMatrix } from './csv';
import type {
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '@/integrations/supabase/types';

export type QuestionCsvImportError = {
  row: number;
  field?: string;
  title?: string;
  message: string;
};

export type ValidatedQuestionCsvRow = {
  row: number;
  question_type: QuestionType;
  title: string;
  prompt: string;
  subject_code: string | null;
  topic: string;
  category: string;
  difficulty: QuestionDifficulty;
  marks: number;
  negative_marks: number;
  expected_word_count: number | null;
  options: Array<{ option_key: string; option_text: string; sort_order: number }>;
  correct_option_keys: string[];
  sample_answer: string | null;
  grading_rubric: string | null;
  explanation: string | null;
  tags: string[];
  status: QuestionStatus;
};

export type QuestionCsvParseResult = {
  headers: string[];
  totalRows: number;
  validRows: ValidatedQuestionCsvRow[];
  errors: QuestionCsvImportError[];
};

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const HEADER_ALIASES: Record<string, string> = {
  question_type: 'question_type',
  type: 'question_type',
  qtype: 'question_type',
  title: 'title',
  question_title: 'title',
  prompt: 'prompt',
  question: 'prompt',
  question_text: 'prompt',
  stem: 'prompt',
  subject_code: 'subject_code',
  course_code: 'subject_code',
  subject: 'subject_code',
  course: 'subject_code',
  topic: 'topic',
  category: 'category',
  difficulty: 'difficulty',
  level: 'difficulty',
  marks: 'marks',
  points: 'marks',
  score: 'marks',
  negative_marks: 'negative_marks',
  penalty: 'negative_marks',
  expected_word_count: 'expected_word_count',
  word_limit: 'expected_word_count',
  options: 'options',
  choices: 'options',
  option_a: 'option_a',
  option_b: 'option_b',
  option_c: 'option_c',
  option_d: 'option_d',
  option_e: 'option_e',
  option_f: 'option_f',
  correct_options: 'correct_options',
  correct_answers: 'correct_options',
  answer_key: 'correct_options',
  correct: 'correct_options',
  sample_answer: 'sample_answer',
  model_answer: 'sample_answer',
  grading_rubric: 'grading_rubric',
  rubric: 'grading_rubric',
  explanation: 'explanation',
  tags: 'tags',
  status: 'status',
};

const baseRowSchema = z.object({
  question_type: z.enum(['mcq_single', 'mcq_multi', 'descriptive', 'long_answer']),
  title: z.string().trim().min(2, 'title must be at least 2 characters').max(180),
  prompt: z.string().trim().min(3, 'prompt must be at least 3 characters'),
  subject_code: z.string().trim().max(40).nullable(),
  topic: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  marks: z.number().positive('marks must be greater than 0').max(1000),
  negative_marks: z.number().min(0, 'negative_marks cannot be negative').max(1000),
  expected_word_count: z.number().int().min(10).max(20000).nullable(),
  sample_answer: z.string().trim().nullable(),
  grading_rubric: z.string().trim().nullable(),
  explanation: z.string().trim().nullable(),
  tags: z.array(z.string().trim().min(1)).max(15),
  status: z.enum(['draft', 'active', 'archived']),
});

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeQuestionType(raw: string): string {
  const val = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (val === 'mcq' || val === 'single_choice' || val === 'single') return 'mcq_single';
  if (val === 'multi' || val === 'multiple_choice' || val === 'multi_select') return 'mcq_multi';
  if (val === 'short_answer' || val === 'short') return 'descriptive';
  if (val === 'essay' || val === 'long') return 'long_answer';
  return val || 'mcq_single';
}

export function parseAndValidateQuestionCsv(csvText: string): QuestionCsvParseResult {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length === 0) {
    return {
      headers: [],
      totalRows: 0,
      validRows: [],
      errors: [{ row: 1, message: 'CSV file is empty' }],
    };
  }

  const rawHeaders = matrix[0] ?? [];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  const colToField = new Map<number, string>();

  normalizedHeaders.forEach((h, idx) => {
    const mapped = HEADER_ALIASES[h];
    if (mapped && !Array.from(colToField.values()).includes(mapped)) {
      colToField.set(idx, mapped);
    }
  });

  const mappedFields = new Set(colToField.values());
  const headerErrors: QuestionCsvImportError[] = [];
  if (!mappedFields.has('title')) {
    headerErrors.push({
      row: 1,
      field: 'title',
      message: 'Missing required column: title',
    });
  }
  if (!mappedFields.has('prompt')) {
    headerErrors.push({
      row: 1,
      field: 'prompt',
      message: 'Missing required column: prompt (or question)',
    });
  }

  if (headerErrors.length > 0) {
    return {
      headers: rawHeaders,
      totalRows: Math.max(0, matrix.length - 1),
      validRows: [],
      errors: headerErrors,
    };
  }

  const validRows: ValidatedQuestionCsvRow[] = [];
  const errors: QuestionCsvImportError[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const rowNumber = i + 1;
    const cells = matrix[i] ?? [];
    const raw: Record<string, string> = {};
    colToField.forEach((fieldKey, colIdx) => {
      raw[fieldKey] = (cells[colIdx] ?? '').trim();
    });

    const marksNum = raw['marks'] ? Number(raw['marks']) : 1;
    const negNum = raw['negative_marks'] ? Number(raw['negative_marks']) : 0;
    const wordNum = raw['expected_word_count'] ? Number(raw['expected_word_count']) : null;

    if (!Number.isFinite(marksNum)) {
      errors.push({
        row: rowNumber,
        field: 'marks',
        ...(raw['title'] ? { title: raw['title'] } : {}),
        message: `Invalid marks value "${raw['marks']}"`,
      });
      continue;
    }
    if (!Number.isFinite(negNum)) {
      errors.push({
        row: rowNumber,
        field: 'negative_marks',
        ...(raw['title'] ? { title: raw['title'] } : {}),
        message: `Invalid negative_marks value "${raw['negative_marks']}"`,
      });
      continue;
    }
    if (wordNum !== null && !Number.isFinite(wordNum)) {
      errors.push({
        row: rowNumber,
        field: 'expected_word_count',
        ...(raw['title'] ? { title: raw['title'] } : {}),
        message: `Invalid expected_word_count "${raw['expected_word_count']}"`,
      });
      continue;
    }

    const qType = normalizeQuestionType(raw['question_type'] ?? '');
    const parsedBase = baseRowSchema.safeParse({
      question_type: qType,
      title: raw['title'] ?? '',
      prompt: raw['prompt'] ?? '',
      subject_code: raw['subject_code'] ? raw['subject_code'].toUpperCase() : null,
      topic: raw['topic'] || 'General',
      category: raw['category'] || 'Conceptual',
      difficulty: (raw['difficulty'] || 'medium').toLowerCase(),
      marks: marksNum,
      negative_marks: negNum,
      expected_word_count: wordNum,
      sample_answer: raw['sample_answer'] || null,
      grading_rubric: raw['grading_rubric'] || null,
      explanation: raw['explanation'] || null,
      tags: raw['tags']
        ? raw['tags']
            .split(/[;|]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      status: (raw['status'] || 'active').toLowerCase(),
    });

    if (!parsedBase.success) {
      for (const issue of parsedBase.error.issues) {
        const fieldName = issue.path[0] ? String(issue.path[0]) : undefined;
        errors.push({
          row: rowNumber,
          ...(fieldName ? { field: fieldName } : {}),
          ...(raw['title'] ? { title: raw['title'] } : {}),
          message: issue.message,
        });
      }
      continue;
    }

    const isMcq =
      parsedBase.data.question_type === 'mcq_single' ||
      parsedBase.data.question_type === 'mcq_multi';

    let options: Array<{ option_key: string; option_text: string; sort_order: number }> = [];
    let correctKeys: string[] = [];

    if (isMcq) {
      const pipeOptions = raw['options']
        ? raw['options']
            .split('|')
            .map((o) => o.trim())
            .filter(Boolean)
        : [];
      const colOptions = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f']
        .map((k) => raw[k]?.trim() ?? '')
        .filter(Boolean);

      const optionTexts = pipeOptions.length > 0 ? pipeOptions : colOptions;
      if (optionTexts.length < 2) {
        errors.push({
          row: rowNumber,
          field: 'options',
          title: parsedBase.data.title,
          message: 'MCQ rows require at least 2 options (use pipe-separated `options` or `option_a`..`option_d`)',
        });
        continue;
      }
      if (optionTexts.length > OPTION_KEYS.length) {
        errors.push({
          row: rowNumber,
          field: 'options',
          title: parsedBase.data.title,
          message: `Maximum ${OPTION_KEYS.length} options supported per MCQ`,
        });
        continue;
      }

      options = optionTexts.map((text, idx) => ({
        option_key: OPTION_KEYS[idx]!,
        option_text: text,
        sort_order: idx,
      }));

      const rawCorrect = (raw['correct_options'] ?? '')
        .split(/[;|,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (rawCorrect.length === 0) {
        errors.push({
          row: rowNumber,
          field: 'correct_options',
          title: parsedBase.data.title,
          message: 'MCQ rows require `correct_options` (e.g. "B" or "A;C")',
        });
        continue;
      }

      let invalidKey: string | null = null;
      const resolvedKeys = new Set<string>();
      for (const token of rawCorrect) {
        const upper = token.toUpperCase();
        const byKey = options.find((o) => o.option_key === upper);
        if (byKey) {
          resolvedKeys.add(byKey.option_key);
          continue;
        }
        const numericIdx = Number(token);
        if (Number.isInteger(numericIdx) && numericIdx >= 1 && numericIdx <= options.length) {
          resolvedKeys.add(options[numericIdx - 1]!.option_key);
          continue;
        }
        const byText = options.find(
          (o) => o.option_text.toLowerCase() === token.toLowerCase(),
        );
        if (byText) {
          resolvedKeys.add(byText.option_key);
          continue;
        }
        invalidKey = token;
        break;
      }

      if (invalidKey) {
        errors.push({
          row: rowNumber,
          field: 'correct_options',
          title: parsedBase.data.title,
          message: `Correct option "${invalidKey}" does not match any provided option`,
        });
        continue;
      }

      correctKeys = Array.from(resolvedKeys);
      if (parsedBase.data.question_type === 'mcq_single' && correctKeys.length !== 1) {
        errors.push({
          row: rowNumber,
          field: 'correct_options',
          title: parsedBase.data.title,
          message: 'mcq_single questions must have exactly 1 correct option (use mcq_multi for multiple)',
        });
        continue;
      }
    }

    validRows.push({
      row: rowNumber,
      ...parsedBase.data,
      options,
      correct_option_keys: correctKeys,
    });
  }

  return {
    headers: rawHeaders,
    totalRows: Math.max(0, matrix.length - 1),
    validRows,
    errors,
  };
}

export const SAMPLE_QUESTION_CSV = [
  'question_type,title,prompt,subject_code,topic,category,difficulty,marks,negative_marks,options,correct_options,explanation,grading_rubric,expected_word_count,tags,status',
  'mcq_single,Binary Search Complexity,What is the worst-case time complexity of binary search on a sorted array of size n?,CS101,Searching & Sorting,Conceptual,easy,2,0.5,O(1)|O(log n)|O(n)|O(n log n),B,Each comparison halves the remaining search interval.,,,algorithms;complexity,active',
  'mcq_multi,ACID Properties in Databases,Which two guarantees are explicitly part of database ACID transactions?,CS101,Transactions,Analytical,medium,4,1,Atomicity|Eventual Consistency|Isolation|Horizontal Sharding,A;C,Atomicity ensures all-or-nothing execution and Isolation prevents uncommitted cross-transaction reads.,,,databases;acid,active',
  'descriptive,Explain Hash Collisions,Briefly explain why hash collisions occur in hash tables and compare chaining vs open addressing.,CS101,Hashing,Application,medium,5,0,,,,Pigeonhole principle (keys > buckets). Award 2 pts for collision definition and 3 pts for comparing linked buckets vs probing.,150,hashing;data-structures,active',
  'long_answer,Distributed Consensus Design,Design a fault-tolerant leader election protocol for a 5-node cluster and analyze split-brain mitigation.,CS101,Distributed Systems,Case Study,hard,10,0,,,,"Quorum requirement (floor(n/2)+1), term numbers and fencing tokens, heartbeat timeout trade-offs.",450,distributed;systems,draft',
].join('\n');
