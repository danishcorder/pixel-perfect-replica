import { useState, type FormEvent } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check, KeyRound, Loader2, MailPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState, ErrorState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import { acceptInvitationFn } from '@/lib/workspace.functions';
import { dbRoleToRoleKey, INSTITUTION_ROLE_LABELS, ROLES } from '@/lib/roles';

export const Route = createFileRoute('/app/invitations')({
  validateSearch: (search: Record<string, unknown>): { token?: string | undefined } =>
    typeof search['token'] === 'string' && search['token'].length > 0
      ? { token: search['token'] }
      : {},
  head: () => ({
    meta: [
      { title: 'Invitations — ExamFlow' },
      { name: 'description', content: 'Review and accept institution invitations.' },
    ],
  }),
  component: InvitationsPage,
});

function InvitationsPage() {
  const { token: initialToken } = Route.useSearch();
  const navigate = useNavigate();
  const { workspace, authHeaders, refreshWorkspace, setActiveInstitutionId } = useAuth();
  const [tokenInput, setTokenInput] = useState(initialToken ?? '');
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingInvitations = workspace?.pendingInvitations ?? [];

  async function acceptToken(token: string) {
    const clean = token.trim();
    if (!clean) return;
    setError(null);
    setBusyToken(clean);
    try {
      const membership = await acceptInvitationFn({
        data: { token: clean },
        headers: authHeaders(),
      });
      await refreshWorkspace();
      setActiveInstitutionId(membership.institution_id);
      toast.success('Joined institution successfully');
      const roleKey = dbRoleToRoleKey(membership.role);
      void navigate({ to: ROLES[roleKey].path });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setBusyToken(null);
    }
  }

  function onSubmitToken(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void acceptToken(tokenInput);
  }

  return (
    <>
      <PageHeader
        title="Institution invitations"
        description="Accept an invitation sent to your verified email address."
      />

      {error && <ErrorState title="Could not accept invitation" description={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              Accept by invitation token
            </CardTitle>
            <CardDescription>
              The invitation email must match your signed-in account ({workspace?.profile.email ?? '—'}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmitToken} className="space-y-4">
              <div>
                <Label htmlFor="invite-token">Invitation token</Label>
                <Input
                  id="invite-token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste invitation token…"
                  className="mt-1.5 font-mono text-sm"
                />
              </div>
              <Button
                type="submit"
                disabled={!tokenInput.trim() || busyToken !== null}
                className="w-full"
              >
                {busyToken === tokenInput.trim() && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept invitation
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailPlus className="h-4 w-4 text-primary" />
              Pending for {workspace?.profile.email ?? 'your email'}
            </CardTitle>
            <CardDescription>
              Verified against auth.users on the database server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvitations.length === 0 ? (
              <EmptyState
                title="No pending invitations"
                description="When an Institution Admin invites your email address, it will appear here automatically."
              />
            ) : (
              pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{inv.institution_name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <StatusPill tone="info">{INSTITUTION_ROLE_LABELS[inv.role]}</StatusPill>
                      <span>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={busyToken !== null}
                    onClick={() => void acceptToken(inv.token)}
                  >
                    {busyToken === inv.token ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Accept
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
