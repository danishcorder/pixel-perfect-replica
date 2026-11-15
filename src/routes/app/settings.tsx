import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/app/page-header';
import { FieldError } from '@/components/app/auth-layout';
import { EmptyState, LoadingState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import { removeMembershipFn, updateProfileFn } from '@/lib/workspace.functions';
import { INSTITUTION_ROLE_LABELS } from '@/lib/roles';

export const Route = createFileRoute('/app/settings')({
  head: () => ({
    meta: [
      { title: 'Account settings — ExamFlow' },
      { name: 'description', content: 'Manage your ExamFlow profile and memberships.' },
    ],
  }),
  component: SettingsPage,
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  phone: z.string().trim().max(30),
  timezone: z.string().trim().min(2, 'Enter a valid timezone').max(60),
});

function SettingsPage() {
  const {
    user,
    loading,
    workspace,
    workspaceLoading,
    authHeaders,
    refreshWorkspace,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  useEffect(() => {
    if (workspace?.profile) {
      setFullName(workspace.profile.full_name);
      setPhone(workspace.profile.phone ?? '');
      setTimezone(workspace.profile.timezone || 'UTC');
    }
  }, [workspace?.profile]);

  async function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ fullName, phone, timezone });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? ''), i.message])),
      );
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await updateProfileFn({
        data: {
          fullName: parsed.data.fullName,
          phone: parsed.data.phone ? parsed.data.phone : null,
          timezone: parsed.data.timezone,
        },
        headers: authHeaders(),
      });
      await refreshWorkspace();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function onLeaveInstitution(institutionId: string, membershipId: string, name: string) {
    setLeavingId(membershipId);
    try {
      await removeMembershipFn({
        data: { institutionId, membershipId },
        headers: authHeaders(),
      });
      await refreshWorkspace();
      toast.success(`Left ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not leave institution');
    } finally {
      setLeavingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Account settings"
        description="Your verified profile, security controls, and institution memberships."
      />

      {loading || workspaceLoading ? (
        <LoadingState label="Loading account settings…" />
      ) : !user ? (
        <EmptyState
          title="You're not signed in"
          description="Sign in to view your profile."
          action={
            <Button asChild>
              <Link to="/auth/login">Sign in</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Profile details</CardTitle>
              <CardDescription>
                Email is locked to your Supabase Auth identity; name, phone, and timezone are stored in public.profiles under RLS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSaveProfile} className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    value={workspace?.profile.email ?? user.email ?? ''}
                    disabled
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5"
                  />
                  <FieldError msg={errors['fullName']} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="profile-phone">Phone (optional)</Label>
                    <Input
                      id="profile-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1.5"
                    />
                    <FieldError msg={errors['phone']} />
                  </div>
                  <div>
                    <Label htmlFor="profile-tz">Timezone</Label>
                    <Input
                      id="profile-tz"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="UTC"
                      className="mt-1.5"
                    />
                    <FieldError msg={errors['timezone']} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save profile
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/reset-password">Change password</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Institution memberships</CardTitle>
              <CardDescription>
                Verified roles granted to your account across institutions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspace?.isSuperAdmin && (
                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Platform Super Admin
                  </div>
                  <StatusPill tone="info">Global</StatusPill>
                </div>
              )}

              {(workspace?.memberships.length ?? 0) === 0 ? (
                <EmptyState
                  title="No institution memberships yet"
                  description="Create an institution or accept an invitation to join one."
                  action={
                    <Button asChild size="sm">
                      <Link to="/app/onboarding">Set up institution</Link>
                    </Button>
                  }
                />
              ) : (
                workspace?.memberships.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5"
                  >
                    <div>
                      <p className="font-medium">{m.institution.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusPill tone="success">
                          {INSTITUTION_ROLE_LABELS[m.role]}
                        </StatusPill>
                        <span className="font-mono">{m.institution.slug}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={leavingId === m.id}
                      onClick={() =>
                        void onLeaveInstitution(m.institution_id, m.id, m.institution.name)
                      }
                    >
                      {leavingId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" />
                      )}
                      Leave
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
