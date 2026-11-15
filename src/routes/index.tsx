import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Check, ClipboardCheck, Eye, FileText, Lock, ShieldCheck, Sparkles, Timer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brand } from "@/components/app/brand";
import { SampleBadge } from "@/components/app/states";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExamFlow — Secure online examinations for institutions" },
      { name: "description", content: "Run MCQ and descriptive exams, grade faster and proctor with confidence. Built for schools, colleges and universities." },
      { property: "og:title", content: "ExamFlow — Secure online examinations" },
      { property: "og:description", content: "Exams, grading and proctoring in one platform for institutions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: FileText, title: "MCQ & descriptive exams", body: "Mix objective and written questions with timed sections and randomised order." },
  { icon: ClipboardCheck, title: "Auto & manual grading", body: "Instant scoring for objective items, rubric-based marking for written answers." },
  { icon: Eye, title: "Proctoring & review", body: "Invigilators monitor live sessions and review flagged incidents afterwards." },
  { icon: Lock, title: "Strict institution isolation", body: "Every institution's data is walled off and protected at the database level." },
  { icon: Timer, title: "Server-validated deadlines", body: "Start, end and submission times are enforced on the server — never the browser." },
  { icon: ShieldCheck, title: "Role-based access", body: "Five purpose-built roles, each seeing only what they are permitted to see." },
];

const roles = [
  { key: "admin", label: "Institution Admin", points: ["Onboard departments, teachers and students", "Schedule exam windows across the term", "Track participation and outcomes"] },
  { key: "teacher", label: "Teacher", points: ["Author exams from a reusable question bank", "Grade descriptive answers with rubrics", "Publish results when you're ready"] },
  { key: "student", label: "Student", points: ["See every upcoming exam in one place", "Check your device before the exam starts", "Review results and feedback"] },
  { key: "invigilator", label: "Invigilator", points: ["Watch live session status at a glance", "Flag and document incidents", "Hand off a clear review trail"] },
];

const plans = [
  { name: "Starter", price: "$49", note: "per month", desc: "For a single school or training centre.", items: ["Up to 300 students", "MCQ & descriptive exams", "Email support"] },
  { name: "Institution", price: "$199", note: "per month", desc: "For colleges running exams every term.", items: ["Up to 3,000 students", "Proctoring & invigilator console", "Rubric grading", "Priority support"], featured: true },
  { name: "University", price: "Custom", note: "annual contract", desc: "For multi-campus universities.", items: ["Unlimited students", "Multiple campuses", "SSO & audit exports", "Dedicated success manager"] },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6">
          <Brand />
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#roles" className="hover:text-foreground">Roles</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#security" className="hover:text-foreground">Security</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/auth/register">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="bg-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-accent-foreground"><Sparkles className="h-3.5 w-3.5" />Examinations, without the paperwork</span>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">Run every exam your institution sets — securely, in one place.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">ExamFlow gives schools, colleges and universities a single platform to author, schedule, proctor and grade examinations, with each institution's data kept strictly separate.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth/register">Register your institution <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/app/institution">Preview the dashboard</Link></Button>
            </div>
          </div>
          <div className="relative rounded-2xl border bg-card p-5 shadow-elegant">
            <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold">Today's exam sessions</p><SampleBadge /></div>
            {[["Physics — Midterm", "Grade 11 · 142 students", "Live", "bg-success"], ["Organic Chemistry Quiz", "BSc Year 2 · 58 students", "Starts 14:00", "bg-warning"], ["English Composition", "Grade 9 · 210 students", "Grading", "bg-primary"]].map(([t, s, st, c]) => (
              <div key={t} className="flex items-center justify-between border-t py-3">
                <div><p className="text-sm font-medium">{t}</p><p className="text-xs text-muted-foreground">{s}</p></div>
                <span className="flex items-center gap-1.5 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${c}`} />{st}</span>
              </div>
            ))}
            <div className="mt-2 grid grid-cols-3 gap-3 border-t pt-4 text-center">
              {[["410", "Candidates"], ["98.6%", "Uptime"], ["3", "Flags"]].map(([v, l]) => <div key={l}><p className="text-xl font-semibold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl"><p className="text-sm font-semibold text-primary">Platform</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Everything an examination office needs</h2></div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-7">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="border-y bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl"><p className="text-sm font-semibold text-primary">Built for every role</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">The right workspace for each person</h2></div>
          <Tabs defaultValue="admin" className="mt-10">
            <TabsList className="flex h-auto flex-wrap">{roles.map((r) => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}</TabsList>
            {roles.map((r) => (
              <TabsContent key={r.key} value={r.key} className="mt-6">
                <ul className="grid gap-4 sm:grid-cols-3">{r.points.map((p) => <li key={p} className="flex gap-3 rounded-xl border bg-card p-5 text-sm"><Check className="h-5 w-5 shrink-0 text-success" />{p}</li>)}</ul>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold text-primary">Pricing preview</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Plans that scale with your institution</h2><p className="mt-3 text-sm text-muted-foreground">Indicative pricing. Subscriptions are not yet available for purchase.</p></div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`flex flex-col rounded-2xl border p-7 ${p.featured ? "border-primary bg-navy text-navy-foreground shadow-elegant" : "bg-card"}`}>
              <h3 className="font-semibold">{p.name}</h3>
              <p className={`mt-1 text-sm ${p.featured ? "text-navy-foreground/70" : "text-muted-foreground"}`}>{p.desc}</p>
              <p className="mt-6"><span className="text-4xl font-semibold">{p.price}</span> <span className={`text-sm ${p.featured ? "text-navy-foreground/70" : "text-muted-foreground"}`}>{p.note}</span></p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">{p.items.map((i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary-glow" />{i}</li>)}</ul>
              <Button asChild className="mt-8" variant={p.featured ? "secondary" : "outline"}><Link to="/auth/register">Get started</Link></Button>
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-1"><h2 className="font-display text-3xl font-semibold tracking-tight">Security by design</h2><p className="mt-3 text-navy-foreground/70">Exam integrity depends on trust. ExamFlow is built so that permissions are checked on the server, not just in the browser.</p></div>
          {[[Building2, "Tenant isolation", "Each institution's records are separated and protected by database access rules."], [Users, "Verified roles", "What a person can see and do is confirmed by the server on every request."]].map(([I, t, b]) => {
            const Icon = I as typeof Building2;
            return <div key={t as string} className="rounded-2xl border border-navy-foreground/15 p-6"><Icon className="h-6 w-6 text-primary-glow" /><h3 className="mt-4 font-semibold">{t as string}</h3><p className="mt-2 text-sm text-navy-foreground/70">{b as string}</p></div>;
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Ready to modernise your examinations?</h2>
        <p className="mt-3 text-muted-foreground">Create your institution account and invite your team.</p>
        <div className="mt-8 flex justify-center gap-3"><Button asChild size="lg"><Link to="/auth/register">Get started</Link></Button><Button asChild size="lg" variant="outline"><Link to="/auth/login">Sign in</Link></Button></div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Brand />
          <p>© {new Date().getFullYear()} ExamFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
