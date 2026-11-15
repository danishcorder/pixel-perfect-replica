import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "@/components/app/auth-layout";
import { ErrorState, SuccessState } from "@/components/app/states";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — ExamFlow" }, { name: "description", content: "Recover access to your ExamFlow account." }, { property: "og:title", content: "Reset password — ExamFlow" }, { property: "og:description", content: "Recover access to your ExamFlow account." }] }),
  component: Forgot,
});

function Forgot() {
  const [fieldErr, setFieldErr] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = z.string().trim().email().safeParse(new FormData(e.currentTarget).get("email"));
    if (!parsed.success) { setFieldErr("Enter a valid email"); return; }
    setFieldErr(undefined); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <AuthCard title="Forgot your password?" description="We'll email you a secure link to set a new one." footer={<Link to="/auth/login" className="font-medium text-primary hover:underline">← Back to sign in</Link>}>
      {sent ? (
        <SuccessState title="Check your inbox" description="If an account exists for that email, a reset link is on its way." />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <ErrorState title="Couldn't send reset link" description={error} />}
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" className="mt-1.5" /><FieldError msg={fieldErr} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}
