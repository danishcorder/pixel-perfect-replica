import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  InstitutionRole,
  InstitutionStatus,
  InvitationStatus,
  MembershipStatus,
} from '@/integrations/supabase/types';

export type AuthedSupabase = SupabaseClient<Database>;

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type InstitutionRow = Database['public']['Tables']['institutions']['Row'];
export type MembershipRow = Database['public']['Tables']['institution_memberships']['Row'];
export type InvitationRow = Database['public']['Tables']['institution_invitations']['Row'];
export type AuditLogRow = Database['public']['Tables']['institution_audit_logs']['Row'];

export type MembershipWithInstitution = MembershipRow & {
  institution: InstitutionRow;
};

export type PendingInvitationSummary = {
  id: string;
  institution_id: string;
  institution_name: string;
  institution_slug: string;
  email: string;
  role: InstitutionRole;
  token: string;
  expires_at: string;
  created_at: string;
};

export type WorkspaceBootstrap = {
  profile: ProfileRow;
  isSuperAdmin: boolean;
  memberships: MembershipWithInstitution[];
  pendingInvitations: PendingInvitationSummary[];
};

export type MemberWithProfile = MembershipRow & {
  profile: Pick<ProfileRow, 'id' | 'email' | 'full_name' | 'phone' | 'timezone'> | null;
};

export type InstitutionWorkspaceData = {
  institution: InstitutionRow;
  myMembership: MembershipRow | null;
  isSuperAdmin: boolean;
  members: MemberWithProfile[];
  invitations: InvitationRow[];
  auditLogs: AuditLogRow[];
};

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

export async function verifyIsPlatformAdmin(
  supabase: AuthedSupabase,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify platform admin status: ${error.message}`);
  }
  return Boolean(data);
}

export async function verifyInstitutionAccess(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
  allowedRoles?: InstitutionRole[],
): Promise<{
  isSuperAdmin: boolean;
  membership: MembershipRow | null;
  institution: InstitutionRow;
}> {
  const [isSuperAdmin, instRes, memRes] = await Promise.all([
    verifyIsPlatformAdmin(supabase, userId),
    supabase.from('institutions').select('*').eq('id', institutionId).maybeSingle(),
    supabase
      .from('institution_memberships')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (instRes.error) {
    throw new Error(instRes.error.message);
  }
  if (memRes.error) {
    throw new Error(memRes.error.message);
  }

  const institution = instRes.data;
  const membership = memRes.data;

  if (!institution) {
    throw new AuthorizationError('Institution not found or access denied', 403);
  }

  if (!isSuperAdmin) {
    if (!membership || membership.status !== 'active') {
      throw new AuthorizationError('You do not belong to this institution', 403);
    }
    if (institution.status !== 'active') {
      throw new AuthorizationError('This institution is currently suspended', 403);
    }
    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new AuthorizationError(
        `Insufficient permissions: requires ${allowedRoles.join(' or ')}`,
        403,
      );
    }
  }

  return { isSuperAdmin, membership, institution };
}

export async function loadWorkspaceBootstrap(
  supabase: AuthedSupabase,
  userId: string,
  userEmail: string,
  fallbackFullName = '',
): Promise<WorkspaceBootstrap> {
  // Ensure profile exists for users created before migration or via OAuth
  let { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    throw new Error(`Failed to load profile: ${profileErr.message}`);
  }

  if (!profile) {
    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: userEmail.toLowerCase(),
        full_name: fallbackFullName,
      })
      .select('*')
      .single();

    if (insertErr || !created) {
      throw new Error(`Failed to initialize user profile: ${insertErr?.message ?? 'unknown'}`);
    }
    profile = created;
  }

  const [isSuperAdmin, membershipsRes, invitesRes] = await Promise.all([
    verifyIsPlatformAdmin(supabase, userId),
    supabase
      .from('institution_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    supabase.rpc('get_my_pending_invitations'),
  ]);

  if (membershipsRes.error) {
    throw new Error(`Failed to load memberships: ${membershipsRes.error.message}`);
  }

  const rawMemberships = membershipsRes.data ?? [];
  const institutionIds = rawMemberships.map((m) => m.institution_id);
  let institutionsById = new Map<string, InstitutionRow>();

  if (institutionIds.length > 0) {
    const { data: instRows, error: instErr } = await supabase
      .from('institutions')
      .select('*')
      .in('id', institutionIds);

    if (instErr) {
      throw new Error(`Failed to load institutions: ${instErr.message}`);
    }
    institutionsById = new Map((instRows ?? []).map((inst) => [inst.id, inst]));
  }

  const memberships: MembershipWithInstitution[] = [];
  for (const m of rawMemberships) {
    const inst = institutionsById.get(m.institution_id);
    if (inst && inst.status === 'active') {
      memberships.push({ ...m, institution: inst });
    }
  }

  const pendingInvitations: PendingInvitationSummary[] = invitesRes.error
    ? []
    : (invitesRes.data ?? []);

  return {
    profile,
    isSuperAdmin,
    memberships,
    pendingInvitations,
  };
}

export async function loadInstitutionWorkspace(
  supabase: AuthedSupabase,
  userId: string,
  institutionId: string,
): Promise<InstitutionWorkspaceData> {
  const { isSuperAdmin, membership, institution } = await verifyInstitutionAccess(
    supabase,
    userId,
    institutionId,
  );

  const canManage = isSuperAdmin || membership?.role === 'institution_admin';
  if (!canManage) {
    return {
      institution,
      myMembership: membership,
      isSuperAdmin,
      members: [],
      invitations: [],
      auditLogs: [],
    };
  }

  const [membersRes, invitationsRes, auditRes] = await Promise.all([
    supabase
      .from('institution_memberships')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('institution_invitations')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false }),
    supabase
      .from('institution_audit_logs')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (membersRes.error) throw new Error(membersRes.error.message);
  if (invitationsRes.error) throw new Error(invitationsRes.error.message);
  if (auditRes.error) throw new Error(auditRes.error.message);

  const memberRows = membersRes.data ?? [];
  const userIds = Array.from(new Set(memberRows.map((m) => m.user_id)));

  let profilesMap = new Map<string, Pick<ProfileRow, 'id' | 'email' | 'full_name' | 'phone' | 'timezone'>>();
  if (userIds.length > 0) {
    const { data: profilesData, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, timezone')
      .in('id', userIds);
    if (profErr) throw new Error(profErr.message);
    profilesMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
  }

  const members: MemberWithProfile[] = memberRows.map((m) => ({
    ...m,
    profile: profilesMap.get(m.user_id) ?? null,
  }));

  return {
    institution,
    myMembership: membership,
    isSuperAdmin,
    members,
    invitations: invitationsRes.data ?? [],
    auditLogs: auditRes.data ?? [],
  };
}

export async function createInstitutionInvite(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; email: string; role: InstitutionRole },
): Promise<InvitationRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  const normalizedEmail = input.email.trim().toLowerCase();
  const { data: invite, error } = await supabase
    .from('institution_invitations')
    .insert({
      institution_id: input.institutionId,
      email: normalizedEmail,
      role: input.role,
      invited_by: userId,
    })
    .select('*')
    .single();

  if (error || !invite) {
    throw new Error(error?.message ?? 'Failed to create invitation');
  }

  await supabase.from('institution_audit_logs').insert({
    institution_id: input.institutionId,
    actor_user_id: userId,
    action: 'invitation.created',
    target_type: 'institution_invitation',
    target_id: invite.id,
    metadata: { email: normalizedEmail, role: input.role },
  });

  return invite;
}

export async function revokeInstitutionInvite(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; invitationId: string },
): Promise<void> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  const { data: updated, error } = await supabase
    .from('institution_invitations')
    .update({ status: 'revoked' satisfies InvitationStatus })
    .eq('id', input.invitationId)
    .eq('institution_id', input.institutionId)
    .eq('status', 'pending')
    .select('id, email')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw new AuthorizationError('Pending invitation not found in this institution', 404);

  await supabase.from('institution_audit_logs').insert({
    institution_id: input.institutionId,
    actor_user_id: userId,
    action: 'invitation.revoked',
    target_type: 'institution_invitation',
    target_id: updated.id,
    metadata: { email: updated.email },
  });
}

export async function updateInstitutionMember(
  supabase: AuthedSupabase,
  userId: string,
  input: {
    institutionId: string;
    membershipId: string;
    role?: InstitutionRole | undefined;
    status?: MembershipStatus | undefined;
  },
): Promise<MembershipRow> {
  await verifyInstitutionAccess(supabase, userId, input.institutionId, ['institution_admin']);

  const patch: { role?: InstitutionRole; status?: MembershipStatus } = {};
  if (input.role !== undefined) patch.role = input.role;
  if (input.status !== undefined) patch.status = input.status;

  const { data: updated, error } = await supabase
    .from('institution_memberships')
    .update(patch)
    .eq('id', input.membershipId)
    .eq('institution_id', input.institutionId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw new AuthorizationError('Membership not found in this institution', 404);

  await supabase.from('institution_audit_logs').insert({
    institution_id: input.institutionId,
    actor_user_id: userId,
    action: 'membership.updated',
    target_type: 'institution_membership',
    target_id: updated.id,
    metadata: patch,
  });

  return updated;
}

export async function removeInstitutionMember(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; membershipId: string },
): Promise<void> {
  const { isSuperAdmin, membership: actorMembership } = await verifyInstitutionAccess(
    supabase,
    userId,
    input.institutionId,
  );

  // Check target membership inside the verified institution
  const { data: target, error: targetErr } = await supabase
    .from('institution_memberships')
    .select('*')
    .eq('id', input.membershipId)
    .eq('institution_id', input.institutionId)
    .maybeSingle();

  if (targetErr) throw new Error(targetErr.message);
  if (!target) throw new AuthorizationError('Membership not found in this institution', 404);

  const isSelfLeave = target.user_id === userId;
  const isAdmin = isSuperAdmin || actorMembership?.role === 'institution_admin';
  if (!isSelfLeave && !isAdmin) {
    throw new AuthorizationError('Only Institution Admins can remove other members', 403);
  }

  const { error: delErr } = await supabase
    .from('institution_memberships')
    .delete()
    .eq('id', input.membershipId)
    .eq('institution_id', input.institutionId);

  if (delErr) throw new Error(delErr.message);

  if (isAdmin) {
    await supabase.from('institution_audit_logs').insert({
      institution_id: input.institutionId,
      actor_user_id: userId,
      action: isSelfLeave ? 'membership.left' : 'membership.removed',
      target_type: 'institution_membership',
      target_id: target.id,
      metadata: { target_user_id: target.user_id, role: target.role },
    });
  }
}

export async function loadPlatformOverview(
  supabase: AuthedSupabase,
  userId: string,
): Promise<{
  institutions: Array<InstitutionRow & { memberCount: number }>;
  totalMemberships: number;
}> {
  const isSuperAdmin = await verifyIsPlatformAdmin(supabase, userId);
  if (!isSuperAdmin) {
    throw new AuthorizationError('Platform Super Admin access required', 403);
  }

  const [instRes, memRes] = await Promise.all([
    supabase.from('institutions').select('*').order('created_at', { ascending: false }),
    supabase.from('institution_memberships').select('institution_id, status'),
  ]);

  if (instRes.error) throw new Error(instRes.error.message);
  if (memRes.error) throw new Error(memRes.error.message);

  const counts = new Map<string, number>();
  for (const m of memRes.data ?? []) {
    if (m.status === 'active') {
      counts.set(m.institution_id, (counts.get(m.institution_id) ?? 0) + 1);
    }
  }

  return {
    institutions: (instRes.data ?? []).map((inst) => ({
      ...inst,
      memberCount: counts.get(inst.id) ?? 0,
    })),
    totalMemberships: (memRes.data ?? []).filter((m) => m.status === 'active').length,
  };
}

export async function setInstitutionStatus(
  supabase: AuthedSupabase,
  userId: string,
  input: { institutionId: string; status: InstitutionStatus },
): Promise<InstitutionRow> {
  const isSuperAdmin = await verifyIsPlatformAdmin(supabase, userId);
  if (!isSuperAdmin) {
    throw new AuthorizationError('Platform Super Admin access required', 403);
  }

  const { data: updated, error } = await supabase
    .from('institutions')
    .update({ status: input.status })
    .eq('id', input.institutionId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw new AuthorizationError('Institution not found', 404);

  await supabase.from('institution_audit_logs').insert({
    institution_id: input.institutionId,
    actor_user_id: userId,
    action: `institution.${input.status}`,
    target_type: 'institution',
    target_id: input.institutionId,
    metadata: { status: input.status },
  });

  return updated;
}
