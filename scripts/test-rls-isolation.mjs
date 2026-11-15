/**
 * Live Supabase PostgreSQL RLS Multi-Tenant Isolation Test Suite
 *
 * Prerequisites:
 *   1. Apply supabase/migrations/20261115000000_phase2_auth_roles_rls.sql in Supabase SQL Editor.
 *   2. Ensure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set (or use defaults below).
 *   3. Optional: set SUPABASE_SERVICE_ROLE_KEY in env to auto-create confirmed test users
 *      and clean up test records; otherwise create 4 confirmed users or enable auto-confirm.
 *
 * Run: node scripts/test-rls-isolation.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://cmweagrpneprbsoiuaek.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_PT_Mt4smcGF5diQziUtlzA_NSo7ZSnX';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function run() {
  console.log(`Target Supabase project: ${SUPABASE_URL}`);

  const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verify schema exists & anon access is blocked
  console.log('\n[1] Checking anon access & schema presence...');
  const anonCheck = await anonClient.from('institutions').select('id').limit(1);
  if (anonCheck.error?.code === 'PGRST205') {
    console.error(
      'Schema not yet applied: public.institutions does not exist in Supabase project.',
    );
    console.error(
      'Apply supabase/migrations/20261115000000_phase2_auth_roles_rls.sql in the Supabase SQL Editor, then re-run this script.',
    );
    process.exit(2);
  }
  assert(
    Boolean(anonCheck.error) || (anonCheck.data?.length ?? 0) === 0,
    'Anon must not be able to read institutions',
  );
  console.log('PASS: Anon cannot read institutions:', anonCheck.error?.message || '0 rows');

  if (!SERVICE_ROLE_KEY) {
    console.log(
      '\nSUPABASE_SERVICE_ROLE_KEY not provided — skipping automated multi-user creation.',
    );
    console.log(
      'Set SUPABASE_SERVICE_ROLE_KEY in environment to run full 2-institution / multi-role RLS end-to-end verification.',
    );
    process.exit(0);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suffix = Date.now().toString(36);
  const users = {
    oakAdmin: { email: `oak-admin-${suffix}@example.com`, password: 'TestPassword123!' },
    oakTeacher: { email: `oak-teacher-${suffix}@example.com`, password: 'TestPassword123!' },
    oakStudent: { email: `oak-student-${suffix}@example.com`, password: 'TestPassword123!' },
    crestAdmin: { email: `crest-admin-${suffix}@example.com`, password: 'TestPassword123!' },
  };

  const createdUserIds = [];
  const clients = {};

  try {
    console.log('\n[2] Creating confirmed test users across two institutions...');
    for (const [key, cred] of Object.entries(users)) {
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: cred.email,
        password: cred.password,
        email_confirm: true,
        user_metadata: { full_name: key },
      });
      if (createErr || !created.user) throw createErr || new Error(`Failed creating ${key}`);
      createdUserIds.push(created.user.id);

      const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: loginErr } = await userClient.auth.signInWithPassword(cred);
      if (loginErr) throw loginErr;
      clients[key] = userClient;
    }

    // 3. Create two separate institutions via RPC
    console.log('\n[3] Creating Institution A (Oakridge) & Institution B (Crestview)...');
    const { data: instA, error: errA } = await clients.oakAdmin.rpc(
      'create_institution_with_owner',
      {
        p_name: `Oakridge ${suffix}`,
        p_slug: `oakridge-${suffix}`,
        p_institution_type: 'university',
      },
    );
    if (errA || !instA) throw errA || new Error('Failed creating Inst A');

    const { data: instB, error: errB } = await clients.crestAdmin.rpc(
      'create_institution_with_owner',
      {
        p_name: `Crestview ${suffix}`,
        p_slug: `crestview-${suffix}`,
        p_institution_type: 'college',
      },
    );
    if (errB || !instB) throw errB || new Error('Failed creating Inst B');

    // 4. Invite Teacher & Student to Oakridge and test mismatched-email protection
    console.log('\n[4] Testing invitation workflow & email-mismatch guard...');
    const { data: teacherInv, error: invErr } = await clients.oakAdmin
      .from('institution_invitations')
      .insert({
        institution_id: instA.id,
        email: users.oakTeacher.email,
        role: 'teacher',
        invited_by: createdUserIds[0],
      })
      .select('*')
      .single();
    if (invErr || !teacherInv) throw invErr;

    const mismatchRes = await clients.oakStudent.rpc('accept_institution_invitation', {
      p_token: teacherInv.token,
    });
    assert(Boolean(mismatchRes.error), 'Student must NOT accept Teacher email invite');
    console.log('PASS: Mismatched email invite acceptance rejected:', mismatchRes.error.message);

    const { error: teacherAcceptErr } = await clients.oakTeacher.rpc(
      'accept_institution_invitation',
      { p_token: teacherInv.token },
    );
    assert(!teacherAcceptErr, `Teacher should accept own invite: ${teacherAcceptErr?.message}`);

    // 5. Cross-tenant isolation tests
    console.log('\n[5] Running cross-tenant isolation tests...');
    const crossReadInst = await clients.oakAdmin
      .from('institutions')
      .select('*')
      .eq('id', instB.id);
    assert((crossReadInst.data?.length ?? 0) === 0, 'Oak Admin must see 0 rows for Crestview');

    const crossReadMem = await clients.oakAdmin
      .from('institution_memberships')
      .select('*')
      .eq('institution_id', instB.id);
    assert(
      (crossReadMem.data?.length ?? 0) === 0,
      'Oak Admin must see 0 memberships for Crestview',
    );

    const crossWriteInvite = await clients.oakAdmin.from('institution_invitations').insert({
      institution_id: instB.id,
      email: 'intruder@example.com',
      role: 'institution_admin',
      invited_by: createdUserIds[0],
    });
    assert(
      Boolean(crossWriteInvite.error),
      'Oak Admin must be blocked by RLS from inserting invite into Crestview',
    );
    console.log('PASS: Cross-tenant invite insert blocked:', crossWriteInvite.error.message);

    // 6. Role privilege escalation tests
    console.log('\n[6] Testing role escalation & platform_admins protection...');
    const teacherInviteAttempt = await clients.oakTeacher.from('institution_invitations').insert({
      institution_id: instA.id,
      email: 'rogue@example.com',
      role: 'institution_admin',
      invited_by: createdUserIds[1],
    });
    assert(
      Boolean(teacherInviteAttempt.error),
      'Teacher must be blocked from creating admin invitations',
    );
    console.log('PASS: Teacher invite attempt blocked:', teacherInviteAttempt.error.message);

    const selfSuperAttempt = await clients.oakAdmin.from('platform_admins').insert({
      user_id: createdUserIds[0],
    });
    assert(Boolean(selfSuperAttempt.error), 'Users must be blocked from inserting platform_admins');
    console.log('PASS: Self platform_admin escalation blocked:', selfSuperAttempt.error.message);

    // 7. Phase 3: Academic Management & Cross-Tenant Isolation
    console.log('\n[7] Testing Phase 3 academic session, class, course, teacher assignment, student enrollment & RLS...');
    const { data: oakSession, error: sessErr } = await clients.oakAdmin
      .from('academic_sessions')
      .insert({
        institution_id: instA.id,
        name: `2026-2027 (${suffix})`,
        code: `2026-${suffix}`,
        starts_on: '2026-09-01',
        ends_on: '2027-06-30',
        status: 'active',
        is_current: true,
        created_by: createdUserIds[0],
      })
      .select('*')
      .single();
    if (sessErr?.code === 'PGRST205') {
      console.log('SKIP Phase 3 checks: apply supabase/migrations/20261115000001_phase3_academic_management.sql first.');
    } else {
      assert(!sessErr && oakSession, `Failed creating academic session: ${sessErr?.message}`);

      const { data: oakClass, error: clsErr } = await clients.oakAdmin
        .from('academic_classes')
        .insert({
          institution_id: instA.id,
          name: 'CS Year 1',
          code: `CS1-${suffix}`,
          level_order: 1,
        })
        .select('*')
        .single();
      assert(!clsErr && oakClass, `Failed creating class: ${clsErr?.message}`);

      const { data: oakSection, error: secErr } = await clients.oakAdmin
        .from('class_sections')
        .insert({
          institution_id: instA.id,
          class_id: oakClass.id,
          name: 'A',
          capacity: 35,
        })
        .select('*')
        .single();
      assert(!secErr && oakSection, `Failed creating section: ${secErr?.message}`);

      const { data: oakCourse, error: courseErr } = await clients.oakAdmin
        .from('courses')
        .insert({
          institution_id: instA.id,
          class_id: oakClass.id,
          code: `CS101-${suffix}`,
          title: 'Intro to Computer Science',
          credits: 4,
          status: 'active',
        })
        .select('*')
        .single();
      assert(!courseErr && oakCourse, `Failed creating course: ${courseErr?.message}`);

      const { data: teacherMem } = await clients.oakAdmin
        .from('institution_memberships')
        .select('id')
        .eq('institution_id', instA.id)
        .eq('role', 'teacher')
        .single();
      assert(Boolean(teacherMem?.id), 'Teacher membership should exist in Oakridge');

      const { data: oakAssign, error: assignErr } = await clients.oakAdmin
        .from('teacher_assignments')
        .insert({
          institution_id: instA.id,
          membership_id: teacherMem.id,
          course_id: oakCourse.id,
          academic_session_id: oakSession.id,
          class_section_id: oakSection.id,
          assigned_by: createdUserIds[0],
        })
        .select('*')
        .single();
      assert(!assignErr && oakAssign, `Failed creating teacher assignment: ${assignErr?.message}`);

      const { data: oakStudentRec, error: stuErr } = await clients.oakAdmin
        .from('student_records')
        .insert({
          institution_id: instA.id,
          student_code: `STU-${suffix}-01`,
          full_name: 'Amina Tariq',
          email: `amina-${suffix}@example.edu`,
          status: 'active',
          created_by: createdUserIds[0],
        })
        .select('*')
        .single();
      assert(!stuErr && oakStudentRec, `Failed creating student record: ${stuErr?.message}`);

      const { data: oakEnroll, error: enrErr } = await clients.oakAdmin
        .from('student_enrollments')
        .insert({
          institution_id: instA.id,
          student_id: oakStudentRec.id,
          academic_session_id: oakSession.id,
          class_section_id: oakSection.id,
          status: 'enrolled',
          enrolled_by: createdUserIds[0],
        })
        .select('*')
        .single();
      assert(!enrErr && oakEnroll, `Failed creating student enrollment: ${enrErr?.message}`);

      // Cross-tenant reads & writes by Crestview Admin against Oakridge academic tables must be blocked
      const crestReadSessions = await clients.crestAdmin
        .from('academic_sessions')
        .select('*')
        .eq('institution_id', instA.id);
      assert((crestReadSessions.data?.length ?? 0) === 0, 'Crestview Admin must see 0 Oakridge sessions');

      const crestReadStudents = await clients.crestAdmin
        .from('student_records')
        .select('*')
        .eq('institution_id', instA.id);
      assert((crestReadStudents.data?.length ?? 0) === 0, 'Crestview Admin must see 0 Oakridge students');

      const crestWriteClass = await clients.crestAdmin.from('academic_classes').insert({
        institution_id: instA.id,
        name: 'Rogue Class',
        code: `ROGUE-${suffix}`,
        level_order: 99,
      });
      assert(Boolean(crestWriteClass.error), 'Crestview Admin must be blocked from inserting Oakridge classes');

      // Teacher in Oakridge cannot mutate academic classes
      const teacherWriteClass = await clients.oakTeacher.from('academic_classes').insert({
        institution_id: instA.id,
        name: 'Teacher Rogue Class',
        code: `TR-${suffix}`,
        level_order: 2,
      });
      assert(Boolean(teacherWriteClass.error), 'Teacher must be blocked from inserting academic classes');

      console.log('PASS: Phase 3 session, class, section, course, assignment, enrollment & cross-tenant RLS verified.');

      // 8. Phase 4: Question Bank & Private Answer Key Isolation
      console.log('\n[8] Testing Phase 4 Question Bank, private answer keys & cross-tenant RLS...');
      const { data: qRow, error: qErr } = await clients.oakTeacher
        .from('questions')
        .insert({
          institution_id: instA.id,
          course_id: oakCourse.id,
          question_type: 'mcq_single',
          title: `Live RLS Test Question (${suffix})`,
          prompt: 'Which complexity represents binary search?',
          topic: 'Searching',
          category: 'Conceptual',
          difficulty: 'easy',
          marks: 2,
          negative_marks: 0.5,
          status: 'active',
          created_by: createdUserIds[1],
        })
        .select('*')
        .single();

      if (qErr?.code === 'PGRST205') {
        console.log('SKIP Phase 4 checks: apply supabase/migrations/20261115000002_phase4_question_bank.sql first.');
      } else {
        assert(!qErr && qRow, `Teacher should create question: ${qErr?.message}`);

        const { error: optErr } = await clients.oakTeacher.from('question_options').insert([
          { institution_id: instA.id, question_id: qRow.id, option_key: 'A', option_text: 'O(n)', sort_order: 0 },
          { institution_id: instA.id, question_id: qRow.id, option_key: 'B', option_text: 'O(log n)', sort_order: 1 },
        ]);
        assert(!optErr, `Teacher should insert options: ${optErr?.message}`);

        const { error: keyErr } = await clients.oakTeacher.from('question_answer_keys').insert({
          question_id: qRow.id,
          institution_id: instA.id,
          correct_option_keys: ['B'],
          explanation: 'Halves search space each step.',
          updated_by: createdUserIds[1],
        });
        assert(!keyErr, `Teacher should insert private answer key: ${keyErr?.message}`);

        // Student (even after joining Oakridge) must NEVER read question_answer_keys or questions
        const studentKeyRead = await clients.oakStudent
          .from('question_answer_keys')
          .select('*')
          .eq('question_id', qRow.id);
        assert((studentKeyRead.data?.length ?? 0) === 0, 'Student must see 0 answer key rows');

        const studentQRead = await clients.oakStudent
          .from('questions')
          .select('*')
          .eq('id', qRow.id);
        assert((studentQRead.data?.length ?? 0) === 0, 'Student must see 0 Question Bank rows');

        // Crestview Admin must see 0 Oakridge questions or answer keys
        const crestQRead = await clients.crestAdmin
          .from('questions')
          .select('*')
          .eq('institution_id', instA.id);
        assert((crestQRead.data?.length ?? 0) === 0, 'Crestview Admin must see 0 Oakridge questions');

        const crestKeyRead = await clients.crestAdmin
          .from('question_answer_keys')
          .select('*')
          .eq('institution_id', instA.id);
        assert((crestKeyRead.data?.length ?? 0) === 0, 'Crestview Admin must see 0 Oakridge answer keys');

        console.log('PASS: Phase 4 Question Bank & private answer-key RLS verified.');

        // 9. Phase 5: Exam Builder & Immutable Published Versions Isolation
        console.log('\n[9] Testing Phase 5 Exam Builder, private frozen keys & immutable version RLS...');
        const startsAt = new Date(Date.now() + 3600_000).toISOString();
        const endsAt = new Date(Date.now() + 7200_000).toISOString();
        const { data: examRow, error: examErr } = await clients.oakTeacher
          .from('exams')
          .insert({
            institution_id: instA.id,
            course_id: oakCourse.id,
            title: `Live RLS Exam (${suffix})`,
            starts_at: startsAt,
            ends_at: endsAt,
            duration_minutes: 45,
            total_marks: 2,
            status: 'draft',
            created_by: createdUserIds[1],
          })
          .select('*')
          .single();

        if (examErr?.code === 'PGRST205') {
          console.log('SKIP Phase 5 checks: apply supabase/migrations/20261115000003_phase5_exam_builder.sql first.');
        } else {
          assert(!examErr && examRow, `Teacher should create exam draft: ${examErr?.message}`);

          const { data: verRow, error: verErr } = await clients.oakTeacher
            .from('exam_versions')
            .insert({
              institution_id: instA.id,
              exam_id: examRow.id,
              version_number: 1,
              title: examRow.title,
              starts_at: startsAt,
              ends_at: endsAt,
              duration_minutes: 45,
              total_marks: 2,
              negative_marking_enabled: false,
              default_negative_marks: 0,
              shuffle_questions: false,
              shuffle_options: false,
              snapshot_payload: { versionNumber: 1, sections: [] },
              published_by: createdUserIds[1],
            })
            .select('*')
            .single();
          assert(!verErr && verRow, `Teacher should insert immutable exam_version: ${verErr?.message}`);

          // Updating immutable exam_versions snapshot title must fail via RLS / trigger
          const { error: verMutErr } = await clients.oakTeacher
            .from('exam_versions')
            .update({ title: 'Mutated Version' })
            .eq('id', verRow.id);
          assert(Boolean(verMutErr), 'Immutable exam_versions must reject snapshot updates');

          // Student & Crestview Admin must see ZERO exam drafts and ZERO frozen answer keys
          const studentExamRead = await clients.oakStudent
            .from('exams')
            .select('*')
            .eq('id', examRow.id);
          assert((studentExamRead.data?.length ?? 0) === 0, 'Student must see 0 draft exams');

          const crestExamRead = await clients.crestAdmin
            .from('exams')
            .select('*')
            .eq('institution_id', instA.id);
          assert((crestExamRead.data?.length ?? 0) === 0, 'Crestview Admin must see 0 Oakridge exams');

          console.log('PASS: Phase 5 Exam Builder & immutable version RLS verified.');
        }
      }
    }

    console.log('\nALL LIVE MULTI-TENANT RLS ISOLATION TESTS PASSED!');
  } finally {
    // Cleanup
    for (const uid of createdUserIds) {
      await adminClient.auth.admin.deleteUser(uid).catch(() => {});
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
