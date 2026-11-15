import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  MailPlus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from './page-header';
import { StatCard } from './stat-card';
import { EmptyState, LoadingState } from './states';
import { StatusPill } from './status-pill';
import { RoleGuard } from './role-guard';
import { useAuth } from '@/lib/auth';
import { getInstitutionWorkspaceFn } from '@/lib/workspace.functions';
import { INSTITUTION_ROLE_LABELS, ROLES, type RoleKey } from '@/lib/roles';

export function RoleDashboard({ role }: { role: Exclude<RoleKey, 'super-admin'> }) {
  const { user, activeInstitutionId, activeMembership, authHeaders, workspace } = useAuth();

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

  const data = workspaceQuery.data;
  const isAdmin = role === 'institution';

  return (
    <RoleGuard requiredRole={role}>
      <PageHeader
        title={`${ROLES[role].label} workspace`}
        description={
          activeMembership
            ? `${activeMembership.institution.name} (${activeMembership.institution.slug})`
            : 'Verified institution workspace.'
        }
        actions={
          isAdmin ? (
            <Button asChild>
              <Link to="/app/members">
                <MailPlus className="h-4 w-4" />
                Manage members & invites
              </Link>
            </Button>
          ) : undefined
        }
      />

      {workspaceQuery.isLoading ? (
        <LoadingState label="Loading verified institution data…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active institution"
              value={activeMembership?.institution.name ?? '—'}
              icon={Building2}
              hint={
                activeMembership?.institution.institution_type.replace('_', ' ') ??
                'Verified tenant'
              }
            />
            <StatCard
              label="Verified role"
              value={
                activeMembership
                  ? INSTITUTION_ROLE_LABELS[activeMembership.role]
                  : workspace?.isSuperAdmin
                    ? 'Platform Super Admin'
                    : '—'
              }
              icon={ShieldCheck}
              hint="Enforced by PostgreSQL RLS"
            />
            {isAdmin && data ? (
              <>
                <StatCard
                  label="Institution members"
                  value={String(data.members.filter((m) => m.status === 'active').length)}
                  icon={Users}
                  hint={`${data.members.length} total records`}
                />
                <StatCard
                  label="Pending invitations"
                  value={String(data.invitations.filter((i) => i.status === 'pending').length)}
                  icon={MailPlus}
                  hint="Awaiting acceptance"
                />
              </>
            ) : (
              <>
                <StatCard
                  label="Account status"
                  value={activeMembership?.status === 'active' ? 'Active' : '—'}
                  icon={CheckCircle2}
                  hint="Tenant-isolated session"
                />
                <StatCard
                  label="My institutions"
                  value={String(workspace?.memberships.length ?? 0)}
                  icon={Users}
                  hint="Verified memberships"
                />
              </>
            )}
          </div>

          {isAdmin && data ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Recent members</CardTitle>
                  <CardDescription>
                    Scoped strictly to {data.institution.name} via RLS.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.members.slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between border-b pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {m.profile?.full_name || m.profile?.email || m.user_id}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.profile?.email ?? '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill tone={m.status === 'active' ? 'success' : 'warning'}>
                          {INSTITUTION_ROLE_LABELS[m.role]}
                        </StatusPill>
                      </div>
                    </div>
                  ))}
                  {data.members.length === 0 && (
                    <p className="text-sm text-muted-foreground">No members found.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Recent security & membership activity</CardTitle>
                  <CardDescription>Immutable institution audit trail.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.auditLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between border-b pb-2.5 text-sm last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.target_type} · {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                      <StatusPill tone="info">Verified</StatusPill>
                    </div>
                  ))}
                  {data.auditLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState
              title={`${ROLES[role].label} tools arrive in Phase 3`}
              description={`Your identity, ${activeMembership?.institution.name ?? 'institution'} tenant boundary, and ${ROLES[role].short} role are verified on the server. Exam authoring, sessions, and grading will appear here in the next phase.`}
            />
          )}
        </>
      )}
    </RoleGuard>
  );
}
