import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "@/components/app/auth-layout";
import { ErrorState } from "@/components/app/states";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Sign in — ExamFlow" }, { name: "description", content: "Sign in to your ExamFlow account." }, { property: "og:title", content: "Sign in — ExamFlow" }, { property: "og:description", content: "Sign in to your ExamFlow account." }] }),
  component: Login,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

function Login() {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message]))); return; }
    setErrors({}); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) { setError(error.message); return; }
    toast.success("Welcome back");
    navigate({ to: "/app/settings" });
  }

  return (
    <AuthCard title="Sign in" description="Access your institution's ExamFlow workspace." footer={<>New institution? <Link to="/auth/register" className="font-medium text-primary hover:underline">Create an account</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorState title="Couldn't sign in" description={error} />}
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" className="mt-1.5" /><FieldError msg={errors.email} /></div>
        <div>
          <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link></div>
          <Input id="password" name="password" type="password" autoComplete="current-password" className="mt-1.5" /><FieldError msg={errors.password} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in</Button>
      </form>
    </AuthCard>
  );
}
