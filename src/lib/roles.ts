import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Activity,
  Users,
  GraduationCap,
  CalendarClock,
  FileText,
  ClipboardCheck,
  BookOpen,
  Award,
  MonitorPlay,
  AlertTriangle,
  Settings,
  BarChart3,
  ShieldCheck,
  MailPlus,
  PlusCircle,
  BookMarked,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { InstitutionRole } from '@/integrations/supabase/types';

export type RoleKey = 'super-admin' | 'institution' | 'teacher' | 'student' | 'invigilator';

export type NavItem = { label: string; icon: LucideIcon; to?: string; soon?: boolean };

export const INSTITUTION_ROLE_LABELS: Record<InstitutionRole, string> = {
  institution_admin: 'Institution Admin',
  teacher: 'Teacher / Examiner',
  student: 'Student',
  invigilator: 'Invigilator',
};

export const ROLES: Record<RoleKey, { label: string; short: string; path: string; nav: NavItem[] }> = {
  'super-admin': {
    label: 'Platform Super Admin',
    short: 'Super Admin',
    path: '/app/super-admin',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, to: '/app/super-admin' },
      { label: 'Institutions', icon: Building2, to: '/app/super-admin' },
      { label: 'Subscriptions', icon: CreditCard, soon: true },
      { label: 'System health', icon: Activity, soon: true },
      { label: 'Audit logs', icon: ShieldCheck, soon: true },
    ],
  },
  institution: {
    label: 'Institution Admin',
    short: 'Institution Admin',
    path: '/app/institution',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, to: '/app/institution' },
      { label: 'Members & Invites', icon: Users, to: '/app/members' },
      { label: 'Academic structure', icon: GraduationCap, to: '/app/academics' },
      { label: 'Teacher assignments', icon: UserCheck, to: '/app/assignments' },
      { label: 'Teachers', icon: BookMarked, to: '/app/teachers' },
      { label: 'Students & CSV import', icon: Users, to: '/app/students' },
      { label: 'Question bank', icon: BookOpen, to: '/app/question-bank' },
      { label: 'Exam builder', icon: FileText, to: '/app/exams' },
      { label: 'Reports', icon: BarChart3, soon: true },
    ],
  },
  teacher: {
    label: 'Teacher / Examiner',
    short: 'Teacher',
    path: '/app/teacher',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, to: '/app/teacher' },
      { label: 'My assignments', icon: UserCheck, to: '/app/assignments' },
      { label: 'Students', icon: Users, to: '/app/students' },
      { label: 'Teachers', icon: BookMarked, to: '/app/teachers' },
      { label: 'Question bank', icon: BookOpen, to: '/app/question-bank' },
      { label: 'My exams', icon: FileText, to: '/app/exams' },
      { label: 'Grading queue', icon: ClipboardCheck, soon: true },
    ],
  },
  student: {
    label: 'Student',
    short: 'Student',
    path: '/app/student',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, to: '/app/student' },
      { label: 'Upcoming exams', icon: CalendarClock, soon: true },
      { label: 'Results', icon: Award, soon: true },
    ],
  },
  invigilator: {
    label: 'Invigilator',
    short: 'Invigilator',
    path: '/app/invigilator',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, to: '/app/invigilator' },
      { label: 'Live sessions', icon: MonitorPlay, soon: true },
      { label: 'Incidents', icon: AlertTriangle, soon: true },
    ],
  },
};

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

export const WORKSPACE_UTILITY_NAV: NavItem[] = [
  { label: 'Invitations', icon: MailPlus, to: '/app/invitations' },
  { label: 'New institution', icon: PlusCircle, to: '/app/onboarding' },
  { label: 'Account settings', icon: Settings, to: '/app/settings' },
];

export const SETTINGS_NAV: NavItem = {
  label: 'Account settings',
  icon: Settings,
  to: '/app/settings',
};

export function dbRoleToRoleKey(role: InstitutionRole): RoleKey {
  switch (role) {
    case 'institution_admin':
      return 'institution';
    case 'teacher':
      return 'teacher';
    case 'student':
      return 'student';
    case 'invigilator':
      return 'invigilator';
  }
}

export function roleKeyToDbRole(roleKey: RoleKey): InstitutionRole | null {
  switch (roleKey) {
    case 'institution':
      return 'institution_admin';
    case 'teacher':
      return 'teacher';
    case 'student':
      return 'student';
    case 'invigilator':
      return 'invigilator';
    case 'super-admin':
      return null;
  }
}
