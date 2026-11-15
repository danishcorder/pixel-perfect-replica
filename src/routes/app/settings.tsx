import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Account settings — ExamFlow" }, { name: "description", content: "Manage your ExamFlow profile." }, { property: "og:title", content: "Account settings — ExamFlow" }, { property: "og:description", content: "Manage your ExamFlow profile." }] }),
  component: Settings,
});

function Settings() {
  const { user, loading } = useAuth();
  return (
    <>
      <PageHeader title="Account settings" description="Your profile and security." />
      {loading ? <LoadingState /> : !user ? (
        <EmptyState title="You're not signed in" description="Sign in to view your profile." action={<Button asChild><Link to="/auth/login">Sign in</Link></Button>} />
      ) : (
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {String(user.user_metadata?.["full_name"] ?? "—")}</p>
            <p><span className="text-muted-foreground">Email:</span> {user.email}</p>
            <Button asChild variant="outline" size="sm"><Link to="/reset-password">Change password</Link></Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
