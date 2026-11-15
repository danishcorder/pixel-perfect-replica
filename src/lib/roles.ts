import {
  LayoutDashboard, Building2, CreditCard, Activity, Users, GraduationCap, CalendarClock, FileText,
  ClipboardCheck, BookOpen, Award, MonitorPlay, AlertTriangle, Settings, BarChart3, ShieldCheck, type LucideIcon,
} from "lucide-react";

export type RoleKey = "super-admin" | "institution" | "teacher" | "student" | "invigilator";
export type NavItem = { label: string; icon: LucideIcon; to?: string; soon?: boolean };

export const ROLES: Record<RoleKey, { label: string; short: string; path: string; nav: NavItem[] }> = {
  "super-admin": {
    label: "Platform Super Admin", short: "Super Admin", path: "/app/super-admin",
    nav: [
      { label: "Overview", icon: LayoutDashboard, to: "/app/super-admin" },
      { label: "Institutions", icon: Building2, soon: true },
      { label: "Subscriptions", icon: CreditCard, soon: true },
      { label: "System health", icon: Activity, soon: true },
      { label: "Audit logs", icon: ShieldCheck, soon: true },
    ],
  },
  institution: {
    label: "Institution Admin", short: "Institution Admin", path: "/app/institution",
    nav: [
      { label: "Overview", icon: LayoutDashboard, to: "/app/institution" },
      { label: "Members", icon: Users, soon: true },
      { label: "Departments", icon: GraduationCap, soon: true },
      { label: "Exam schedule", icon: CalendarClock, soon: true },
      { label: "Reports", icon: BarChart3, soon: true },
    ],
  },
  teacher: {
    label: "Teacher / Examiner", short: "Teacher", path: "/app/teacher",
    nav: [
      { label: "Overview", icon: LayoutDashboard, to: "/app/teacher" },
      { label: "My exams", icon: FileText, soon: true },
      { label: "Question bank", icon: BookOpen, soon: true },
      { label: "Grading queue", icon: ClipboardCheck, soon: true },
    ],
  },
  student: {
    label: "Student", short: "Student", path: "/app/student",
    nav: [
      { label: "Overview", icon: LayoutDashboard, to: "/app/student" },
      { label: "Upcoming exams", icon: CalendarClock, soon: true },
      { label: "Results", icon: Award, soon: true },
    ],
  },
  invigilator: {
    label: "Invigilator", short: "Invigilator", path: "/app/invigilator",
    nav: [
      { label: "Overview", icon: LayoutDashboard, to: "/app/invigilator" },
      { label: "Live sessions", icon: MonitorPlay, soon: true },
      { label: "Incidents", icon: AlertTriangle, soon: true },
    ],
  },
};
export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];
export const SETTINGS_NAV: NavItem = { label: "Account settings", icon: Settings, to: "/app/settings" };
