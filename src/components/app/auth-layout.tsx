import type { ReactNode } from "react";
import { Brand } from "./brand";

export function AuthCard({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Brand />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
      <div className="hidden flex-col justify-between bg-navy p-12 text-navy-foreground lg:flex">
        <p className="text-sm uppercase tracking-widest text-navy-foreground/60">ExamFlow for institutions</p>
        <blockquote className="font-display text-3xl leading-snug">“Exams that are fair to every student start with a platform you can trust.”</blockquote>
        <p className="text-sm text-navy-foreground/60">Secure exams · Faster grading · Clear oversight</p>
      </div>
    </div>
  );
}

export function FieldError({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}
