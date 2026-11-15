import { describe, expect, it } from 'vitest';
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
  enrollExistingStudent,
  importStudentsFromCsv,
  listCsvImportJobs,
  listStudentsPaginated,
  listTeachersPaginated,
  loadAcademicCatalog,
  setCurrentAcademicSession,
  updateEnrollmentStatus,
} from '@/lib/academic.server';
import { parseAndValidateStudentCsv, SAMPLE_STUDENT_CSV } from '@/lib/csv';
import { AuthorizationError, type AuthedSupabase } from '@/lib/workspace.server';
import type {
  AcademicCycleStatus,
  CourseStatus,
  EnrollmentStatus,
  InstitutionRole,
  InstitutionStatus,
  StudentRecordStatus,
} from '@/integrations/supabase/types';

type AcademicMockDb = {
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
  profiles: Array<{
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    timezone: string;
  }>;
  institution_audit_logs: Array<Record<string, unknown>>;
  academic_sessions: Array<{
    id: string;
    institution_id: string;
    name: string;
    code: string;
    starts_on: string;
    ends_on: string;
    status: AcademicCycleStatus;
    is_current: boolean;
    created_by: string | null;
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
    status: AcademicCycleStatus;
    is_current: boolean;
    created_at: string;
    updated_at: string;
  }>;
  departments: Array<{
    id: string;
    institution_id: string;
    name: string;
    code: string;
    description: string | null;
    head_membership_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  programs: Array<{
    id: string;
    institution_id: string;
    department_id: string | null;
    name: string;
    code: string;
    duration_years: number;
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
  teacher_assignments: Array<{
    id: string;
    institution_id: string;
    membership_id: string;
    course_id: string;
    academic_session_id: string;
    academic_term_id: string | null;
    class_section_id: string | null;
    assigned_by: string | null;
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
    status: StudentRecordStatus;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }>;
  student_enrollments: Array<{
    id: string;
    institution_id: string;
    student_id: string;
    academic_session_id: string;
    academic_term_id: string | null;
    class_section_id: string;
    status: EnrollmentStatus;
    enrolled_by: string | null;
    created_at: string;
    updated_at: string;
  }>;
  csv_import_jobs: Array<Record<string, unknown>>;
};

function createAcademicSeed(): AcademicMockDb {
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
        id: 'mem-oak-teacher-1',
        institution_id: 'inst-oak',
        user_id: 'user-oak-teacher-1',
        role: 'teacher',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-oak-teacher-2',
        institution_id: 'inst-oak',
        user_id: 'user-oak-teacher-2',
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
        id: 'mem-crest-admin',
        institution_id: 'inst-crest',
        user_id: 'user-crest-admin',
        role: 'institution_admin',
        status: 'active',
        invited_by: 'user-crest-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-crest-teacher',
        institution_id: 'inst-crest',
        user_id: 'user-crest-teacher',
        role: 'teacher',
        status: 'active',
        invited_by: 'user-crest-admin',
        created_at: now,
        updated_at: now,
      },
    ],
    profiles: [
      { id: 'user-oak-admin', email: 'admin@oakridge.edu', full_name: 'Oak Admin', phone: null, timezone: 'UTC' },
      { id: 'user-oak-teacher-1', email: 'dr.lin@oakridge.edu', full_name: 'Dr. Mei Lin', phone: null, timezone: 'UTC' },
      { id: 'user-oak-teacher-2', email: 'prof.omar@oakridge.edu', full_name: 'Prof. Omar Farooq', phone: null, timezone: 'UTC' },
      { id: 'user-oak-student', email: 'zara.ali@oakridge.edu', full_name: 'Zara Ali', phone: null, timezone: 'UTC' },
      { id: 'user-crest-admin', email: 'admin@crestview.edu', full_name: 'Crest Admin', phone: null, timezone: 'UTC' },
      { id: 'user-crest-teacher', email: 'teacher@crestview.edu', full_name: 'Crest Teacher', phone: null, timezone: 'UTC' },
    ],
    institution_audit_logs: [],
    academic_sessions: [],
    academic_terms: [],
    departments: [],
    programs: [],
    academic_classes: [],
    class_sections: [],
    courses: [],
    teacher_assignments: [],
    student_records: [],
    student_enrollments: [],
    csv_import_jobs: [],
  };
}

function createRlsAcademicClient(db: AcademicMockDb, actorId: string): AuthedSupabase {
  let seq = 1;
  const isSuper = () => db.platform_admins.some((p) => p.user_id === actorId);
  const isMember = (instId: string) =>
    db.institution_memberships.some(
      (m) => m.institution_id === instId && m.user_id === actorId && m.status === 'active',
    );
  const hasRole = (instId: string, roles: InstitutionRole[]) =>
    db.institution_memberships.some(
      (m) =>
        m.institution_id === instId &&
        m.user_id === actorId &&
        m.status === 'active' &&
        roles.includes(m.role),
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
      case 'profiles':
        return db.profiles;
      case 'academic_sessions':
      case 'academic_terms':
      case 'departments':
      case 'programs':
      case 'academic_classes':
      case 'class_sections':
      case 'courses':
        return (db[table] as Record<string, unknown>[]).filter(
          (r) => isSuper() || isMember(String(r['institution_id'])),
        );
      case 'teacher_assignments':
        return db.teacher_assignments.filter(
          (r) =>
            isSuper() ||
            hasRole(r.institution_id, ['institution_admin', 'teacher', 'invigilator']),
        );
      case 'student_records':
        return db.student_records.filter(
          (r) =>
            isSuper() ||
            hasRole(r.institution_id, ['institution_admin', 'teacher', 'invigilator']) ||
            db.institution_memberships.some(
              (m) => m.id === r.membership_id && m.user_id === actorId && m.status === 'active',
            ),
        );
      case 'student_enrollments':
        return db.student_enrollments.filter(
          (r) =>
            isSuper() ||
            hasRole(r.institution_id, ['institution_admin', 'teacher', 'invigilator']),
        );
      case 'csv_import_jobs':
        return (db.csv_import_jobs as Record<string, unknown>[]).filter(
          (r) => isSuper() || hasRole(String(r['institution_id']), ['institution_admin']),
        );
      case 'institution_audit_logs':
        return db.institution_audit_logs.filter(
          (r) => isSuper() || hasRole(String(r['institution_id']), ['institution_admin']),
        );
      default:
        return [];
    }
  };

  function validateCompositeTenantRefs(table: string, row: Record<string, unknown>): string | null {
    const instId = String(row['institution_id'] ?? '');
    if (table === 'academic_terms') {
      const ok = db.academic_sessions.some(
        (s) => s.id === row['session_id'] && s.institution_id === instId,
      );
      if (!ok) return 'foreign key violation: session_id not in same institution';
    }
    if (table === 'class_sections') {
      const ok = db.academic_classes.some(
        (c) => c.id === row['class_id'] && c.institution_id === instId,
      );
      if (!ok) return 'foreign key violation: class_id not in same institution';
    }
    if (table === 'teacher_assignments') {
      const memOk = db.institution_memberships.some(
        (m) => m.id === row['membership_id'] && m.institution_id === instId,
      );
      const courseOk = db.courses.some(
        (c) => c.id === row['course_id'] && c.institution_id === instId,
      );
      const sessOk = db.academic_sessions.some(
        (s) => s.id === row['academic_session_id'] && s.institution_id === instId,
      );
      if (!memOk || !courseOk || !sessOk) {
        return 'foreign key violation: cross-institution reference rejected';
      }
    }
    if (table === 'student_enrollments') {
      const stuOk = db.student_records.some(
        (s) => s.id === row['student_id'] && s.institution_id === instId,
      );
      const sessOk = db.academic_sessions.some(
        (s) => s.id === row['academic_session_id'] && s.institution_id === instId,
      );
      const secOk = db.class_sections.some(
        (sec) => sec.id === row['class_section_id'] && sec.institution_id === instId,
      );
      if (!stuOk || !sessOk || !secOk) {
        return 'foreign key violation: cross-institution enrollment reference rejected';
      }
    }
    return null;
  }

  function makeBuilder(table: string) {
    let filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Record<string, unknown> | null = null;
    let maxRows: number | null = null;

    const applyFilters = (rows: Record<string, unknown>[]) => {
      const matched = rows.filter((r) => filters.every((fn) => fn(r)));
      return maxRows !== null ? matched.slice(0, maxRows) : matched;
    };

    const exec = async () => {
      if (mode === 'select') {
        return { data: applyFilters(selectRows(table)), error: null };
      }
      if (mode === 'insert' && payload) {
        const instId = String(payload['institution_id'] ?? '');
        if (!isSuper() && !hasRole(instId, ['institution_admin'])) {
          return { data: null, error: { message: 'new row violates row-level security policy' } };
        }
        const refError = validateCompositeTenantRefs(table, payload);
        if (refError) {
          return { data: null, error: { message: refError } };
        }

        const now = '2026-11-15T00:00:00.000Z';
        const created: Record<string, unknown> = {
          id: `${table}-${seq++}`,
          created_at: now,
          updated_at: now,
          ...payload,
        };
        const targetArr = (db as Record<string, unknown[]>)[table];
        if (Array.isArray(targetArr)) {
          targetArr.push(created);
        }
        return { data: [created], error: null };
      }
      if (mode === 'update' && payload) {
        const matched = applyFilters(selectRows(table));
        for (const r of matched) {
          const instId = String(r['institution_id'] ?? '');
          if (!isSuper() && !hasRole(instId, ['institution_admin'])) {
            return { data: null, error: { message: 'update violates row-level security policy' } };
          }
          Object.assign(r, payload, { updated_at: '2026-11-15T01:00:00.000Z' });
        }
        return { data: matched, error: null };
      }
      if (mode === 'delete') {
        const matched = applyFilters(selectRows(table));
        const ids = new Set(matched.map((r) => r['id']));
        for (const r of matched) {
          const instId = String(r['institution_id'] ?? '');
          if (!isSuper() && !hasRole(instId, ['institution_admin'])) {
            return { data: null, error: { message: 'delete violates row-level security policy' } };
          }
        }
        const targetArr = (db as Record<string, Record<string, unknown>[] | undefined>)[table];
        if (Array.isArray(targetArr)) {
          (db as Record<string, unknown[]>)[table] = targetArr.filter((r) => !ids.has(r['id']));
        }
        return { data: matched, error: null };
      }
      return { data: [], error: null };
    };

    const builder = {
      select: (_cols?: string) => builder,
      insert: (row: Record<string, unknown>) => {
        mode = 'insert';
        payload = row;
        return builder;
      },
      update: (row: Record<string, unknown>) => {
        mode = 'update';
        payload = row;
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

describe('Phase 3 academic management & multi-tenant isolation', () => {
  it('creates an academic session, term, department, program, class, section, course, teacher assignment, and student enrollment', async () => {
    const db = createAcademicSeed();
    const oakAdmin = createRlsAcademicClient(db, 'user-oak-admin');

    // 1. Academic session & term
    const session1 = await createAcademicSession(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: '2026-2027 Academic Year',
      code: '2026-2027',
      startsOn: '2026-09-01',
      endsOn: '2027-06-30',
      status: 'active',
      isCurrent: true,
    });
    expect(session1.is_current).toBe(true);

    const session2 = await createAcademicSession(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: '2027-2028 Academic Year',
      code: '2027-2028',
      startsOn: '2027-09-01',
      endsOn: '2028-06-30',
      status: 'planned',
      isCurrent: false,
    });
    const switched = await setCurrentAcademicSession(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      sessionId: session2.id,
    });
    expect(switched.is_current).toBe(true);
    expect(db.academic_sessions.find((s) => s.id === session1.id)?.is_current).toBe(false);

    // Switch back to session1 for tests
    await setCurrentAcademicSession(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      sessionId: session1.id,
    });

    const term = await createAcademicTerm(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      sessionId: session1.id,
      name: 'Fall Term',
      startsOn: '2026-09-01',
      endsOn: '2026-12-20',
      status: 'active',
      isCurrent: true,
    });
    expect(term.session_id).toBe(session1.id);

    // 2. Department, Program, Class & Section
    const dept = await createDepartment(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: 'Computer Science',
      code: 'cs',
      description: 'Computing & Software Engineering',
    });
    expect(dept.code).toBe('CS');

    const program = await createProgram(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: 'BSc Computer Science',
      code: 'bsc-cs',
      departmentId: dept.id,
      durationYears: 4,
    });
    expect(program.department_id).toBe(dept.id);

    const cls = await createAcademicClass(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: 'Year 1 Cohort',
      code: 'CS-101',
      programId: program.id,
      levelOrder: 1,
    });
    expect(cls.code).toBe('CS-101');

    const secA = await createClassSection(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      classId: cls.id,
      name: 'A',
      capacity: 40,
    });
    const secB = await createClassSection(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      classId: cls.id,
      name: 'B',
      capacity: 40,
    });
    expect(secA.class_id).toBe(cls.id);

    // 3. Course / Subject
    const course = await createCourse(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      code: 'cs101',
      title: 'Algorithms & Data Structures',
      departmentId: dept.id,
      programId: program.id,
      classId: cls.id,
      credits: 4,
    });
    expect(course.code).toBe('CS101');

    // 4. Teacher assignment
    const assignment = await createTeacherAssignment(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      membershipId: 'mem-oak-teacher-1',
      courseId: course.id,
      academicSessionId: session1.id,
      academicTermId: term.id,
      classSectionId: secA.id,
    });
    expect(assignment.membership_id).toBe('mem-oak-teacher-1');

    // Assigning a student membership as teacher must fail
    await expect(
      createTeacherAssignment(oakAdmin, 'user-oak-admin', {
        institutionId: 'inst-oak',
        membershipId: 'mem-oak-student',
        courseId: course.id,
        academicSessionId: session1.id,
      }),
    ).rejects.toThrow(AuthorizationError);

    // 5. Student creation + enrollment (with automatic profile/membership link by email)
    const createdStudent = await createStudentAndOptionalEnrollment(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      studentCode: 'STU-2026-100',
      fullName: 'Zara Ali',
      email: 'zara.ali@oakridge.edu',
      academicSessionId: session1.id,
      academicTermId: term.id,
      classSectionId: secA.id,
    });
    expect(createdStudent.student.membership_id).toBe('mem-oak-student');
    expect(createdStudent.enrollment?.class_section_id).toBe(secA.id);

    // Re-enroll into secB and update enrollment status
    const enrB = await enrollExistingStudent(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      studentId: createdStudent.student.id,
      academicSessionId: session1.id,
      classSectionId: secB.id,
    });
    const updatedEnr = await updateEnrollmentStatus(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      enrollmentId: enrB.id,
      status: 'completed',
    });
    expect(updatedEnr.status).toBe('completed');

    // Catalog loads cleanly
    const catalog = await loadAcademicCatalog(oakAdmin, 'user-oak-admin', 'inst-oak');
    expect(catalog.sessions).toHaveLength(2);
    expect(catalog.classes).toHaveLength(1);
    expect(catalog.courses).toHaveLength(1);
    expect(catalog.assignments).toHaveLength(1);
  });

  it('supports search, filtering, pagination, and CSV student import with validation & error reporting', async () => {
    const db = createAcademicSeed();
    const oakAdmin = createRlsAcademicClient(db, 'user-oak-admin');

    const session = await createAcademicSession(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: '2026-2027',
      code: '2026-2027',
      startsOn: '2026-09-01',
      endsOn: '2027-06-30',
      status: 'active',
      isCurrent: true,
    });
    const dept = await createDepartment(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: 'Computer Science',
      code: 'CS',
    });
    const prog = await createProgram(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: 'BSc CS',
      code: 'BSCCS',
      departmentId: dept.id,
      durationYears: 4,
    });
    const cls = await createAcademicClass(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: 'CS Year 1',
      code: 'CS-101',
      programId: prog.id,
      levelOrder: 1,
    });
    const secA = await createClassSection(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      classId: cls.id,
      name: 'A',
      capacity: 30,
    });
    await createClassSection(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      classId: cls.id,
      name: 'B',
      capacity: 30,
    });
    const course = await createCourse(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      code: 'CS101',
      title: 'Intro to CS',
      departmentId: dept.id,
      programId: prog.id,
      classId: cls.id,
      credits: 3,
    });
    await createTeacherAssignment(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      membershipId: 'mem-oak-teacher-1',
      courseId: course.id,
      academicSessionId: session.id,
      classSectionId: secA.id,
    });

    // Client-side parser test on sample CSV
    const sampleParsed = parseAndValidateStudentCsv(SAMPLE_STUDENT_CSV);
    expect(sampleParsed.validRows).toHaveLength(3);
    expect(sampleParsed.errors).toHaveLength(0);

    // Mixed valid & invalid CSV import
    const mixedCsv = [
      'student_code,full_name,email,phone,status,class_code,section_name,session_code',
      'STU-2026-001,Amina Tariq,amina@oakridge.edu,+1-555-0101,active,CS-101,A,2026-2027',
      'STU-2026-002,Bilal Hassan,bilal@oakridge.edu,,active,CS-101,B,2026-2027',
      'STU-2026-003,Bad Email,not-an-email,,active,CS-101,A,2026-2027',
      'STU-2026-001,Duplicate In CSV,dup@oakridge.edu,,active,CS-101,A,2026-2027',
      'STU-2026-004,Unknown Section,unk@oakridge.edu,,active,CS-101,Z,2026-2027',
    ].join('\n');

    const summary = await importStudentsFromCsv(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      fileName: 'intake-2026.csv',
      csvText: mixedCsv,
    });

    expect(summary.totalRows).toBe(5);
    expect(summary.importedCount).toBe(2);
    expect(summary.enrolledCount).toBe(2);
    expect(summary.errorCount).toBe(3);
    expect(summary.errors.map((e) => e.row)).toEqual([4, 5, 6]);

    // Re-importing same student_code reports DB duplicate error
    const reimport = await importStudentsFromCsv(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      fileName: 'intake-dup.csv',
      csvText: 'student_code,full_name,email\nSTU-2026-001,Amina Tariq,other@oakridge.edu',
    });
    expect(reimport.importedCount).toBe(0);
    expect(reimport.errorCount).toBe(1);
    expect(reimport.errors[0]?.message).toMatch(/already exists/i);

    const jobs = await listCsvImportJobs(oakAdmin, 'user-oak-admin', 'inst-oak');
    expect(jobs).toHaveLength(2);

    // Search, filter & paginate teachers (1 institution_admin + 2 teachers = 3)
    const teacherPage1 = await listTeachersPaginated(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      page: 1,
      pageSize: 1,
    });
    expect(teacherPage1.total).toBe(3);
    expect(teacherPage1.totalPages).toBe(3);
    expect(teacherPage1.items).toHaveLength(1);

    const teacherFiltered = await listTeachersPaginated(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      departmentId: dept.id,
      search: 'Mei Lin',
      page: 1,
      pageSize: 10,
    });
    expect(teacherFiltered.total).toBe(1);
    expect(teacherFiltered.items[0]?.profile?.email).toBe('dr.lin@oakridge.edu');

    // Search, filter & paginate students
    const studentPage1 = await listStudentsPaginated(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      page: 1,
      pageSize: 1,
    });
    expect(studentPage1.total).toBe(2);
    expect(studentPage1.totalPages).toBe(2);

    const studentBySection = await listStudentsPaginated(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      sectionId: secA.id,
      search: 'Amina',
      page: 1,
      pageSize: 10,
    });
    expect(studentBySection.total).toBe(1);
    expect(studentBySection.items[0]?.student_code).toBe('STU-2026-001');
  });

  it('enforces strict cross-tenant and non-admin isolation across all Phase 3 endpoints', async () => {
    const db = createAcademicSeed();
    const oakAdmin = createRlsAcademicClient(db, 'user-oak-admin');
    const oakTeacher = createRlsAcademicClient(db, 'user-oak-teacher-1');
    const oakStudent = createRlsAcademicClient(db, 'user-oak-student');
    const crestAdmin = createRlsAcademicClient(db, 'user-crest-admin');

    const oakSession = await createAcademicSession(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      name: 'Oak 2026',
      code: 'OAK-26',
      startsOn: '2026-09-01',
      endsOn: '2027-06-30',
      status: 'active',
      isCurrent: true,
    });

    // Teacher can read catalog & rosters, but CANNOT create/delete sessions, classes, courses, assignments, or students
    const teacherCatalog = await loadAcademicCatalog(oakTeacher, 'user-oak-teacher-1', 'inst-oak');
    expect(teacherCatalog.sessions).toHaveLength(1);

    await expect(
      createAcademicClass(oakTeacher, 'user-oak-teacher-1', {
        institutionId: 'inst-oak',
        name: 'Unauthorized Class',
        code: 'UNAUTH',
        levelOrder: 1,
      }),
    ).rejects.toThrow(AuthorizationError);

    // Student cannot read teacher/student directories or mutate academic setup
    await expect(
      listStudentsPaginated(oakStudent, 'user-oak-student', {
        institutionId: 'inst-oak',
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(AuthorizationError);

    // Cross-tenant: Crestview Admin CANNOT read Oakridge catalog, students, or write into Oakridge
    await expect(
      loadAcademicCatalog(crestAdmin, 'user-crest-admin', 'inst-oak'),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      createAcademicClass(crestAdmin, 'user-crest-admin', {
        institutionId: 'inst-oak',
        name: 'Hijack Class',
        code: 'HIJACK',
        levelOrder: 1,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      importStudentsFromCsv(crestAdmin, 'user-crest-admin', {
        institutionId: 'inst-oak',
        fileName: 'hack.csv',
        csvText: 'student_code,full_name\nH1,Hacker One',
      }),
    ).rejects.toThrow(AuthorizationError);

    // Cross-tenant teacher assignment using Crestview membership inside Oakridge is rejected
    const oakCourse = await createCourse(oakAdmin, 'user-oak-admin', {
      institutionId: 'inst-oak',
      code: 'CS101',
      title: 'Intro CS',
      credits: 3,
    });
    await expect(
      createTeacherAssignment(oakAdmin, 'user-oak-admin', {
        institutionId: 'inst-oak',
        membershipId: 'mem-crest-teacher',
        courseId: oakCourse.id,
        academicSessionId: oakSession.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
