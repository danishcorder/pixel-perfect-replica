import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthCard, FieldError } from "@/components/app/auth-layout";
import { ErrorState, SuccessState } from "@/components/app/states";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/register")({
  head: () => ({ meta: [{ title: "Create account — ExamFlow" }, { name: "description", content: "Create your ExamFlow account." }, { property: "og:title", content: "Create account — ExamFlow" }, { property: "og:description", content: "Create your ExamFlow account." }] }),
  component: Register,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  institution: z.string().trim().min(2, "Enter your institution name").max(150),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms" }) }),
});

function Register() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message]))); return; }
    setErrors({}); setBusy(true);
    const { fullName, institution, email, password } = parsed.data;
    // Institution name is stored only as sign-up metadata for now; institutions & roles are created server-side in a later phase.
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/app/settings", data: { full_name: fullName, requested_institution: institution } } });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email" description="One more step to activate your account.">
        <SuccessState title="Confirmation email sent" description={`We sent a link to ${sentTo}. Open it to confirm your account, then sign in.`} />
        <Button asChild variant="outline" className="mt-6 w-full"><Link to="/auth/login">Back to sign in</Link></Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" description="Set up ExamFlow for your institution." footer={<>Already registered? <Link to="/auth/login" className="font-medium text-primary hover:underline">Sign in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorState title="Couldn't create account" description={error} />}
        <div><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" autoComplete="name" className="mt-1.5" /><FieldError msg={errors["fullName"]} /></div>
        <div><Label htmlFor="institution">Institution name</Label><Input id="institution" name="institution" className="mt-1.5" /><FieldError msg={errors["institution"]} /></div>
        <div><Label htmlFor="email">Work email</Label><Input id="email" name="email" type="email" autoComplete="email" className="mt-1.5" /><FieldError msg={errors["email"]} /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" className="mt-1.5" /><FieldError msg={errors["password"]} /></div>
        <div><label className="flex items-start gap-2 text-sm"><Checkbox name="terms" className="mt-0.5" /> I agree to the terms of service and privacy policy.</label><FieldError msg={errors["terms"]} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create account</Button>
      </form>
    </AuthCard>
  );
}
