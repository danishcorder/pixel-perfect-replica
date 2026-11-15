import { useState, type FormEvent } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard, FieldError } from '@/components/app/auth-layout';
import { ErrorState } from '@/components/app/states';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceBootstrapFn } from '@/lib/workspace.functions';
import { dbRoleToRoleKey, ROLES } from '@/lib/roles';

function safeRedirectPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/app')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

export const Route = createFileRoute('/auth/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string | undefined } => {
    const safe = safeRedirectPath(search['redirect']);
    return safe ? { redirect: safe } : {};
  },
  head: () => ({
    meta: [
      { title: 'Sign in — ExamFlow' },
      { name: 'description', content: 'Sign in to your ExamFlow account.' },
      { property: 'og:title', content: 'Sign in — ExamFlow' },
      { property: 'og:description', content: 'Sign in to your ExamFlow account.' },
    ],
  }),
  component: Login,
});

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

function Login() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? ''), i.message])),
      );
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error: signInErr } = await supabase.auth.signInWithPassword(parsed.data);
    if (signInErr || !data.session) {
      setBusy(false);
      setError(signInErr?.message ?? 'Invalid credentials');
      return;
    }

    try {
      if (redirect) {
        toast.success('Welcome back');
        void navigate({ to: redirect });
        return;
      }
      const bootstrap = await getWorkspaceBootstrapFn({
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      toast.success('Welcome back');
      const firstMembership = bootstrap.memberships[0];
      if (firstMembership) {
        void navigate({ to: ROLES[dbRoleToRoleKey(firstMembership.role)].path });
      } else if (bootstrap.isSuperAdmin) {
        void navigate({ to: '/app/super-admin' });
      } else {
        void navigate({ to: '/app/onboarding' });
      }
    } catch {
      toast.success('Welcome back');
      void navigate({ to: '/app/onboarding' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Access your institution's ExamFlow workspace."
      footer={
        <>
          New institution?{' '}
          <Link to="/auth/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorState title="Couldn't sign in" description={error} />}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" className="mt-1.5" />
          <FieldError msg={errors['email']} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-1.5"
          />
          <FieldError msg={errors['password']} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
