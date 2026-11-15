import { describe, expect, it } from 'vitest';
import {
  AuthorizationError,
  createInstitutionInvite,
  loadInstitutionWorkspace,
  loadPlatformOverview,
  removeInstitutionMember,
  setInstitutionStatus,
  updateInstitutionMember,
  verifyInstitutionAccess,
  type AuthedSupabase,
} from '@/lib/workspace.server';
import type { InstitutionRole, InstitutionStatus } from '@/integrations/supabase/types';

type MockDataset = {
  platformAdmins: Array<{ user_id: string }>;
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
  memberships: Array<{
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
  invitations: Array<{
    id: string;
    institution_id: string;
    email: string;
    role: InstitutionRole;
    token: string;
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
    invited_by: string;
    accepted_by: string | null;
    expires_at: string;
    created_at: string;
    accepted_at: string | null;
  }>;
  auditLogs: Array<{
    id: string;
    institution_id: string;
    actor_user_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
};

function makeSeedData(): MockDataset {
  const now = '2026-11-15T00:00:00.000Z';
  return {
    platformAdmins: [{ user_id: 'user-super' }],
    institutions: [
      {
        id: 'inst-oakridge',
        name: 'Oakridge University',
        slug: 'oakridge',
        institution_type: 'university',
        status: 'active',
        created_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'inst-crestview',
        name: 'Crestview College',
        slug: 'crestview',
        institution_type: 'college',
        status: 'active',
        created_by: 'user-crest-admin',
        created_at: now,
        updated_at: now,
      },
    ],
    memberships: [
      {
        id: 'mem-oak-admin',
        institution_id: 'inst-oakridge',
        user_id: 'user-oak-admin',
        role: 'institution_admin',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-oak-teacher',
        institution_id: 'inst-oakridge',
        user_id: 'user-oak-teacher',
        role: 'teacher',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-oak-student',
        institution_id: 'inst-oakridge',
        user_id: 'user-oak-student',
        role: 'student',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-oak-invigilator',
        institution_id: 'inst-oakridge',
        user_id: 'user-oak-invigilator',
        role: 'invigilator',
        status: 'active',
        invited_by: 'user-oak-admin',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mem-crest-admin',
        institution_id: 'inst-crestview',
        user_id: 'user-crest-admin',
        role: 'institution_admin',
        status: 'active',
        invited_by: 'user-crest-admin',
        created_at: now,
        updated_at: now,
      },
    ],
    profiles: [
      { id: 'user-oak-admin', email: 'admin@oakridge.edu', full_name: 'Oak Admin', phone: null, timezone: 'UTC' },
      { id: 'user-oak-teacher', email: 'teacher@oakridge.edu', full_name: 'Oak Teacher', phone: null, timezone: 'UTC' },
      { id: 'user-oak-student', email: 'student@oakridge.edu', full_name: 'Oak Student', phone: null, timezone: 'UTC' },
      { id: 'user-oak-invigilator', email: 'invig@oakridge.edu', full_name: 'Oak Invigilator', phone: null, timezone: 'UTC' },
      { id: 'user-crest-admin', email: 'admin@crestview.edu', full_name: 'Crest Admin', phone: null, timezone: 'UTC' },
    ],
    invitations: [],
    auditLogs: [],
  };
}

/**
 * Simulates RLS-enforced Supabase client for a specific authenticated user.
 */
function createRlsMockClient(db: MockDataset, actorId: string): AuthedSupabase {
  const isSuper = () => db.platformAdmins.some((p) => p.user_id === actorId);
  const isMember = (instId: string) =>
    db.memberships.some(
      (m) => m.institution_id === instId && m.user_id === actorId && m.status === 'active',
    );
  const isInstAdmin = (instId: string) =>
    db.memberships.some(
      (m) =>
        m.institution_id === instId &&
        m.user_id === actorId &&
        m.role === 'institution_admin' &&
        m.status === 'active',
    );

  const tableRows = (table: string): Record<string, unknown>[] => {
    switch (table) {
      case 'platform_admins':
        return isSuper()
          ? db.platformAdmins
          : db.platformAdmins.filter((p) => p.user_id === actorId);
      case 'institutions':
        return db.institutions.filter((i) => isSuper() || isMember(i.id));
      case 'institution_memberships':
        return db.memberships.filter(
          (m) => m.user_id === actorId || isSuper() || isMember(m.institution_id),
        );
      case 'profiles':
        return db.profiles.filter(
          (p) =>
            p.id === actorId ||
            isSuper() ||
            db.memberships.some(
              (m1) =>
                m1.user_id === actorId &&
                m1.status === 'active' &&
                db.memberships.some(
                  (m2) =>
                    m2.institution_id === m1.institution_id &&
                    m2.user_id === p.id &&
                    m2.status === 'active',
                ),
            ),
        );
      case 'institution_invitations':
        return db.invitations.filter(
          (inv) => isSuper() || isInstAdmin(inv.institution_id),
        );
      case 'institution_audit_logs':
        return db.auditLogs.filter(
          (log) => isSuper() || isInstAdmin(log.institution_id),
        );
      default:
        return [];
    }
  };

  function makeQueryBuilder(table: string) {
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
        return { data: applyFilters(tableRows(table)), error: null };
      }
      if (mode === 'insert' && payload) {
        const instId = String(payload['institution_id'] ?? '');
        if (
          (table === 'institution_invitations' || table === 'institution_audit_logs') &&
          !isSuper() &&
          !isInstAdmin(instId)
        ) {
          return { data: null, error: { message: 'new row violates row-level security policy' } };
        }
        const created = {
          id: `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          token: 'tok_' + Math.random().toString(36).slice(2, 14),
          status: 'pending',
          expires_at: '2026-11-22T00:00:00.000Z',
          created_at: '2026-11-15T00:00:00.000Z',
          accepted_by: null,
          accepted_at: null,
          ...payload,
        };
        if (table === 'institution_invitations') {
          db.invitations.push(created as unknown as MockDataset['invitations'][number]);
        } else if (table === 'institution_audit_logs') {
          db.auditLogs.push(created as unknown as MockDataset['auditLogs'][number]);
        }
        return { data: [created], error: null };
      }
      if (mode === 'update' && payload) {
        const rows = applyFilters(tableRows(table));
        for (const r of rows) {
          Object.assign(r, payload);
        }
        return { data: rows, error: null };
      }
      if (mode === 'delete') {
        const rows = applyFilters(tableRows(table));
        if (table === 'institution_memberships') {
          const ids = new Set(rows.map((r) => r['id']));
          db.memberships = db.memberships.filter((m) => !ids.has(m.id));
        }
        return { data: rows, error: null };
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
    from: (table: string) => makeQueryBuilder(table),
  } as unknown as AuthedSupabase;
}

describe('Phase 2 multi-tenant & role authorization isolation', () => {
  it('blocks Institution A Admin from reading or mutating Institution B', async () => {
    const db = makeSeedData();
    const oakAdminClient = createRlsMockClient(db, 'user-oak-admin');

    // Legitimate access to Oakridge works
    const ok = await verifyInstitutionAccess(oakAdminClient, 'user-oak-admin', 'inst-oakridge', [
      'institution_admin',
    ]);
    expect(ok.institution.id).toBe('inst-oakridge');

    // Cross-tenant access to Crestview by changing institutionId is rejected
    await expect(
      loadInstitutionWorkspace(oakAdminClient, 'user-oak-admin', 'inst-crestview'),
    ).rejects.toThrow(AuthorizationError);

    // Cross-tenant invite attempt targeting Crestview is rejected
    await expect(
      createInstitutionInvite(oakAdminClient, 'user-oak-admin', {
        institutionId: 'inst-crestview',
        email: 'attacker@oakridge.edu',
        role: 'institution_admin',
      }),
    ).rejects.toThrow(AuthorizationError);

    // Cross-tenant membership mutation targeting Crestview is rejected
    await expect(
      updateInstitutionMember(oakAdminClient, 'user-oak-admin', {
        institutionId: 'inst-crestview',
        membershipId: 'mem-crest-admin',
        role: 'student',
      }),
    ).rejects.toThrow(AuthorizationError);

    expect(db.invitations).toHaveLength(0);
    expect(db.memberships.find((m) => m.id === 'mem-crest-admin')?.role).toBe('institution_admin');
  });

  it('blocks Teacher, Student, and Invigilator from admin actions inside their own institution', async () => {
    const db = makeSeedData();

    for (const userId of ['user-oak-teacher', 'user-oak-student', 'user-oak-invigilator']) {
      const client = createRlsMockClient(db, userId);

      // Non-admin workspace load returns only self-scoped metadata, no member directory/invites/audit logs
      const ws = await loadInstitutionWorkspace(client, userId, 'inst-oakridge');
      expect(ws.members).toEqual([]);
      expect(ws.invitations).toEqual([]);
      expect(ws.auditLogs).toEqual([]);

      // Cannot invite members
      await expect(
        createInstitutionInvite(client, userId, {
          institutionId: 'inst-oakridge',
          email: 'newbie@oakridge.edu',
          role: 'institution_admin',
        }),
      ).rejects.toThrow(AuthorizationError);

      // Cannot remove another member
      await expect(
        removeInstitutionMember(client, userId, {
          institutionId: 'inst-oakridge',
          membershipId: 'mem-oak-admin',
        }),
      ).rejects.toThrow(AuthorizationError);

      // Cannot access Platform Super Admin overview
      await expect(loadPlatformOverview(client, userId)).rejects.toThrow(AuthorizationError);
    }
  });

  it('allows Institution Admin to invite within their own institution and Platform Super Admin to govern institutions', async () => {
    const db = makeSeedData();
    const oakAdminClient = createRlsMockClient(db, 'user-oak-admin');
    const superClient = createRlsMockClient(db, 'user-super');

    const invite = await createInstitutionInvite(oakAdminClient, 'user-oak-admin', {
      institutionId: 'inst-oakridge',
      email: 'prof.smith@oakridge.edu',
      role: 'teacher',
    });
    expect(invite.institution_id).toBe('inst-oakridge');
    expect(invite.role).toBe('teacher');

    // Institution Admin still cannot suspend/unsuspend at platform level
    await expect(
      setInstitutionStatus(oakAdminClient, 'user-oak-admin', {
        institutionId: 'inst-crestview',
        status: 'suspended',
      }),
    ).rejects.toThrow(AuthorizationError);

    // Super Admin can view all institutions and suspend Crestview
    const overview = await loadPlatformOverview(superClient, 'user-super');
    expect(overview.institutions).toHaveLength(2);

    const suspended = await setInstitutionStatus(superClient, 'user-super', {
      institutionId: 'inst-crestview',
      status: 'suspended',
    });
    expect(suspended.status).toBe('suspended');

    // Once suspended, Crestview Admin is blocked from accessing the suspended tenant
    const crestClient = createRlsMockClient(db, 'user-crest-admin');
    await expect(
      loadInstitutionWorkspace(crestClient, 'user-crest-admin', 'inst-crestview'),
    ).rejects.toThrow(/suspended/i);
  });
});
