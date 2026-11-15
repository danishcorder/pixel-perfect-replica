import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, delta, icon: Icon, hint }: { label: string; value: string; delta?: number; icon: LucideIcon; hint?: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {delta !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-destructive")}>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta)}%
            </span>
          )}
          {hint}
        </div>
      </CardContent>
    </Card>
  );
}
