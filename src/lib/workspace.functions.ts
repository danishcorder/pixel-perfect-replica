import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import {
  createInstitutionInvite,
  loadInstitutionWorkspace,
  loadPlatformOverview,
  loadWorkspaceBootstrap,
  removeInstitutionMember,
  revokeInstitutionInvite,
  setInstitutionStatus,
  updateInstitutionMember,
} from './workspace.server';

const institutionRoleSchema = z.enum([
  'institution_admin',
  'teacher',
  'student',
  'invigilator',
]);

const membershipStatusSchema = z.enum(['active', 'suspended']);
const institutionStatusSchema = z.enum(['active', 'suspended']);

export const getWorkspaceBootstrapFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as Record<string, unknown>)['email'] ?? '');
    const meta = (context.claims as Record<string, unknown>)['user_metadata'] as
      | Record<string, unknown>
      | undefined;
    const fullName = typeof meta?.['full_name'] === 'string' ? meta['full_name'] : '';

    return loadWorkspaceBootstrap(context.supabase, context.userId, email, fullName);
  });

const updateProfileInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z.string().trim().max(30).nullable().optional(),
  timezone: z.string().trim().min(2).max(60),
});

export const updateProfileFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateProfileInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: updated, error } = await context.supabase
      .from('profiles')
      .update({
        full_name: data.fullName,
        phone: data.phone ?? null,
        timezone: data.timezone,
      })
      .eq('id', context.userId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? 'Failed to update profile');
    }
    return updated;
  });

const createInstitutionInputSchema = z.object({
  name: z.string().trim().min(2, 'Institution name must be at least 2 characters').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only')
    .min(2)
    .max(80),
  institutionType: z.enum(['school', 'college', 'university', 'training_centre']),
});

export const createInstitutionFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInstitutionInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: institution, error } = await context.supabase.rpc(
      'create_institution_with_owner',
      {
        p_name: data.name,
        p_slug: data.slug,
        p_institution_type: data.institutionType,
      },
    );

    if (error || !institution) {
      throw new Error(error?.message ?? 'Could not create institution');
    }
    return institution;
  });

const institutionIdSchema = z.object({
  institutionId: z.string().uuid('Invalid institution identifier'),
});

export const getInstitutionWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => institutionIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    return loadInstitutionWorkspace(context.supabase, context.userId, data.institutionId);
  });

const inviteMemberInputSchema = z.object({
  institutionId: z.string().uuid(),
  email: z.string().trim().email('Enter a valid email address').max(255),
  role: institutionRoleSchema,
});

export const inviteMemberFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteMemberInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    return createInstitutionInvite(context.supabase, context.userId, data);
  });

const revokeInviteInputSchema = z.object({
  institutionId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export const revokeInvitationFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => revokeInviteInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await revokeInstitutionInvite(context.supabase, context.userId, data);
    return { ok: true };
  });

const acceptInviteInputSchema = z.object({
  token: z.string().trim().min(10, 'Invalid invitation token'),
});

export const acceptInvitationFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => acceptInviteInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: membership, error } = await context.supabase.rpc(
      'accept_institution_invitation',
      {
        p_token: data.token,
      },
    );

    if (error || !membership) {
      throw new Error(error?.message ?? 'Could not accept invitation');
    }
    return membership;
  });

const updateMembershipInputSchema = z.object({
  institutionId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: institutionRoleSchema.optional(),
  status: membershipStatusSchema.optional(),
});

export const updateMembershipFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateMembershipInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    return updateInstitutionMember(context.supabase, context.userId, data);
  });

const removeMembershipInputSchema = z.object({
  institutionId: z.string().uuid(),
  membershipId: z.string().uuid(),
});

export const removeMembershipFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => removeMembershipInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await removeInstitutionMember(context.supabase, context.userId, data);
    return { ok: true };
  });

export const getPlatformOverviewFn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return loadPlatformOverview(context.supabase, context.userId);
  });

const updateInstitutionStatusInputSchema = z.object({
  institutionId: z.string().uuid(),
  status: institutionStatusSchema,
});

export const updateInstitutionStatusFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInstitutionStatusInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    return setInstitutionStatus(context.supabase, context.userId, data);
  });
