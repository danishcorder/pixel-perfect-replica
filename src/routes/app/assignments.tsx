import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/app/page-header';
import { RoleGuard } from '@/components/app/role-guard';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import {
  createTeacherAssignmentFn,
  deleteTeacherAssignmentFn,
  getAcademicCatalogFn,
} from '@/lib/academic.functions';

export const Route = createFileRoute('/app/assignments')({
  head: () => ({
    meta: [
      { title: 'Teacher assignments — ExamFlow' },
      { name: 'description', content: 'Assign teachers to courses, sessions, terms, and sections.' },
    ],
  }),
  component: AssignmentsPage,
});

const NONE = '__none__';

function AssignmentsPage() {
  const { user, activeInstitutionId, activeMembership, authHeaders, workspace } = useAuth();
  const queryClient = useQueryClient();

  const [membershipId, setMembershipId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [termId, setTermId] = useState(NONE);
  const [sectionId, setSectionId] = useState(NONE);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin =
    workspace?.isSuperAdmin || activeMembership?.role === 'institution_admin';

  const catalogQuery = useQuery({
    queryKey: ['academic-catalog', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return getAcademicCatalogFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['academic-catalog', activeInstitutionId, user?.id],
    });
  }

  const cat = catalogQuery.data;
  const effMembershipId = membershipId || cat?.teachers[0]?.id || '';
  const effCourseId = courseId || cat?.courses[0]?.id || '';
  const effSessionId = sessionId || cat?.sessions[0]?.id || '';

  async function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeInstitutionId || !effMembershipId || !effCourseId || !effSessionId) return;
    setBusy(true);
    try {
      await createTeacherAssignmentFn({
        data: {
          institutionId: activeInstitutionId,
          membershipId: effMembershipId,
          courseId: effCourseId,
          academicSessionId: effSessionId,
          academicTermId: termId === NONE ? null : termId,
          classSectionId: sectionId === NONE ? null : sectionId,
        },
        headers: authHeaders(),
      });
      await refresh();
      toast.success('Teacher assigned to course');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign teacher');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(assignmentId: string) {
    if (!activeInstitutionId) return;
    setBusy(true);
    try {
      await deleteTeacherAssignmentFn({
        data: { institutionId: activeInstitutionId, assignmentId },
        headers: authHeaders(),
      });
      await refresh();
      toast.success('Assignment removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove assignment');
    } finally {
      setBusy(false);
    }
  }

  const filteredAssignments = (cat?.assignments ?? []).filter((a) => {
    if (!isAdmin && activeMembership && a.membership_id !== activeMembership.id) {
      return false;
    }
    if (!search.trim()) return true;
    const teacher = cat?.teachers.find((t) => t.id === a.membership_id);
    const course = cat?.courses.find((c) => c.id === a.course_id);
    const hay = [
      teacher?.profile?.full_name ?? '',
      teacher?.profile?.email ?? '',
      course?.code ?? '',
      course?.title ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(search.trim().toLowerCase());
  });

  return (
    <RoleGuard allowedRoles={['institution', 'teacher']}>
      <PageHeader
        title="Teacher assignments"
        description={
          isAdmin
            ? 'Assign verified teachers in this institution to courses, sessions, and class sections.'
            : 'Your assigned courses and sections for the current institution.'
        }
      />

      {catalogQuery.isLoading ? (
        <LoadingState label="Loading teacher assignments…" />
      ) : catalogQuery.error ? (
        <ErrorState
          title="Could not load assignments"
          description={
            catalogQuery.error instanceof Error ? catalogQuery.error.message : 'Unknown error'
          }
          onRetry={() => {
            void refresh();
          }}
        />
      ) : !cat ? (
        <EmptyState title="No institution selected" />
      ) : (
        <div className="space-y-6">
          {isAdmin && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Assign teacher to course
                </CardTitle>
                <CardDescription>
                  PostgreSQL triggers verify that the teacher, course, session, and section all belong to this institution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onAssign} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="assign-teacher">Teacher / Admin</Label>
                    <Select value={effMembershipId} onValueChange={setMembershipId}>
                      <SelectTrigger id="assign-teacher" className="mt-1">
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {cat.teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.profile?.full_name || t.profile?.email || t.user_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="assign-course">Course / Subject</Label>
                    <Select value={effCourseId} onValueChange={setCourseId}>
                      <SelectTrigger id="assign-course" className="mt-1">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {cat.courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="assign-session">Academic session</Label>
                    <Select value={effSessionId} onValueChange={setSessionId}>
                      <SelectTrigger id="assign-session" className="mt-1">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {cat.sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="assign-term">Term (optional)</Label>
                    <Select value={termId} onValueChange={setTermId}>
                      <SelectTrigger id="assign-term" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Full session</SelectItem>
                        {cat.terms
                          .filter((t) => t.session_id === effSessionId)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="assign-section">Class section (optional)</Label>
                    <Select value={sectionId} onValueChange={setSectionId}>
                      <SelectTrigger id="assign-section" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>All sections</SelectItem>
                        {cat.sections.map((sec) => {
                          const cls = cat.classes.find((c) => c.id === sec.class_id);
                          return (
                            <SelectItem key={sec.id} value={sec.id}>
                              {cls?.name ?? 'Class'} — Section {sec.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        busy || !effMembershipId || !effCourseId || !effSessionId
                      }
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Assign teacher
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-none">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">
                Assignments ({filteredAssignments.length})
              </CardTitle>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teacher or course…"
                className="h-9 w-60"
              />
            </CardHeader>
            <CardContent>
              {filteredAssignments.length === 0 ? (
                <EmptyState title="No teacher assignments found" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Session / Term</TableHead>
                        <TableHead>Section</TableHead>
                        {isAdmin && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.map((a) => {
                        const teacher = cat.teachers.find((t) => t.id === a.membership_id);
                        const course = cat.courses.find((c) => c.id === a.course_id);
                        const sess = cat.sessions.find((s) => s.id === a.academic_session_id);
                        const term = a.academic_term_id
                          ? cat.terms.find((t) => t.id === a.academic_term_id)
                          : null;
                        const sec = a.class_section_id
                          ? cat.sections.find((s) => s.id === a.class_section_id)
                          : null;
                        const cls = sec ? cat.classes.find((c) => c.id === sec.class_id) : null;

                        return (
                          <TableRow key={a.id}>
                            <TableCell>
                              <p className="font-medium">
                                {teacher?.profile?.full_name || teacher?.profile?.email || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {teacher?.profile?.email}
                              </p>
                            </TableCell>
                            <TableCell>
                              <StatusPill tone="info">{course?.code ?? '—'}</StatusPill>{' '}
                              <span className="ml-1 text-sm">{course?.title ?? '—'}</span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {sess?.name ?? '—'}
                              {term ? ` · ${term.name}` : ''}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {sec ? `${cls?.name ?? ''} — ${sec.name}` : 'All sections'}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void onDelete(a.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
