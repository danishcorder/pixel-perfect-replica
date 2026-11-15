import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ShieldAlert, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState, LoadingState } from './states';
import { useAuth } from '@/lib/auth';
import { dbRoleToRoleKey, ROLES, type RoleKey } from '@/lib/roles';

export function RoleGuard({
  requiredRole,
  allowedRoles,
  children,
}: {
  requiredRole?: RoleKey;
  allowedRoles?: RoleKey[];
  children: ReactNode;
}) {
  const {
    user,
    loading,
    workspace,
    workspaceLoading,
    workspaceError,
    activeMembership,
    refreshWorkspace,
  } = useAuth();

  if (loading || workspaceLoading) {
    return <LoadingState label="Verifying workspace permissions…" />;
  }

  if (!user) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Sign in required</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            You must sign in to access your institution workspace.
          </p>
          <Button asChild className="mt-5">
            <Link to="/auth/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (workspaceError) {
    return (
      <ErrorState
        title="Could not verify workspace permissions"
        description={workspaceError}
        onRetry={() => {
          void refreshWorkspace();
        }}
      />
    );
  }

  const isSuperAdmin = workspace?.isSuperAdmin ?? false;
  const activeRoleKey = activeMembership ? dbRoleToRoleKey(activeMembership.role) : null;
  const permitted = allowedRoles ?? (requiredRole ? [requiredRole] : []);

  const isAuthorized =
    permitted.length === 0
      ? true
      : permitted.includes('super-admin')
        ? isSuperAdmin
        : isSuperAdmin || (activeRoleKey !== null && permitted.includes(activeRoleKey));

  if (!isAuthorized) {
    const fallbackTo = activeRoleKey
      ? ROLES[activeRoleKey].path
      : isSuperAdmin
        ? ROLES['super-admin'].path
        : '/app/onboarding';

    const labelText = permitted.map((r) => ROLES[r].label).join(' or ');

    return (
      <Card className="border-destructive/30 shadow-none">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold">
            Access restricted ({labelText})
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            {activeMembership
              ? `Your active role in ${activeMembership.institution.name} is ${ROLES[dbRoleToRoleKey(activeMembership.role)].label}. You do not have permission to view this area.`
              : 'You do not have an active institution membership with permission to view this area.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to={fallbackTo}>
                <Building2 className="h-4 w-4" />
                {activeMembership ? 'Go to my workspace' : 'Set up or join an institution'}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
