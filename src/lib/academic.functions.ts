import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import {
  createAcademicClass,
  createAcademicSession,
  createAcademicTerm,
  createClassSection,
  createCourse,
  createDepartment,
  createProgram,
  createStudentAndOptionalEnrollment,
  createTeacherAssignment,
  deleteAcademicClass,
  deleteAcademicSession,
  deleteAcademicTerm,
  deleteClassSection,
  deleteCourse,
  deleteDepartment,
  deleteProgram,
  deleteStudentRecord,
  deleteTeacherAssignment,
  enrollExistingStudent,
  importStudentsFromCsv,
  listCsvImportJobs,
  listStudentsPaginated,
  listTeachersPaginated,
  loadAcademicCatalog,
  setCurrentAcademicSession,
  updateEnrollmentStatus,
} from './academic.server';

const instSchema = z.object({ institutionId: z.string().uuid() });

export const getAcademicCatalogFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => instSchema.parse(data))
  .handler(async ({ context, data }) =>
    loadAcademicCatalog(context.supabase, context.userId, data.institutionId),
  );

// Sessions & Terms
const createSessionSchema = z.object({
  institutionId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(40),
  startsOn: z.string().min(8),
  endsOn: z.string().min(8),
  status: z.enum(['planned', 'active', 'archived']),
  isCurrent: z.boolean(),
});

export const createAcademicSessionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSessionSchema.parse(data))
  .handler(async ({ context, data }) =>
    createAcademicSession(context.supabase, context.userId, data),
  );

export const setCurrentAcademicSessionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) =>
    setCurrentAcademicSession(context.supabase, context.userId, data),
  );

export const deleteAcademicSessionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteAcademicSession(context.supabase, context.userId, data);
    return { ok: true };
  });

const createTermSchema = z.object({
  institutionId: z.string().uuid(),
  sessionId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  startsOn: z.string().min(8),
  endsOn: z.string().min(8),
  status: z.enum(['planned', 'active', 'archived']),
  isCurrent: z.boolean(),
});

export const createAcademicTermFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createTermSchema.parse(data))
  .handler(async ({ context, data }) =>
    createAcademicTerm(context.supabase, context.userId, data),
  );

export const deleteAcademicTermFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), termId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteAcademicTerm(context.supabase, context.userId, data);
    return { ok: true };
  });

// Departments
export const createDepartmentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        code: z.string().trim().min(1).max(30),
        description: z.string().trim().max(500).nullable().optional(),
        headMembershipId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    createDepartment(context.supabase, context.userId, data),
  );

export const deleteDepartmentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), departmentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteDepartment(context.supabase, context.userId, data);
    return { ok: true };
  });

// Programs, Classes & Sections
export const createProgramFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        code: z.string().trim().min(1).max(30),
        departmentId: z.string().uuid().nullable().optional(),
        durationYears: z.number().int().min(1).max(10),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => createProgram(context.supabase, context.userId, data));

export const deleteProgramFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), programId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteProgram(context.supabase, context.userId, data);
    return { ok: true };
  });

export const createAcademicClassFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        code: z.string().trim().min(1).max(30),
        programId: z.string().uuid().nullable().optional(),
        levelOrder: z.number().int().min(1).max(20),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    createAcademicClass(context.supabase, context.userId, data),
  );

export const deleteAcademicClassFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), classId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteAcademicClass(context.supabase, context.userId, data);
    return { ok: true };
  });

export const createClassSectionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        classId: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        capacity: z.number().int().min(1).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    createClassSection(context.supabase, context.userId, data),
  );

export const deleteClassSectionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), sectionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteClassSection(context.supabase, context.userId, data);
    return { ok: true };
  });

// Courses
export const createCourseFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        code: z.string().trim().min(1).max(40),
        title: z.string().trim().min(2).max(150),
        departmentId: z.string().uuid().nullable().optional(),
        programId: z.string().uuid().nullable().optional(),
        classId: z.string().uuid().nullable().optional(),
        credits: z.number().min(0).max(30),
        description: z.string().trim().max(500).nullable().optional(),
        status: z.enum(['active', 'archived']).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => createCourse(context.supabase, context.userId, data));

export const deleteCourseFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), courseId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteCourse(context.supabase, context.userId, data);
    return { ok: true };
  });

// Teacher Assignments & Directory
export const createTeacherAssignmentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        membershipId: z.string().uuid(),
        courseId: z.string().uuid(),
        academicSessionId: z.string().uuid(),
        academicTermId: z.string().uuid().nullable().optional(),
        classSectionId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    createTeacherAssignment(context.supabase, context.userId, data),
  );

export const deleteTeacherAssignmentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), assignmentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteTeacherAssignment(context.supabase, context.userId, data);
    return { ok: true };
  });

export const listTeachersFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        search: z.string().optional(),
        departmentId: z.string().uuid().optional(),
        status: z.enum(['active', 'suspended']).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    listTeachersPaginated(context.supabase, context.userId, data),
  );

// Students, Enrollments & CSV Import
export const createStudentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        studentCode: z.string().trim().min(1).max(50),
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().email().nullable().optional(),
        phone: z.string().trim().max(30).nullable().optional(),
        status: z.enum(['active', 'graduated', 'withdrawn', 'suspended']).optional(),
        academicSessionId: z.string().uuid().nullable().optional(),
        academicTermId: z.string().uuid().nullable().optional(),
        classSectionId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    createStudentAndOptionalEnrollment(context.supabase, context.userId, data),
  );

export const enrollStudentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        studentId: z.string().uuid(),
        academicSessionId: z.string().uuid(),
        academicTermId: z.string().uuid().nullable().optional(),
        classSectionId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    enrollExistingStudent(context.supabase, context.userId, data),
  );

export const updateEnrollmentStatusFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        enrollmentId: z.string().uuid(),
        status: z.enum(['enrolled', 'dropped', 'completed']),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    updateEnrollmentStatus(context.supabase, context.userId, data),
  );

export const deleteStudentFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ institutionId: z.string().uuid(), studentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await deleteStudentRecord(context.supabase, context.userId, data);
    return { ok: true };
  });

export const listStudentsFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        search: z.string().optional(),
        status: z.enum(['active', 'graduated', 'withdrawn', 'suspended']).optional(),
        sessionId: z.string().uuid().optional(),
        sectionId: z.string().uuid().optional(),
        programId: z.string().uuid().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    listStudentsPaginated(context.supabase, context.userId, data),
  );

export const importStudentsCsvFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        institutionId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200),
        csvText: z.string().min(1).max(1_000_000),
        defaultSessionId: z.string().uuid().nullable().optional(),
        defaultSectionId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    importStudentsFromCsv(context.supabase, context.userId, data),
  );

export const listCsvImportJobsFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => instSchema.parse(data))
  .handler(async ({ context, data }) =>
    listCsvImportJobs(context.supabase, context.userId, data.institutionId),
  );
