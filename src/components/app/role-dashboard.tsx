import { Activity, CalendarClock, ClipboardCheck, Users } from "lucide-react";
import { PageHeader } from "./page-header";
import { StatCard } from "./stat-card";
import { SampleBanner, EmptyState } from "./states";
import { ROLES, type RoleKey } from "@/lib/roles";

export function RoleDashboard({ role }: { role: RoleKey }) {
  return (
    <>
      <SampleBanner />
      <PageHeader title={`${ROLES[role].label} dashboard`} description="Overview of your workspace." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active members" value="1,248" delta={4} icon={Users} hint="vs last month" />
        <StatCard label="Scheduled exams" value="18" icon={CalendarClock} hint="next 30 days" />
        <StatCard label="Awaiting grading" value="64" delta={-12} icon={ClipboardCheck} />
        <StatCard label="Live sessions" value="3" icon={Activity} />
      </div>
      <EmptyState title="No live records yet" description="Real data appears here once exams and members are set up in a later phase." />
    </>
  );
}
