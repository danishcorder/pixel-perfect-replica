import type {
  AcademicCycleStatus,
  CourseStatus,
  Database,
  EnrollmentStatus,
  Json,
  StudentRecordStatus,
} from '@/integrations/supabase/types';
import {
  parseAndValidateStudentCsv,
  type CsvImportRowError,
} from './csv';
import {
  AuthorizationError,
  verifyInstitutionAccess,
  type AuthedSupabase,
  type MemberWithProfile,
} from './workspace.server';

export type AcademicSessionRow = Database['public']['Tables']['academic_sessions']['Row'];
export type AcademicTermRow = Database['public']['Tables']['academic_terms']['Row'];
export type DepartmentRow = Database['public']['Tables']['departments']['Row'];
export type ProgramRow = Database['public']['Tables']['programs']['Row'];
export type AcademicClassRow = Database['public']['Tables']['academic_classes']['Row'];
export type ClassSectionRow = Database['public']['Tables']['class_sections']['Row'];
export type CourseRow = Database['public']['Tables']['courses']['Row'];
export type TeacherAssignmentRow = Database['public']['Tables']['teacher_assignments']['Row'];
export type StudentRecordRow = Database['public']['Tables']['student_records']['Row'];
export type StudentEnrollmentRow = Database['public']['Tables']['student_enrollments']['Row'];
export type CsvImportJobRow = Database['public']['Tables']['csv_import_jobs']['Row'];

export type AcademicCatalog = {
  sessions: AcademicSessionRow[];
  terms: AcademicTermRow[];
  departments: DepartmentRow[];
  programs: ProgramRow[];
  classes: AcademicClassRow[];
  sections: ClassSectionRow[];
  courses: CourseRow[];
  teachers: MemberWithProfile[];
  assignments: TeacherAssignmentRow[];
};

export type TeacherDirectoryItem = MemberWithProfile & {
  assignmentsCount: number;
  courses: Array<{ id: string; code: string; title: string; sessionId: string }>;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type StudentDirectoryItem = StudentRecordRow & {
  enrollments: Array<
    StudentEnrollmentRow & {
      sessionName: string;
      termName: string | null;
      sectionName: string;
      className: string;
      classCode: string;
      programId: string | null;
    }
  >;
};

export type CsvImportSummary = {
  totalRows: number;
  validRows: number;
  importedCount: number;
  enrolledCount: number;
  errorCount: number;
  errors: CsvImportRowError[];
};

async function logAcademicAudit(
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

export async function loadAcademicCatalog(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
): Promise<AcademicCatalog> {
  const { isSuperAdmin, membership } = await verifyInstitutionAccess(
    supabase,
    userId,
    institutionId,
  );

  const canSeeAssignments =
    isSuperAdmin ||
    membership?.role === 'institution_admin' ||
    membership?.role === 'teacher' ||
    membership?.role === 'invigilator';

  const [
    sessionsRes,
    termsRes,
    departmentsRes,
    programsRes,
    classesRes,
    sectionsRes,
    coursesRes,
    membersRes,
    assignmentsRes,
  ] = await Promise.all([
    supabase
      .from('academic_sessions')
      .select('*')
      .eq('institution_id', institutionId)
      .order('starts_on', { ascending: false }),
    supabase
      .from('academic_terms')
      .select('*')
      .eq('institution_id', institutionId)
      .order('starts_on', { ascending: true }),
    supabase
      .from('departments')
      .select('*')
      .eq('institution_id', institutionId)
      .order('name', { ascending: true }),
    supabase
      .from('programs')
      .select('*')
      .eq('institution_id', institutionId)
      .order('name', { ascending: true }),
    supabase
      .from('academic_classes')
      .select('*')
      .eq('institution_id', institutionId)
      .order('level_order', { ascending: true }),
    supabase
      .from('class_sections')
      .select('*')
      .eq('institution_id', institutionId)
      .order('name', { ascending: true }),
    supabase
      .from('courses')
      .select('*')
      .eq('institution_id', institutionId)
      .order('code', { ascending: true }),
    supabase
      .from('institution_memberships')
      .select('*')
      .eq('institution_id', institutionId)
      .in('role', ['teacher', 'institution_admin'])
      .eq('status', 'active'),
    canSeeAssignments
      ? supabase
          .from('teacher_assignments')
          .select('*')
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as TeacherAssignmentRow[], error: null }),
  ]);

  for (const res of [
    sessionsRes,
    termsRes,
    departmentsRes,
    programsRes,
    classesRes,
    sectionsRes,
    coursesRes,
    membersRes,
    assignmentsRes,
  ]) {
    if (res.error) throw new Error(res.error.message);
  }

  const teacherMembers = membersRes.data ?? [];
  const teacherIds = Array.from(new Set(teacherMembers.map((m) => m.user_id)));
  let profilesMap = new Map<
    string,
    { id: string; email: string; full_name: string; phone: string | null; timezone: string }
  >();
  if (teacherIds.length > 0) {
    const { data: profilesData, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, timezone')
      .in('id', teacherIds);
    if (profErr) throw new Error(profErr.message);
    profilesMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
  }

  const teachers: MemberWithProfile[] = teacherMembers.map((m) => ({
    ...m,
    profile: profilesMap.get(m.user_id) ?? null,
  }));

  return {
    sessions: sessionsRes.data ?? [],
    terms: termsRes.data ?? [],
    departments: departmentsRes.data ?? [],
    programs: programsRes.data ?? [],
    classes: classesRes.data ?? [],
    sections: sectionsRes.data ?? [],
    courses: coursesRes.data ?? [],
    teachers,
    assignments: assignmentsRes.data ?? [],
  };
}

// ============================================================================
// SESSIONS & TERMS
// ============================================================================

export async function createAcademicSession(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    name: string;
    code: string;
    startsOn: string;
    endsOn: string;
    status: AcademicCycleStatus;
    isCurrent: boolean;
  },
): Promise<AcademicSessionRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  if (input.isCurrent) {
    await supabase
      .from('academic_sessions')
      .update({ is_current: false })
      .eq('institution_id', input.institutionId)
      .eq('is_current', true);
  }

  const { data, error } = await supabase
    .from('academic_sessions')
    .insert({
      institution_id: input.institutionId,
      name: input.name.trim(),
      code: input.code.trim(),
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      status: input.status,
      is_current: input.isCurrent,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create academic session');
  await logAcademicAudit(supabase, input.institutionId, userId, 'academic_session.created', 'academic_session', data.id, {
    name: data.name,
  });
  return data;
}

export async function setCurrentAcademicSession(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; sessionId: string },
): Promise<AcademicSessionRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  await supabase
    .from('academic_sessions')
    .update({ is_current: false })
    .eq('institution_id', input.institutionId)
    .eq('is_current', true);

  const { data, error } = await supabase
    .from('academic_sessions')
    .update({ is_current: true, status: 'active' })
    .eq('id', input.sessionId)
    .eq('institution_id', input.institutionId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new AuthorizationError('Academic session not found in this institution', 404);
  return data;
}

export async function deleteAcademicSession(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; sessionId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('academic_sessions')
    .delete()
    .eq('id', input.sessionId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function createAcademicTerm(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    sessionId: string;
    name: string;
    startsOn: string;
    endsOn: string;
    status: AcademicCycleStatus;
    isCurrent: boolean;
  },
): Promise<AcademicTermRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  if (input.isCurrent) {
    await supabase
      .from('academic_terms')
      .update({ is_current: false })
      .eq('institution_id', input.institutionId)
      .eq('is_current', true);
  }

  const { data, error } = await supabase
    .from('academic_terms')
    .insert({
      institution_id: input.institutionId,
      session_id: input.sessionId,
      name: input.name.trim(),
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      status: input.status,
      is_current: input.isCurrent,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create academic term');
  return data;
}

export async function deleteAcademicTerm(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; termId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('academic_terms')
    .delete()
    .eq('id', input.termId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// DEPARTMENTS, PROGRAMS, CLASSES, SECTIONS & COURSES
// ============================================================================

export async function createDepartment(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    name: string;
    code: string;
    description?: string | null | undefined;
    headMembershipId?: string | null | undefined;
  },
): Promise<DepartmentRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { data, error } = await supabase
    .from('departments')
    .insert({
      institution_id: input.institutionId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description ?? null,
      head_membership_id: input.headMembershipId ?? null,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create department');
  return data;
}

export async function deleteDepartment(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; departmentId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', input.departmentId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function createProgram(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    name: string;
    code: string;
    departmentId?: string | null | undefined;
    durationYears: number;
  },
): Promise<ProgramRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { data, error } = await supabase
    .from('programs')
    .insert({
      institution_id: input.institutionId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      department_id: input.departmentId ?? null,
      duration_years: input.durationYears,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create program');
  return data;
}

export async function deleteProgram(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; programId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', input.programId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function createAcademicClass(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    name: string;
    code: string;
    programId?: string | null | undefined;
    levelOrder: number;
  },
): Promise<AcademicClassRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { data, error } = await supabase
    .from('academic_classes')
    .insert({
      institution_id: input.institutionId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      program_id: input.programId ?? null,
      level_order: input.levelOrder,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create class');
  return data;
}

export async function deleteAcademicClass(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; classId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('academic_classes')
    .delete()
    .eq('id', input.classId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function createClassSection(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; classId: string; name: string; capacity: number },
): Promise<ClassSectionRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { data, error } = await supabase
    .from('class_sections')
    .insert({
      institution_id: input.institutionId,
      class_id: input.classId,
      name: input.name.trim(),
      capacity: input.capacity,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create section');
  return data;
}

export async function deleteClassSection(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; sectionId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('class_sections')
    .delete()
    .eq('id', input.sectionId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function createCourse(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    code: string;
    title: string;
    departmentId?: string | null | undefined;
    programId?: string | null | undefined;
    classId?: string | null | undefined;
    credits: number;
    description?: string | null | undefined;
    status?: CourseStatus | undefined;
  },
): Promise<CourseRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { data, error } = await supabase
    .from('courses')
    .insert({
      institution_id: input.institutionId,
      code: input.code.trim().toUpperCase(),
      title: input.title.trim(),
      department_id: input.departmentId ?? null,
      program_id: input.programId ?? null,
      class_id: input.classId ?? null,
      credits: input.credits,
      description: input.description ?? null,
      status: input.status ?? 'active',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create course');
  return data;
}

export async function deleteCourse(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; courseId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', input.courseId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// TEACHER ASSIGNMENTS & TEACHER DIRECTORY
// ============================================================================

export async function createTeacherAssignment(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    membershipId: string;
    courseId: string;
    academicSessionId: string;
    academicTermId?: string | null | undefined;
    classSectionId?: string | null | undefined;
  },
): Promise<TeacherAssignmentRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  // Explicit server-side verification that membership belongs to this institution and is teacher/admin
  const { data: targetMem, error: memErr } = await supabase
    .from('institution_memberships')
    .select('*')
    .eq('id', input.membershipId)
    .eq('institution_id', input.institutionId)
    .eq('status', 'active')
    .maybeSingle();

  if (memErr) throw new Error(memErr.message);
  if (!targetMem || !['teacher', 'institution_admin'].includes(targetMem.role)) {
    throw new AuthorizationError(
      'Selected member must be an active Teacher or Institution Admin in this institution',
      400,
    );
  }

  const { data, error } = await supabase
    .from('teacher_assignments')
    .insert({
      institution_id: input.institutionId,
      membership_id: input.membershipId,
      course_id: input.courseId,
      academic_session_id: input.academicSessionId,
      academic_term_id: input.academicTermId ?? null,
      class_section_id: input.classSectionId ?? null,
      assigned_by: userId,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to assign teacher');
  await logAcademicAudit(
    supabase,
    input.institutionId,
    userId,
    'teacher_assignment.created',
    'teacher_assignment',
    data.id,
    { course_id: input.courseId, membership_id: input.membershipId },
  );
  return data;
}

export async function deleteTeacherAssignment(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; assignmentId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('teacher_assignments')
    .delete()
    .eq('id', input.assignmentId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function listTeachersPaginated(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    search?: string | undefined;
    departmentId?: string | undefined;
    status?: 'active' | 'suspended' | undefined;
    page: number;
    pageSize: number;
  },
): Promise<PaginatedResult<TeacherDirectoryItem>> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [
    'institution_admin',
    'teacher',
  ]);

  let memQuery = supabase
    .from('institution_memberships')
    .select('*')
    .eq('institution_id', input.institutionId)
    .in('role', ['teacher', 'institution_admin'])
    .order('created_at', { ascending: true });

  if (input.status) {
    memQuery = memQuery.eq('status', input.status);
  }

  const [memRes, coursesRes, assignRes] = await Promise.all([
    memQuery,
    supabase.from('courses').select('*').eq('institution_id', input.institutionId),
    supabase.from('teacher_assignments').select('*').eq('institution_id', input.institutionId),
  ]);

  if (memRes.error) throw new Error(memRes.error.message);
  if (coursesRes.error) throw new Error(coursesRes.error.message);
  if (assignRes.error) throw new Error(assignRes.error.message);

  const memberRows = memRes.data ?? [];
  const userIds = Array.from(new Set(memberRows.map((m) => m.user_id)));
  let profilesMap = new Map<
    string,
    { id: string; email: string; full_name: string; phone: string | null; timezone: string }
  >();
  if (userIds.length > 0) {
    const { data: profilesData, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, timezone')
      .in('id', userIds);
    if (profErr) throw new Error(profErr.message);
    profilesMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
  }

  const courseById = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));
  const assignmentsByMember = new Map<string, TeacherAssignmentRow[]>();
  for (const a of assignRes.data ?? []) {
    const list = assignmentsByMember.get(a.membership_id) ?? [];
    list.push(a);
    assignmentsByMember.set(a.membership_id, list);
  }

  const q = input.search?.trim().toLowerCase() ?? '';
  const items: TeacherDirectoryItem[] = [];

  for (const m of memberRows) {
    const profile = profilesMap.get(m.user_id) ?? null;
    const memberAssigns = assignmentsByMember.get(m.id) ?? [];
    const assignedCourses = memberAssigns
      .map((a) => {
        const c = courseById.get(a.course_id);
        return c
          ? {
              id: c.id,
              code: c.code,
              title: c.title,
              sessionId: a.academic_session_id,
              departmentId: c.department_id,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (
      input.departmentId &&
      !assignedCourses.some((c) => c.departmentId === input.departmentId)
    ) {
      continue;
    }

    if (q) {
      const hay = [
        profile?.full_name ?? '',
        profile?.email ?? '',
        ...assignedCourses.map((c) => `${c.code} ${c.title}`),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }

    items.push({
      ...m,
      profile,
      assignmentsCount: memberAssigns.length,
      courses: assignedCourses.map(({ id, code, title, sessionId }) => ({
        id,
        code,
        title,
        sessionId,
      })),
    });
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const safePage = Math.min(Math.max(1, input.page), totalPages);
  const start = (safePage - 1) * input.pageSize;

  return {
    items: items.slice(start, start + input.pageSize),
    total,
    page: safePage,
    pageSize: input.pageSize,
    totalPages,
  };
}

// ============================================================================
// STUDENT ROSTER, ENROLLMENTS & CSV IMPORT
// ============================================================================

export async function createStudentAndOptionalEnrollment(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    studentCode: string;
    fullName: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    status?: StudentRecordStatus | undefined;
    academicSessionId?: string | null | undefined;
    academicTermId?: string | null | undefined;
    classSectionId?: string | null | undefined;
  },
): Promise<{ student: StudentRecordRow; enrollment: StudentEnrollmentRow | null }> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  const cleanEmail = input.email ? input.email.trim().toLowerCase() : null;
  let linkedMembershipId: string | null = null;

  if (cleanEmail) {
    // Link automatically if a student/member profile with that email already exists in this institution
    const { data: matchingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (matchingProfile) {
      const { data: matchingMembership } = await supabase
        .from('institution_memberships')
        .select('id')
        .eq('institution_id', input.institutionId)
        .eq('user_id', matchingProfile.id)
        .maybeSingle();
      linkedMembershipId = matchingMembership?.id ?? null;
    }
  }

  const { data: student, error } = await supabase
    .from('student_records')
    .insert({
      institution_id: input.institutionId,
      membership_id: linkedMembershipId,
      student_code: input.studentCode.trim(),
      full_name: input.fullName.trim(),
      email: cleanEmail,
      phone: input.phone ? input.phone.trim() : null,
      status: input.status ?? 'active',
      created_by: userId,
    })
    .select('*')
    .single();

  if (error || !student) throw new Error(error?.message ?? 'Failed to create student record');

  let enrollment: StudentEnrollmentRow | null = null;
  if (input.academicSessionId && input.classSectionId) {
    const { data: enr, error: enrErr } = await supabase
      .from('student_enrollments')
      .insert({
        institution_id: input.institutionId,
        student_id: student.id,
        academic_session_id: input.academicSessionId,
        academic_term_id: input.academicTermId ?? null,
        class_section_id: input.classSectionId,
        status: 'enrolled',
        enrolled_by: userId,
      })
      .select('*')
      .single();
    if (enrErr) throw new Error(enrErr.message);
    enrollment = enr;
  }

  await logAcademicAudit(supabase, input.institutionId, userId, 'student.created', 'student_record', student.id, {
    student_code: student.student_code,
    enrolled: Boolean(enrollment),
  });

  return { student, enrollment };
}

export async function enrollExistingStudent(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    studentId: string;
    academicSessionId: string;
    academicTermId?: string | null | undefined;
    classSectionId: string;
  },
): Promise<StudentEnrollmentRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  const { data, error } = await supabase
    .from('student_enrollments')
    .insert({
      institution_id: input.institutionId,
      student_id: input.studentId,
      academic_session_id: input.academicSessionId,
      academic_term_id: input.academicTermId ?? null,
      class_section_id: input.classSectionId,
      status: 'enrolled',
      enrolled_by: userId,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to enroll student');
  return data;
}

export async function updateEnrollmentStatus(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; enrollmentId: string; status: EnrollmentStatus },
): Promise<StudentEnrollmentRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { data, error } = await supabase
    .from('student_enrollments')
    .update({ status: input.status })
    .eq('id', input.enrollmentId)
    .eq('institution_id', input.institutionId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new AuthorizationError('Enrollment not found in this institution', 404);
  return data;
}

export async function deleteStudentRecord(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; studentId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);
  const { error } = await supabase
    .from('student_records')
    .delete()
    .eq('id', input.studentId)
    .eq('institution_id', input.institutionId);
  if (error) throw new Error(error.message);
}

export async function listStudentsPaginated(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    search?: string | undefined;
    status?: StudentRecordStatus | undefined;
    sessionId?: string | undefined;
    sectionId?: string | undefined;
    programId?: string | undefined;
    page: number;
    pageSize: number;
  },
): Promise<PaginatedResult<StudentDirectoryItem>> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, [
    'institution_admin',
    'teacher',
  ]);

  let studentQuery = supabase
    .from('student_records')
    .select('*')
    .eq('institution_id', input.institutionId)
    .order('created_at', { ascending: false });

  if (input.status) {
    studentQuery = studentQuery.eq('status', input.status);
  }

  const [studentsRes, enrollmentsRes, sessionsRes, termsRes, sectionsRes, classesRes] =
    await Promise.all([
      studentQuery,
      supabase.from('student_enrollments').select('*').eq('institution_id', input.institutionId),
      supabase.from('academic_sessions').select('*').eq('institution_id', input.institutionId),
      supabase.from('academic_terms').select('*').eq('institution_id', input.institutionId),
      supabase.from('class_sections').select('*').eq('institution_id', input.institutionId),
      supabase.from('academic_classes').select('*').eq('institution_id', input.institutionId),
    ]);

  for (const r of [
    studentsRes,
    enrollmentsRes,
    sessionsRes,
    termsRes,
    sectionsRes,
    classesRes,
  ]) {
    if (r.error) throw new Error(r.error.message);
  }

  const sessionMap = new Map((sessionsRes.data ?? []).map((s) => [s.id, s]));
  const termMap = new Map((termsRes.data ?? []).map((t) => [t.id, t]));
  const sectionMap = new Map((sectionsRes.data ?? []).map((sec) => [sec.id, sec]));
  const classMap = new Map((classesRes.data ?? []).map((c) => [c.id, c]));

  const enrollmentsByStudent = new Map<string, StudentDirectoryItem['enrollments']>();
  for (const enr of enrollmentsRes.data ?? []) {
    const sess = sessionMap.get(enr.academic_session_id);
    const term = enr.academic_term_id ? termMap.get(enr.academic_term_id) : undefined;
    const sec = sectionMap.get(enr.class_section_id);
    const cls = sec ? classMap.get(sec.class_id) : undefined;
    const list = enrollmentsByStudent.get(enr.student_id) ?? [];
    list.push({
      ...enr,
      sessionName: sess?.name ?? 'Unknown session',
      termName: term?.name ?? null,
      sectionName: sec?.name ?? 'Unknown section',
      className: cls?.name ?? 'Unknown class',
      classCode: cls?.code ?? '',
      programId: cls?.program_id ?? null,
    });
    enrollmentsByStudent.set(enr.student_id, list);
  }

  const q = input.search?.trim().toLowerCase() ?? '';
  const filtered: StudentDirectoryItem[] = [];

  for (const sr of studentsRes.data ?? []) {
    const enrs = enrollmentsByStudent.get(sr.id) ?? [];

    if (
      input.sessionId &&
      !enrs.some((e) => e.academic_session_id === input.sessionId)
    ) {
      continue;
    }
    if (
      input.sectionId &&
      !enrs.some((e) => e.class_section_id === input.sectionId)
    ) {
      continue;
    }
    if (input.programId && !enrs.some((e) => e.programId === input.programId)) {
      continue;
    }

    if (q) {
      const hay = [
        sr.student_code,
        sr.full_name,
        sr.email ?? '',
        sr.phone ?? '',
        ...enrs.map((e) => `${e.className} ${e.sectionName} ${e.sessionName}`),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }

    filtered.push({ ...sr, enrollments: enrs });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const safePage = Math.min(Math.max(1, input.page), totalPages);
  const start = (safePage - 1) * input.pageSize;

  return {
    items: filtered.slice(start, start + input.pageSize),
    total,
    page: safePage,
    pageSize: input.pageSize,
    totalPages,
  };
}

export async function importStudentsFromCsv(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    fileName: string;
    csvText: string;
    defaultSessionId?: string | null | undefined;
    defaultSectionId?: string | null | undefined;
  },
): Promise<CsvImportSummary> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  const parsed = parseAndValidateStudentCsv(input.csvText);
  const errors: CsvImportRowError[] = [...parsed.errors];

  if (parsed.validRows.length === 0) {
    await supabase.from('csv_import_jobs').insert({
      institution_id: input.institutionId,
      uploaded_by: userId,
      entity_type: 'students',
      file_name: input.fileName,
      total_rows: parsed.totalRows,
      imported_count: 0,
      error_count: errors.length,
      errors,
    });
    return {
      totalRows: parsed.totalRows,
      validRows: 0,
      importedCount: 0,
      enrolledCount: 0,
      errorCount: errors.length,
      errors,
    };
  }

  const [existingRes, sessionsRes, classesRes, sectionsRes] = await Promise.all([
    supabase
      .from('student_records')
      .select('student_code, email')
      .eq('institution_id', input.institutionId),
    supabase.from('academic_sessions').select('*').eq('institution_id', input.institutionId),
    supabase.from('academic_classes').select('*').eq('institution_id', input.institutionId),
    supabase.from('class_sections').select('*').eq('institution_id', input.institutionId),
  ]);

  if (existingRes.error) throw new Error(existingRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (classesRes.error) throw new Error(classesRes.error.message);
  if (sectionsRes.error) throw new Error(sectionsRes.error.message);

  const existingCodes = new Set(
    (existingRes.data ?? []).map((r) => r.student_code.toLowerCase()),
  );
  const existingEmails = new Set(
    (existingRes.data ?? [])
      .map((r) => r.email?.toLowerCase())
      .filter((x): x is string => Boolean(x)),
  );

  const sessionByCode = new Map(
    (sessionsRes.data ?? []).map((s) => [s.code.toLowerCase(), s]),
  );
  const classByCode = new Map(
    (classesRes.data ?? []).map((c) => [c.code.toLowerCase(), c]),
  );
  const sectionByClassAndName = new Map<string, ClassSectionRow>();
  for (const sec of sectionsRes.data ?? []) {
    sectionByClassAndName.set(`${sec.class_id}:${sec.name.toLowerCase()}`, sec);
  }

  let importedCount = 0;
  let enrolledCount = 0;

  for (const row of parsed.validRows) {
    if (existingCodes.has(row.student_code.toLowerCase())) {
      errors.push({
        row: row.row,
        field: 'student_code',
        studentCode: row.student_code,
        message: `Student code "${row.student_code}" already exists in this institution`,
      });
      continue;
    }
    if (row.email && existingEmails.has(row.email.toLowerCase())) {
      errors.push({
        row: row.row,
        field: 'email',
        studentCode: row.student_code,
        message: `Email "${row.email}" already belongs to another student in this institution`,
      });
      continue;
    }

    // Resolve optional enrollment target within the SAME institution
    let targetSessionId = input.defaultSessionId ?? null;
    let targetSectionId = input.defaultSectionId ?? null;

    if (row.session_code) {
      const matchedSession = sessionByCode.get(row.session_code.toLowerCase());
      if (!matchedSession) {
        errors.push({
          row: row.row,
          field: 'session_code',
          studentCode: row.student_code,
          message: `Unknown session code "${row.session_code}"`,
        });
        continue;
      }
      targetSessionId = matchedSession.id;
    }

    if (row.class_code || row.section_name) {
      if (!row.class_code || !row.section_name) {
        errors.push({
          row: row.row,
          field: 'section_name',
          studentCode: row.student_code,
          message: 'Both class_code and section_name are required for CSV enrollment',
        });
        continue;
      }
      const cls = classByCode.get(row.class_code.toLowerCase());
      if (!cls) {
        errors.push({
          row: row.row,
          field: 'class_code',
          studentCode: row.student_code,
          message: `Unknown class code "${row.class_code}"`,
        });
        continue;
      }
      const sec = sectionByClassAndName.get(
        `${cls.id}:${row.section_name.toLowerCase()}`,
      );
      if (!sec) {
        errors.push({
          row: row.row,
          field: 'section_name',
          studentCode: row.student_code,
          message: `Section "${row.section_name}" not found under class "${row.class_code}"`,
        });
        continue;
      }
      targetSectionId = sec.id;
    }

    const { data: insertedStudent, error: insErr } = await supabase
      .from('student_records')
      .insert({
        institution_id: input.institutionId,
        student_code: row.student_code,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        created_by: userId,
      })
      .select('*')
      .single();

    if (insErr || !insertedStudent) {
      errors.push({
        row: row.row,
        studentCode: row.student_code,
        message: insErr?.message ?? 'Insert failed',
      });
      continue;
    }

    existingCodes.add(row.student_code.toLowerCase());
    if (row.email) existingEmails.add(row.email.toLowerCase());
    importedCount++;

    if (targetSessionId && targetSectionId) {
      const { error: enrErr } = await supabase.from('student_enrollments').insert({
        institution_id: input.institutionId,
        student_id: insertedStudent.id,
        academic_session_id: targetSessionId,
        class_section_id: targetSectionId,
        status: 'enrolled',
        enrolled_by: userId,
      });
      if (enrErr) {
        errors.push({
          row: row.row,
          studentCode: row.student_code,
          message: `Student created, but enrollment failed: ${enrErr.message}`,
        });
      } else {
        enrolledCount++;
      }
    }
  }

  await supabase.from('csv_import_jobs').insert({
    institution_id: input.institutionId,
    uploaded_by: userId,
    entity_type: 'students',
    file_name: input.fileName,
    total_rows: parsed.totalRows,
    imported_count: importedCount,
    error_count: errors.length,
    errors,
  });

  await logAcademicAudit(
    supabase,
    input.institutionId,
    userId,
    'students.csv_imported',
    'csv_import_job',
    null,
    {
      file_name: input.fileName,
      total_rows: parsed.totalRows,
      imported_count: importedCount,
      enrolled_count: enrolledCount,
      error_count: errors.length,
    },
  );

  return {
    totalRows: parsed.totalRows,
    validRows: parsed.validRows.length,
    importedCount,
    enrolledCount,
    errorCount: errors.length,
    errors,
  };
}

export async function listCsvImportJobs(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
): Promise<CsvImportJobRow[]> {
  await verifyInstitutionAccess(supabase, userId, institutionId, ['institution_admin']);
  const { data, error } = await supabase
    .from('csv_import_jobs')
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
}
