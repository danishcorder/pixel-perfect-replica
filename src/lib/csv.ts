import { z } from 'zod';
import type { StudentRecordStatus } from '@/integrations/supabase/types';

export type CsvImportRowError = {
  row: number;
  field?: string;
  message: string;
  studentCode?: string;
};

export type ValidatedStudentCsvRow = {
  row: number;
  student_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: StudentRecordStatus;
  class_code: string | null;
  section_name: string | null;
  session_code: string | null;
};

export type StudentCsvParseResult = {
  headers: string[];
  totalRows: number;
  validRows: ValidatedStudentCsvRow[];
  errors: CsvImportRowError[];
};

const HEADER_ALIASES: Record<string, keyof ValidatedStudentCsvRow> = {
  student_code: 'student_code',
  studentcode: 'student_code',
  code: 'student_code',
  roll_no: 'student_code',
  roll_number: 'student_code',
  student_id: 'student_code',
  reg_no: 'student_code',
  registration_no: 'student_code',
  full_name: 'full_name',
  fullname: 'full_name',
  name: 'full_name',
  student_name: 'full_name',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  mobile: 'phone',
  phone_number: 'phone',
  status: 'status',
  class_code: 'class_code',
  class: 'class_code',
  grade: 'class_code',
  section_name: 'section_name',
  section: 'section_name',
  batch: 'section_name',
  session_code: 'session_code',
  session: 'session_code',
};

const rowSchema = z.object({
  student_code: z
    .string()
    .trim()
    .min(1, 'student_code is required')
    .max(50, 'student_code max 50 characters'),
  full_name: z
    .string()
    .trim()
    .min(2, 'full_name must be at least 2 characters')
    .max(120, 'full_name max 120 characters'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(255)
    .nullable(),
  phone: z.string().trim().max(30).nullable(),
  status: z.enum(['active', 'graduated', 'withdrawn', 'suspended']),
  class_code: z.string().trim().max(30).nullable(),
  section_name: z.string().trim().max(60).nullable(),
  session_code: z.string().trim().max(40).nullable(),
});

/**
 * RFC-4180-compatible CSV parser handling quotes, escaped double-quotes, CRLF, and BOM.
 */
export function parseCsvMatrix(raw: string): string[][] {
  const input = raw.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function parseAndValidateStudentCsv(csvText: string): StudentCsvParseResult {
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
  const colToField = new Map<number, keyof ValidatedStudentCsvRow>();

  normalizedHeaders.forEach((h, idx) => {
    const mapped = HEADER_ALIASES[h];
    if (mapped && !Array.from(colToField.values()).includes(mapped)) {
      colToField.set(idx, mapped);
    }
  });

  const mappedFields = new Set(colToField.values());
  const headerErrors: CsvImportRowError[] = [];
  if (!mappedFields.has('student_code')) {
    headerErrors.push({
      row: 1,
      field: 'student_code',
      message: 'Missing required column: student_code (or code / roll_no)',
    });
  }
  if (!mappedFields.has('full_name')) {
    headerErrors.push({
      row: 1,
      field: 'full_name',
      message: 'Missing required column: full_name (or name)',
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

  const validRows: ValidatedStudentCsvRow[] = [];
  const errors: CsvImportRowError[] = [];
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  for (let i = 1; i < matrix.length; i++) {
    const rowNumber = i + 1; // 1-indexed including header
    const cells = matrix[i] ?? [];
    const rawObj: Record<string, string> = {};

    colToField.forEach((fieldKey, colIdx) => {
      rawObj[fieldKey] = (cells[colIdx] ?? '').trim();
    });

    const emailVal = rawObj['email'] ? rawObj['email'].toLowerCase() : null;
    const statusVal = (rawObj['status'] || 'active').toLowerCase();

    const parsed = rowSchema.safeParse({
      student_code: rawObj['student_code'] ?? '',
      full_name: rawObj['full_name'] ?? '',
      email: emailVal,
      phone: rawObj['phone'] ? rawObj['phone'] : null,
      status: statusVal,
      class_code: rawObj['class_code'] ? rawObj['class_code'] : null,
      section_name: rawObj['section_name'] ? rawObj['section_name'] : null,
      session_code: rawObj['session_code'] ? rawObj['session_code'] : null,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] ? String(issue.path[0]) : undefined;
        errors.push({
          row: rowNumber,
          ...(fieldName ? { field: fieldName } : {}),
          message: issue.message,
          ...(rawObj['student_code'] ? { studentCode: rawObj['student_code'] } : {}),
        });
      }
      continue;
    }

    const codeKey = parsed.data.student_code.toLowerCase();
    if (seenCodes.has(codeKey)) {
      errors.push({
        row: rowNumber,
        field: 'student_code',
        studentCode: parsed.data.student_code,
        message: `Duplicate student_code "${parsed.data.student_code}" in CSV`,
      });
      continue;
    }
    seenCodes.add(codeKey);

    if (parsed.data.email) {
      if (seenEmails.has(parsed.data.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          studentCode: parsed.data.student_code,
          message: `Duplicate email "${parsed.data.email}" in CSV`,
        });
        continue;
      }
      seenEmails.add(parsed.data.email);
    }

    validRows.push({
      row: rowNumber,
      ...parsed.data,
    });
  }

  return {
    headers: rawHeaders,
    totalRows: Math.max(0, matrix.length - 1),
    validRows,
    errors,
  };
}

export const SAMPLE_STUDENT_CSV = [
  'student_code,full_name,email,phone,status,class_code,section_name,session_code',
  'STU-2026-001,Amina Tariq,amina.tariq@example.edu,+1-555-0101,active,CS-101,A,2026-2027',
  'STU-2026-002,Bilal Hassan,bilal.hassan@example.edu,+1-555-0102,active,CS-101,A,2026-2027',
  'STU-2026-003,Clara Chen,clara.chen@example.edu,,active,CS-101,B,2026-2027',
].join('\n');
