import { useState, type FormEvent } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Building2, Check, Loader2, MailCheck } from 'lucide-react';
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
import { PageHeader } from '@/components/app/page-header';
import { FieldError } from '@/components/app/auth-layout';
import { ErrorState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import { acceptInvitationFn, createInstitutionFn } from '@/lib/workspace.functions';
import { dbRoleToRoleKey, INSTITUTION_ROLE_LABELS, ROLES } from '@/lib/roles';

export const Route = createFileRoute('/app/onboarding')({
  head: () => ({
    meta: [
      { title: 'Set up institution — ExamFlow' },
      { name: 'description', content: 'Create an institution or accept an invitation.' },
    ],
  }),
  component: OnboardingPage,
});

const schema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only')
    .min(2)
    .max(80),
  institutionType: z.enum(['school', 'college', 'university', 'training_centre']),
});

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { workspace, authHeaders, refreshWorkspace, setActiveInstitutionId } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [institutionType, setInstitutionType] = useState<
    'school' | 'college' | 'university' | 'training_centre'
  >('university');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const pendingInvitations = workspace?.pendingInvitations ?? [];

  async function onCreateInstitution(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({ name, slug, institutionType });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? ''), i.message])),
      );
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const created = await createInstitutionFn({
        data: parsed.data,
        headers: authHeaders(),
      });
      await refreshWorkspace();
      setActiveInstitutionId(created.id);
      toast.success(`Created ${created.name}`);
      void navigate({ to: '/app/institution' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create institution');
    } finally {
      setBusy(false);
    }
  }

  async function onAcceptInvite(token: string, id: string) {
    setAcceptingId(id);
    try {
      const membership = await acceptInvitationFn({
        data: { token },
        headers: authHeaders(),
      });
      await refreshWorkspace();
      setActiveInstitutionId(membership.institution_id);
      toast.success('Invitation accepted');
      const roleKey = dbRoleToRoleKey(membership.role);
      void navigate({ to: ROLES[roleKey].path });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept invitation');
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Set up your workspace"
        description="Create a new institution as Institution Admin or accept a pending invitation."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Create a new institution
            </CardTitle>
            <CardDescription>
              You will automatically become the founding Institution Admin with isolated tenant data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateInstitution} className="space-y-4" noValidate>
              {serverError && (
                <ErrorState title="Could not create institution" description={serverError} />
              )}
              <div>
                <Label htmlFor="inst-name">Institution name</Label>
                <Input
                  id="inst-name"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (!slugTouched) setSlug(toSlug(val));
                  }}
                  placeholder="e.g. Oakridge University"
                  className="mt-1.5"
                />
                <FieldError msg={errors['name']} />
              </div>

              <div>
                <Label htmlFor="inst-slug">URL slug</Label>
                <Input
                  id="inst-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="oakridge-university"
                  className="mt-1.5 font-mono text-sm"
                />
                <FieldError msg={errors['slug']} />
              </div>

              <div>
                <Label htmlFor="inst-type">Institution type</Label>
                <Select
                  value={institutionType}
                  onValueChange={(v) =>
                    setInstitutionType(
                      v as 'school' | 'college' | 'university' | 'training_centre',
                    )
                  }
                >
                  <SelectTrigger id="inst-type" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="training_centre">Training Centre</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError msg={errors['institutionType']} />
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create institution
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailCheck className="h-4 w-4 text-primary" />
              Pending invitations
            </CardTitle>
            <CardDescription>
              Invitations issued to your verified email address ({workspace?.profile.email ?? '—'}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvitations.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No pending invitations for your email right now. Ask an Institution Admin to invite you, or paste an invitation token on the Invitations page.
              </p>
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
                    disabled={acceptingId === inv.id}
                    onClick={() => void onAcceptInvite(inv.token, inv.id)}
                  >
                    {acceptingId === inv.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Accept & join
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
