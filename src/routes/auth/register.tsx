import { useState, type FormEvent } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthCard, FieldError } from '@/components/app/auth-layout';
import { ErrorState, SuccessState } from '@/components/app/states';
import { supabase } from '@/integrations/supabase/client';

function safeRedirectPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/app')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

export const Route = createFileRoute('/auth/register')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string | undefined } => {
    const safe = safeRedirectPath(search['redirect']);
    return safe ? { redirect: safe } : {};
  },
  head: () => ({
    meta: [
      { title: 'Create account — ExamFlow' },
      { name: 'description', content: 'Register an ExamFlow account for your institution.' },
      { property: 'og:title', content: 'Create account — ExamFlow' },
      { property: 'og:description', content: 'Register an ExamFlow account for your institution.' },
    ],
  }),
  component: Register,
});

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  email: z.string().trim().email('Enter a valid email').max(255),
  password: z.string().min(8, 'Use at least 8 characters').max(72),
  terms: z.literal('on', { errorMap: () => ({ message: 'Please accept the terms' }) }),
});

function Register() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
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
    const { fullName, email, password } = parsed.data;
    const nextPath = redirect || '/app/onboarding';
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${nextPath}`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (signUpErr) {
      setError(signUpErr.message);
      return;
    }
    if (data.session) {
      toast.success('Account created');
      void navigate({ to: nextPath });
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email" description="One more step to activate your account.">
        <SuccessState
          title="Confirmation email sent"
          description={`We sent a link to ${sentTo}. Open it to confirm your account, then sign in to create or join an institution.`}
        />
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/auth/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Create an ExamFlow account, then set up an institution or accept an invite."
      footer={
        <>
          Already registered?{' '}
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorState title="Couldn't create account" description={error} />}
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" className="mt-1.5" />
          <FieldError msg={errors['fullName']} />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" className="mt-1.5" />
          <FieldError msg={errors['email']} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
          />
          <FieldError msg={errors['password']} />
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox name="terms" className="mt-0.5" /> I agree to the terms of service and
            privacy policy.
          </label>
          <FieldError msg={errors['terms']} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
