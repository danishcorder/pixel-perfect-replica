import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FolderTree,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/app/page-header';
import { RoleGuard } from '@/components/app/role-guard';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import {
  createAcademicClassFn,
  createAcademicSessionFn,
  createAcademicTermFn,
  createClassSectionFn,
  createCourseFn,
  createDepartmentFn,
  createProgramFn,
  deleteAcademicClassFn,
  deleteAcademicSessionFn,
  deleteAcademicTermFn,
  deleteClassSectionFn,
  deleteCourseFn,
  deleteDepartmentFn,
  deleteProgramFn,
  getAcademicCatalogFn,
  setCurrentAcademicSessionFn,
} from '@/lib/academic.functions';
import type { AcademicCycleStatus } from '@/integrations/supabase/types';

export const Route = createFileRoute('/app/academics')({
  head: () => ({
    meta: [
      { title: 'Academic structure — ExamFlow' },
      { name: 'description', content: 'Manage sessions, terms, departments, programs, classes, sections, and courses.' },
    ],
  }),
  component: AcademicsPage,
});

const NONE = '__none__';

function AcademicsPage() {
  const { user, activeInstitutionId, activeMembership, authHeaders } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  // Session form
  const [sessName, setSessName] = useState('');
  const [sessCode, setSessCode] = useState('');
  const [sessStart, setSessStart] = useState('2026-09-01');
  const [sessEnd, setSessEnd] = useState('2027-06-30');
  const [sessStatus, setSessStatus] = useState<AcademicCycleStatus>('active');
  const [sessCurrent, setSessCurrent] = useState(true);

  // Term form
  const [termSessionId, setTermSessionId] = useState('');
  const [termName, setTermName] = useState('');
  const [termStart, setTermStart] = useState('2026-09-01');
  const [termEnd, setTermEnd] = useState('2026-12-20');
  const [termStatus, setTermStatus] = useState<AcademicCycleStatus>('active');
  const [termCurrent, setTermCurrent] = useState(true);

  // Department form
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptHeadId, setDeptHeadId] = useState(NONE);

  // Program form
  const [progName, setProgName] = useState('');
  const [progCode, setProgCode] = useState('');
  const [progDeptId, setProgDeptId] = useState(NONE);
  const [progYears, setProgYears] = useState('4');

  // Class form
  const [clsName, setClsName] = useState('');
  const [clsCode, setClsCode] = useState('');
  const [clsProgId, setClsProgId] = useState(NONE);
  const [clsOrder, setClsOrder] = useState('1');

  // Section form
  const [secClassId, setSecClassId] = useState('');
  const [secName, setSecName] = useState('');
  const [secCapacity, setSecCapacity] = useState('60');

  // Course form
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCredits, setCourseCredits] = useState('3');
  const [courseDeptId, setCourseDeptId] = useState(NONE);
  const [courseProgId, setCourseProgId] = useState(NONE);
  const [courseClassId, setCourseClassId] = useState(NONE);

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

  async function runAction(fn: () => Promise<unknown>, successMsg: string) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }

  const cat = catalogQuery.data;
  const effectiveTermSessionId = termSessionId || cat?.sessions[0]?.id || '';
  const effectiveSecClassId = secClassId || cat?.classes[0]?.id || '';

  return (
    <RoleGuard requiredRole="institution">
      <PageHeader
        title="Academic structure"
        description={
          activeMembership
            ? `Configure sessions, terms, departments, programs, classes, sections, and courses for ${activeMembership.institution.name}.`
            : 'Configure institution academic structure.'
        }
      />

      {catalogQuery.isLoading ? (
        <LoadingState label="Loading academic catalog…" />
      ) : catalogQuery.error ? (
        <ErrorState
          title="Could not load academic structure"
          description={
            catalogQuery.error instanceof Error ? catalogQuery.error.message : 'Unknown error'
          }
          onRetry={() => {
            void refresh();
          }}
        />
      ) : !cat ? (
        <EmptyState title="Select an institution to continue" />
      ) : (
        <Tabs defaultValue="sessions" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="sessions">Sessions & terms</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="structure">Programs, classes & sections</TabsTrigger>
            <TabsTrigger value="courses">Courses & subjects</TabsTrigger>
          </TabsList>

          {/* 1. SESSIONS & TERMS */}
          <TabsContent value="sessions" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    New academic session
                  </CardTitle>
                  <CardDescription>e.g. Academic Year 2026–2027</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      if (!activeInstitutionId) return;
                      void runAction(async () => {
                        await createAcademicSessionFn({
                          data: {
                            institutionId: activeInstitutionId,
                            name: sessName,
                            code: sessCode,
                            startsOn: sessStart,
                            endsOn: sessEnd,
                            status: sessStatus,
                            isCurrent: sessCurrent,
                          },
                          headers: authHeaders(),
                        });
                        setSessName('');
                        setSessCode('');
                      }, 'Academic session created');
                    }}
                    className="space-y-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="sess-name">Session name</Label>
                        <Input
                          id="sess-name"
                          value={sessName}
                          onChange={(e) => setSessName(e.target.value)}
                          placeholder="Academic Year 2026-2027"
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sess-code">Code</Label>
                        <Input
                          id="sess-code"
                          value={sessCode}
                          onChange={(e) => setSessCode(e.target.value)}
                          placeholder="2026-2027"
                          required
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="sess-start">Starts on</Label>
                        <Input
                          id="sess-start"
                          type="date"
                          value={sessStart}
                          onChange={(e) => setSessStart(e.target.value)}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sess-end">Ends on</Label>
                        <Input
                          id="sess-end"
                          type="date"
                          value={sessEnd}
                          onChange={(e) => setSessEnd(e.target.value)}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sess-status">Status</Label>
                        <Select
                          value={sessStatus}
                          onValueChange={(v) => setSessStatus(v as AcademicCycleStatus)}
                        >
                          <SelectTrigger id="sess-status" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planned">Planned</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={sessCurrent}
                        onCheckedChange={(v) => setSessCurrent(v === true)}
                      />
                      Mark as current active session
                    </label>
                    <Button type="submit" disabled={busy || !sessName.trim() || !sessCode.trim()}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Create session
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">New academic term</CardTitle>
                  <CardDescription>Terms belong to an academic session (e.g. Fall 2026).</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      if (!activeInstitutionId || !effectiveTermSessionId) return;
                      void runAction(async () => {
                        await createAcademicTermFn({
                          data: {
                            institutionId: activeInstitutionId,
                            sessionId: effectiveTermSessionId,
                            name: termName,
                            startsOn: termStart,
                            endsOn: termEnd,
                            status: termStatus,
                            isCurrent: termCurrent,
                          },
                          headers: authHeaders(),
                        });
                        setTermName('');
                      }, 'Academic term created');
                    }}
                    className="space-y-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="term-sess">Academic session</Label>
                        <Select
                          value={effectiveTermSessionId}
                          onValueChange={setTermSessionId}
                        >
                          <SelectTrigger id="term-sess" className="mt-1">
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
                        <Label htmlFor="term-name">Term name</Label>
                        <Input
                          id="term-name"
                          value={termName}
                          onChange={(e) => setTermName(e.target.value)}
                          placeholder="Fall Semester"
                          required
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="term-start">Starts on</Label>
                        <Input
                          id="term-start"
                          type="date"
                          value={termStart}
                          onChange={(e) => setTermStart(e.target.value)}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="term-end">Ends on</Label>
                        <Input
                          id="term-end"
                          type="date"
                          value={termEnd}
                          onChange={(e) => setTermEnd(e.target.value)}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="term-status">Status</Label>
                        <Select
                          value={termStatus}
                          onValueChange={(v) => setTermStatus(v as AcademicCycleStatus)}
                        >
                          <SelectTrigger id="term-status" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planned">Planned</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={termCurrent}
                        onCheckedChange={(v) => setTermCurrent(v === true)}
                      />
                      Mark as current term
                    </label>
                    <Button
                      type="submit"
                      disabled={busy || !effectiveTermSessionId || !termName.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Create term
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Sessions ({cat.sessions.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cat.sessions.length === 0 ? (
                    <EmptyState title="No academic sessions yet" />
                  ) : (
                    cat.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                            {s.is_current && <StatusPill tone="success">Current</StatusPill>}
                            <StatusPill tone={s.status === 'active' ? 'info' : 'neutral'}>
                              {s.status}
                            </StatusPill>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {s.starts_on} → {s.ends_on}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!s.is_current && activeInstitutionId && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void runAction(
                                  () =>
                                    setCurrentAcademicSessionFn({
                                      data: { institutionId: activeInstitutionId, sessionId: s.id },
                                      headers: authHeaders(),
                                    }),
                                  'Current session updated',
                                )
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Set current
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            aria-label="Delete session"
                            onClick={() =>
                              activeInstitutionId &&
                              void runAction(
                                () =>
                                  deleteAcademicSessionFn({
                                    data: { institutionId: activeInstitutionId, sessionId: s.id },
                                    headers: authHeaders(),
                                  }),
                                'Session deleted',
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Terms ({cat.terms.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cat.terms.length === 0 ? (
                    <EmptyState title="No academic terms yet" />
                  ) : (
                    cat.terms.map((t) => {
                      const parentSession = cat.sessions.find((s) => s.id === t.session_id);
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 rounded-lg border p-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{t.name}</span>
                              {t.is_current && <StatusPill tone="success">Current</StatusPill>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {parentSession?.name ?? 'Session'} · {t.starts_on} → {t.ends_on}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            aria-label="Delete term"
                            onClick={() =>
                              activeInstitutionId &&
                              void runAction(
                                () =>
                                  deleteAcademicTermFn({
                                    data: { institutionId: activeInstitutionId, termId: t.id },
                                    headers: authHeaders(),
                                  }),
                                'Term deleted',
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 2. DEPARTMENTS */}
          <TabsContent value="departments" className="grid gap-6 lg:grid-cols-12">
            <Card className="shadow-none lg:col-span-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderTree className="h-4 w-4 text-primary" />
                  Create department
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (!activeInstitutionId) return;
                    void runAction(async () => {
                      await createDepartmentFn({
                        data: {
                          institutionId: activeInstitutionId,
                          name: deptName,
                          code: deptCode,
                          description: deptDesc.trim() ? deptDesc.trim() : null,
                          headMembershipId: deptHeadId === NONE ? null : deptHeadId,
                        },
                        headers: authHeaders(),
                      });
                      setDeptName('');
                      setDeptCode('');
                      setDeptDesc('');
                      setDeptHeadId(NONE);
                    }, 'Department created');
                  }}
                  className="space-y-3"
                >
                  <div>
                    <Label htmlFor="dept-name">Department name</Label>
                    <Input
                      id="dept-name"
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="Computer Science"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dept-code">Code</Label>
                    <Input
                      id="dept-code"
                      value={deptCode}
                      onChange={(e) => setDeptCode(e.target.value)}
                      placeholder="CS"
                      className="mt-1 uppercase"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dept-head">Department head (optional)</Label>
                    <Select value={deptHeadId} onValueChange={setDeptHeadId}>
                      <SelectTrigger id="dept-head" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None assigned</SelectItem>
                        {cat.teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.profile?.full_name || t.profile?.email || t.user_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dept-desc">Description</Label>
                    <Input
                      id="dept-desc"
                      value={deptDesc}
                      onChange={(e) => setDeptDesc(e.target.value)}
                      placeholder="Optional overview"
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" disabled={busy || !deptName.trim() || !deptCode.trim()}>
                    <Plus className="h-4 w-4" />
                    Add department
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-none lg:col-span-7">
              <CardHeader>
                <CardTitle className="text-base">Departments ({cat.departments.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cat.departments.length === 0 ? (
                  <EmptyState title="No departments yet" />
                ) : (
                  cat.departments.map((d) => {
                    const head = cat.teachers.find((t) => t.id === d.head_membership_id);
                    return (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{d.name}</span>
                            <StatusPill tone="neutral">{d.code}</StatusPill>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {head
                              ? `Head: ${head.profile?.full_name || head.profile?.email}`
                              : d.description || 'No description'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            activeInstitutionId &&
                            void runAction(
                              () =>
                                deleteDepartmentFn({
                                  data: { institutionId: activeInstitutionId, departmentId: d.id },
                                  headers: authHeaders(),
                                }),
                              'Department deleted',
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. PROGRAMS, CLASSES & SECTIONS */}
          <TabsContent value="structure" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Program */}
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    New program
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      if (!activeInstitutionId) return;
                      void runAction(async () => {
                        await createProgramFn({
                          data: {
                            institutionId: activeInstitutionId,
                            name: progName,
                            code: progCode,
                            departmentId: progDeptId === NONE ? null : progDeptId,
                            durationYears: Number(progYears) || 4,
                          },
                          headers: authHeaders(),
                        });
                        setProgName('');
                        setProgCode('');
                      }, 'Program created');
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <Label htmlFor="prog-name">Program name</Label>
                      <Input
                        id="prog-name"
                        value={progName}
                        onChange={(e) => setProgName(e.target.value)}
                        placeholder="BS Computer Science"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="prog-code">Code</Label>
                        <Input
                          id="prog-code"
                          value={progCode}
                          onChange={(e) => setProgCode(e.target.value)}
                          placeholder="BSCS"
                          className="mt-1 uppercase"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prog-yrs">Years</Label>
                        <Input
                          id="prog-yrs"
                          type="number"
                          min={1}
                          max={10}
                          value={progYears}
                          onChange={(e) => setProgYears(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="prog-dept">Department</Label>
                      <Select value={progDeptId} onValueChange={setProgDeptId}>
                        <SelectTrigger id="prog-dept" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {cat.departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={busy || !progName.trim() || !progCode.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Add program
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Class */}
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-4 w-4 text-primary" />
                    New class / cohort
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      if (!activeInstitutionId) return;
                      void runAction(async () => {
                        await createAcademicClassFn({
                          data: {
                            institutionId: activeInstitutionId,
                            name: clsName,
                            code: clsCode,
                            programId: clsProgId === NONE ? null : clsProgId,
                            levelOrder: Number(clsOrder) || 1,
                          },
                          headers: authHeaders(),
                        });
                        setClsName('');
                        setClsCode('');
                      }, 'Class created');
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <Label htmlFor="cls-name">Class name</Label>
                      <Input
                        id="cls-name"
                        value={clsName}
                        onChange={(e) => setClsName(e.target.value)}
                        placeholder="Year 1 / Grade 11"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="cls-code">Code</Label>
                        <Input
                          id="cls-code"
                          value={clsCode}
                          onChange={(e) => setClsCode(e.target.value)}
                          placeholder="CS-Y1"
                          className="mt-1 uppercase"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cls-order">Level</Label>
                        <Input
                          id="cls-order"
                          type="number"
                          min={1}
                          max={20}
                          value={clsOrder}
                          onChange={(e) => setClsOrder(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="cls-prog">Program</Label>
                      <Select value={clsProgId} onValueChange={setClsProgId}>
                        <SelectTrigger id="cls-prog" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {cat.programs.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={busy || !clsName.trim() || !clsCode.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Add class
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Section */}
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">New section</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      if (!activeInstitutionId || !effectiveSecClassId) return;
                      void runAction(async () => {
                        await createClassSectionFn({
                          data: {
                            institutionId: activeInstitutionId,
                            classId: effectiveSecClassId,
                            name: secName,
                            capacity: Number(secCapacity) || 60,
                          },
                          headers: authHeaders(),
                        });
                        setSecName('');
                      }, 'Section created');
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <Label htmlFor="sec-class">Class</Label>
                      <Select value={effectiveSecClassId} onValueChange={setSecClassId}>
                        <SelectTrigger id="sec-class" className="mt-1">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {cat.classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({c.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="sec-name">Section name</Label>
                        <Input
                          id="sec-name"
                          value={secName}
                          onChange={(e) => setSecName(e.target.value)}
                          placeholder="A"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sec-cap">Capacity</Label>
                        <Input
                          id="sec-cap"
                          type="number"
                          min={1}
                          max={2000}
                          value={secCapacity}
                          onChange={(e) => setSecCapacity(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={busy || !effectiveSecClassId || !secName.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Add section
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Programs ({cat.programs.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cat.programs.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.code} · {p.duration_years}y
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          activeInstitutionId &&
                          void runAction(
                            () =>
                              deleteProgramFn({
                                data: { institutionId: activeInstitutionId, programId: p.id },
                                headers: authHeaders(),
                              }),
                            'Program deleted',
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {cat.programs.length === 0 && (
                    <p className="text-sm text-muted-foreground">No programs yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Classes ({cat.classes.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cat.classes.map((c) => {
                    const prog = cat.programs.find((p) => p.id === c.program_id);
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {c.name} <span className="text-xs text-muted-foreground">({c.code})</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {prog ? prog.name : 'General'} · Level {c.level_order}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            activeInstitutionId &&
                            void runAction(
                              () =>
                                deleteAcademicClassFn({
                                  data: { institutionId: activeInstitutionId, classId: c.id },
                                  headers: authHeaders(),
                                }),
                              'Class deleted',
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  {cat.classes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No classes yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Sections ({cat.sections.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cat.sections.map((sec) => {
                    const cls = cat.classes.find((c) => c.id === sec.class_id);
                    return (
                      <div
                        key={sec.id}
                        className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {cls?.name ?? 'Class'} — Section {sec.name}
                          </p>
                          <p className="text-xs text-muted-foreground">Capacity: {sec.capacity}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            activeInstitutionId &&
                            void runAction(
                              () =>
                                deleteClassSectionFn({
                                  data: { institutionId: activeInstitutionId, sectionId: sec.id },
                                  headers: authHeaders(),
                                }),
                              'Section deleted',
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  {cat.sections.length === 0 && (
                    <p className="text-sm text-muted-foreground">No sections yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 4. COURSES & SUBJECTS */}
          <TabsContent value="courses" className="grid gap-6 lg:grid-cols-12">
            <Card className="shadow-none lg:col-span-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Create course / subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (!activeInstitutionId) return;
                    void runAction(async () => {
                      await createCourseFn({
                        data: {
                          institutionId: activeInstitutionId,
                          code: courseCode,
                          title: courseTitle,
                          credits: Number(courseCredits) || 3,
                          departmentId: courseDeptId === NONE ? null : courseDeptId,
                          programId: courseProgId === NONE ? null : courseProgId,
                          classId: courseClassId === NONE ? null : courseClassId,
                        },
                        headers: authHeaders(),
                      });
                      setCourseCode('');
                      setCourseTitle('');
                    }, 'Course created');
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <Label htmlFor="course-code">Code</Label>
                      <Input
                        id="course-code"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                        placeholder="CS-101"
                        className="mt-1 uppercase"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="course-title">Subject title</Label>
                      <Input
                        id="course-title"
                        value={courseTitle}
                        onChange={(e) => setCourseTitle(e.target.value)}
                        placeholder="Introduction to Computing"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="course-credits">Credits</Label>
                      <Input
                        id="course-credits"
                        type="number"
                        step="0.5"
                        min={0}
                        max={30}
                        value={courseCredits}
                        onChange={(e) => setCourseCredits(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="course-dept">Department</Label>
                      <Select value={courseDeptId} onValueChange={setCourseDeptId}>
                        <SelectTrigger id="course-dept" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {cat.departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="course-prog">Program</Label>
                      <Select value={courseProgId} onValueChange={setCourseProgId}>
                        <SelectTrigger id="course-prog" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {cat.programs.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="course-cls">Class</Label>
                      <Select value={courseClassId} onValueChange={setCourseClassId}>
                        <SelectTrigger id="course-cls" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {cat.classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={busy || !courseCode.trim() || !courseTitle.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    Add course
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-none lg:col-span-7">
              <CardHeader>
                <CardTitle className="text-base">Courses & subjects ({cat.courses.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cat.courses.length === 0 ? (
                  <EmptyState title="No courses added yet" />
                ) : (
                  cat.courses.map((c) => {
                    const dept = cat.departments.find((d) => d.id === c.department_id);
                    const cls = cat.classes.find((x) => x.id === c.class_id);
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <StatusPill tone="info">{c.code}</StatusPill>
                            <span className="font-medium">{c.title}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.credits} credits
                            {dept ? ` · ${dept.name}` : ''}
                            {cls ? ` · ${cls.name}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            activeInstitutionId &&
                            void runAction(
                              () =>
                                deleteCourseFn({
                                  data: { institutionId: activeInstitutionId, courseId: c.id },
                                  headers: authHeaders(),
                                }),
                              'Course deleted',
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </RoleGuard>
  );
}
