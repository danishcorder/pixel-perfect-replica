import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "@/components/app/auth-layout";
import { ErrorState } from "@/components/app/states";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — ExamFlow" }, { name: "description", content: "Choose a new password for your ExamFlow account." }, { property: "og:title", content: "Set a new password — ExamFlow" }, { property: "og:description", content: "Choose a new password for your ExamFlow account." }] }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [isRecovery, setIsRecovery] = useState(false);
  const [fieldErr, setFieldErr] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setIsRecovery(window.location.hash.includes("type=recovery")); }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") ?? ""), confirm = String(fd.get("confirm") ?? "");
    if (pw.length < 8) return setFieldErr("Use at least 8 characters");
    if (pw !== confirm) return setFieldErr("Passwords don't match");
    setFieldErr(undefined); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success("Password updated");
    navigate({ to: "/app/settings" });
  }

  const ready = session || isRecovery;
  return (
    <AuthCard title="Set a new password" description="Choose a strong password you haven't used before.">
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !ready ? (
        <div className="space-y-4"><ErrorState title="Reset link invalid or expired" description="Request a new password reset link to continue." /><Button asChild className="w-full"><Link to="/auth/forgot-password">Request new link</Link></Button></div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <ErrorState title="Couldn't update password" description={error} />}
          <div><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" className="mt-1.5" /></div>
          <div><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" className="mt-1.5" /><FieldError msg={fieldErr} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Update password</Button>
        </form>
      )}
    </AuthCard>
  );
}
