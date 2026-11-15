import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, MailPlus, Trash2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/app/page-header';
import { FieldError } from '@/components/app/auth-layout';
import { RoleGuard } from '@/components/app/role-guard';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import {
  getInstitutionWorkspaceFn,
  inviteMemberFn,
  removeMembershipFn,
  revokeInvitationFn,
  updateMembershipFn,
} from '@/lib/workspace.functions';
import { INSTITUTION_ROLE_LABELS } from '@/lib/roles';
import type { InstitutionRole, MembershipStatus } from '@/integrations/supabase/types';

export const Route = createFileRoute('/app/members')({
  head: () => ({
    meta: [
      { title: 'Members & Invitations — ExamFlow' },
      { name: 'description', content: 'Manage institution members, roles, and invitations.' },
    ],
  }),
  component: MembersPage,
});

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email').max(255),
  role: z.enum(['institution_admin', 'teacher', 'student', 'invigilator']),
});

function MembersPage() {
  const { user, activeInstitutionId, activeMembership, authHeaders } = useAuth();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InstitutionRole>('teacher');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['institution-workspace', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return getInstitutionWorkspaceFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  async function invalidate() {
    await queryClient.invalidateQueries({
      queryKey: ['institution-workspace', activeInstitutionId, user?.id],
    });
  }

  async function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeInstitutionId) return;
    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) {
      setFormErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? ''), i.message])),
      );
      return;
    }
    setFormErrors({});
    setInviting(true);
    try {
      const inv = await inviteMemberFn({
        data: { institutionId: activeInstitutionId, ...parsed.data },
        headers: authHeaders(),
      });
      const link = `${window.location.origin}/app/invitations?token=${inv.token}`;
      setLastInviteLink(link);
      setEmail('');
      toast.success(`Invitation created for ${inv.email}`);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function onChangeRole(membershipId: string, newRole: InstitutionRole) {
    if (!activeInstitutionId) return;
    setBusyId(membershipId);
    try {
      await updateMembershipFn({
        data: { institutionId: activeInstitutionId, membershipId, role: newRole },
        headers: authHeaders(),
      });
      toast.success('Member role updated');
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleStatus(membershipId: string, current: MembershipStatus) {
    if (!activeInstitutionId) return;
    const next: MembershipStatus = current === 'active' ? 'suspended' : 'active';
    setBusyId(membershipId);
    try {
      await updateMembershipFn({
        data: { institutionId: activeInstitutionId, membershipId, status: next },
        headers: authHeaders(),
      });
      toast.success(`Membership ${next}`);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveMember(membershipId: string) {
    if (!activeInstitutionId) return;
    setBusyId(membershipId);
    try {
      await removeMembershipFn({
        data: { institutionId: activeInstitutionId, membershipId },
        headers: authHeaders(),
      });
      toast.success('Member removed');
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setBusyId(null);
    }
  }

  async function onRevokeInvite(invitationId: string) {
    if (!activeInstitutionId) return;
    setBusyId(invitationId);
    try {
      await revokeInvitationFn({
        data: { institutionId: activeInstitutionId, invitationId },
        headers: authHeaders(),
      });
      toast.success('Invitation revoked');
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setBusyId(null);
    }
  }

  const data = workspaceQuery.data;

  return (
    <RoleGuard requiredRole="institution">
      <PageHeader
        title="Members & invitations"
        description={
          activeMembership
            ? `Manage roles and access for ${activeMembership.institution.name}.`
            : 'Manage institution members.'
        }
      />

      {workspaceQuery.isLoading ? (
        <LoadingState label="Loading members and invitations…" />
      ) : workspaceQuery.error ? (
        <ErrorState
          title="Could not load institution members"
          description={
            workspaceQuery.error instanceof Error
              ? workspaceQuery.error.message
              : 'Unknown error'
          }
          onRetry={() => {
            void invalidate();
          }}
        />
      ) : !data ? (
        <EmptyState title="No institution selected" />
      ) : (
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MailPlus className="h-4 w-4 text-primary" />
                Invite a team member or student
              </CardTitle>
              <CardDescription>
                Invitations are bound to the recipient email and verified server-side on acceptance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={onInvite} className="grid gap-4 sm:grid-cols-12" noValidate>
                <div className="sm:col-span-6">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@university.edu"
                    className="mt-1.5"
                  />
                  <FieldError msg={formErrors['email']} />
                </div>
                <div className="sm:col-span-4">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as InstitutionRole)}>
                    <SelectTrigger id="invite-role" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="institution_admin">Institution Admin</SelectItem>
                      <SelectItem value="teacher">Teacher / Examiner</SelectItem>
                      <SelectItem value="invigilator">Invigilator</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end sm:col-span-2">
                  <Button type="submit" className="w-full" disabled={inviting}>
                    {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Invite
                  </Button>
                </div>
              </form>

              {lastInviteLink && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
                  <span className="truncate font-mono">{lastInviteLink}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(lastInviteLink);
                      toast.success('Invitation link copied');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                Active & suspended members ({data.members.length})
              </CardTitle>
              <CardDescription>
                Database triggers enforce that at least one active Institution Admin remains.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <p className="font-medium">
                            {m.profile?.full_name || m.profile?.email || m.user_id}
                            {m.user_id === user?.id && (
                              <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.profile?.email ?? '—'}</p>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={m.role}
                            disabled={busyId === m.id}
                            onValueChange={(v) => void onChangeRole(m.id, v as InstitutionRole)}
                          >
                            <SelectTrigger className="h-8 w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="institution_admin">Institution Admin</SelectItem>
                              <SelectItem value="teacher">Teacher / Examiner</SelectItem>
                              <SelectItem value="invigilator">Invigilator</SelectItem>
                              <SelectItem value="student">Student</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={m.status === 'active' ? 'success' : 'warning'}>
                            {m.status}
                          </StatusPill>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === m.id}
                              onClick={() => void onToggleStatus(m.id, m.status)}
                            >
                              {m.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === m.id}
                              aria-label="Remove member"
                              onClick={() => void onRemoveMember(m.id)}
                            >
                              <UserX className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                Invitations ({data.invitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.invitations.length === 0 ? (
                <EmptyState title="No invitations sent yet" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell>{INSTITUTION_ROLE_LABELS[inv.role]}</TableCell>
                          <TableCell>
                            <StatusPill
                              tone={
                                inv.status === 'accepted'
                                  ? 'success'
                                  : inv.status === 'pending'
                                    ? 'info'
                                    : 'neutral'
                              }
                            >
                              {inv.status}
                            </StatusPill>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(inv.expires_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {inv.status === 'pending' && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    const link = `${window.location.origin}/app/invitations?token=${inv.token}`;
                                    await navigator.clipboard.writeText(link);
                                    toast.success('Invite link copied');
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busyId === inv.id}
                                  onClick={() => void onRevokeInvite(inv.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Institution audit log</CardTitle>
              <CardDescription>
                Every membership and invitation change is logged and isolated to this tenant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events yet.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {data.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
                    >
                      <div>
                        <span className="font-medium">{log.action}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          ({log.target_type})
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
