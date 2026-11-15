import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Inbox, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, icon }: { title: string; description?: string | undefined; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="font-medium text-destructive">{title}</p>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function SuccessState({ title, description, className }: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4", className)}>
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
      <div><p className="font-medium">{title}</p>{description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}</div>
    </div>
  );
}

/** Marks content as illustrative sample data — never live database records. */
export function SampleBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground", className)}>
      <FlaskConical className="h-3 w-3" /> Sample data
    </span>
  );
}

export function SampleBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning-foreground">
      <FlaskConical className="h-4 w-4 shrink-0" />
      <span><strong>Visual preview.</strong> Figures and records on this page are sample content, not live data from your institution.</span>
    </div>
  );
}
