import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/app/page-header';
import { RoleGuard } from '@/components/app/role-guard';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import {
  createStudentFn,
  deleteStudentFn,
  enrollStudentFn,
  getAcademicCatalogFn,
  importStudentsCsvFn,
  listCsvImportJobsFn,
  listStudentsFn,
  updateEnrollmentStatusFn,
} from '@/lib/academic.functions';
import type { CsvImportSummary } from '@/lib/academic.server';
import { parseAndValidateStudentCsv, SAMPLE_STUDENT_CSV } from '@/lib/csv';
import type { EnrollmentStatus, StudentRecordStatus } from '@/integrations/supabase/types';

export const Route = createFileRoute('/app/students')({
  head: () => ({
    meta: [
      { title: 'Students & CSV Import — ExamFlow' },
      { name: 'description', content: 'Manage student records, enrollments, and CSV bulk import.' },
    ],
  }),
  component: StudentsPage,
});

const ALL = '__all__';
const NONE = '__none__';

function StudentsPage() {
  const { user, activeInstitutionId, activeMembership, authHeaders, workspace } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin =
    workspace?.isSuperAdmin || activeMembership?.role === 'institution_admin';

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentRecordStatus>('all');
  const [sessionFilter, setSessionFilter] = useState(ALL);
  const [programFilter, setProgramFilter] = useState(ALL);
  const [sectionFilter, setSectionFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Individual student create + enroll form
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [enrollSessionId, setEnrollSessionId] = useState(NONE);
  const [enrollSectionId, setEnrollSectionId] = useState(NONE);
  const [busy, setBusy] = useState(false);

  // Enroll existing student quick form
  const [enrollTargetStudentId, setEnrollTargetStudentId] = useState(NONE);
  const [existingEnrSessionId, setExistingEnrSessionId] = useState(NONE);
  const [existingEnrSectionId, setExistingEnrSectionId] = useState(NONE);

  // CSV import
  const [csvFileName, setCsvFileName] = useState('students.csv');
  const [csvText, setCsvText] = useState('');
  const [csvDefaultSessionId, setCsvDefaultSessionId] = useState(NONE);
  const [csvDefaultSectionId, setCsvDefaultSectionId] = useState(NONE);
  const [importResult, setImportResult] = useState<CsvImportSummary | null>(null);
  const [importing, setImporting] = useState(false);

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

  const studentsQuery = useQuery({
    queryKey: [
      'students-directory',
      activeInstitutionId,
      user?.id,
      search,
      statusFilter,
      sessionFilter,
      programFilter,
      sectionFilter,
      page,
    ],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return listStudentsFn({
        data: {
          institutionId: activeInstitutionId,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(sessionFilter !== ALL ? { sessionId: sessionFilter } : {}),
          ...(programFilter !== ALL ? { programId: programFilter } : {}),
          ...(sectionFilter !== ALL ? { sectionId: sectionFilter } : {}),
          page,
          pageSize,
        },
        headers: authHeaders(),
      });
    },
  });

  const importJobsQuery = useQuery({
    queryKey: ['csv-import-jobs', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId && isAdmin),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return listCsvImportJobsFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  async function refreshAll() {
    await queryClient.invalidateQueries({
      queryKey: ['students-directory', activeInstitutionId, user?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['csv-import-jobs', activeInstitutionId, user?.id],
    });
  }

  const csvPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    return parseAndValidateStudentCsv(csvText);
  }, [csvText]);

  async function onCreateStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeInstitutionId) return;
    setBusy(true);
    try {
      await createStudentFn({
        data: {
          institutionId: activeInstitutionId,
          studentCode,
          fullName,
          email: email.trim() ? email.trim() : null,
          phone: phone.trim() ? phone.trim() : null,
          academicSessionId: enrollSessionId === NONE ? null : enrollSessionId,
          classSectionId: enrollSectionId === NONE ? null : enrollSectionId,
        },
        headers: authHeaders(),
      });
      setStudentCode('');
      setFullName('');
      setEmail('');
      setPhone('');
      await refreshAll();
      toast.success('Student record saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add student');
    } finally {
      setBusy(false);
    }
  }

  async function onEnrollExisting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !activeInstitutionId ||
      enrollTargetStudentId === NONE ||
      existingEnrSessionId === NONE ||
      existingEnrSectionId === NONE
    ) {
      return;
    }
    setBusy(true);
    try {
      await enrollStudentFn({
        data: {
          institutionId: activeInstitutionId,
          studentId: enrollTargetStudentId,
          academicSessionId: existingEnrSessionId,
          classSectionId: existingEnrSectionId,
        },
        headers: authHeaders(),
      });
      setEnrollTargetStudentId(NONE);
      await refreshAll();
      toast.success('Student enrolled in section');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRunCsvImport() {
    if (!activeInstitutionId || !csvText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const summary = await importStudentsCsvFn({
        data: {
          institutionId: activeInstitutionId,
          fileName: csvFileName || 'students.csv',
          csvText,
          defaultSessionId: csvDefaultSessionId === NONE ? null : csvDefaultSessionId,
          defaultSectionId: csvDefaultSectionId === NONE ? null : csvDefaultSectionId,
        },
        headers: authHeaders(),
      });
      setImportResult(summary);
      await refreshAll();
      if (summary.importedCount > 0) {
        toast.success(`Imported ${summary.importedCount} student(s)`);
      } else {
        toast.error('No rows were imported — review validation errors');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImporting(false);
    }
  }

  function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
    };
    reader.readAsText(file);
  }

  function downloadSampleCsv() {
    const blob = new Blob([SAMPLE_STUDENT_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'examflow-students-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const cat = catalogQuery.data;
  const res = studentsQuery.data;

  return (
    <RoleGuard allowedRoles={['institution', 'teacher']}>
      <PageHeader
        title="Students, enrollments & CSV import"
        description={
          activeMembership
            ? `Institution-isolated student roster for ${activeMembership.institution.name}.`
            : 'Manage student records and enrollments.'
        }
      />

      <Tabs defaultValue="roster" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="roster">Student roster</TabsTrigger>
          {isAdmin && <TabsTrigger value="add">Add & enroll</TabsTrigger>}
          {isAdmin && <TabsTrigger value="csv">CSV import</TabsTrigger>}
        </TabsList>

        {/* 1. ROSTER WITH SEARCH, FILTERING & PAGINATION */}
        <TabsContent value="roster" className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Student roster ({res?.total ?? 0})
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search code, name, email, class…"
                    className="h-9 pl-8"
                  />
                </div>

                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as 'all' | StudentRecordStatus);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="graduated">Graduated</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sessionFilter}
                  onValueChange={(v) => {
                    setSessionFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[170px]">
                    <SelectValue placeholder="All sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All sessions</SelectItem>
                    {(cat?.sessions ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={programFilter}
                  onValueChange={(v) => {
                    setProgramFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder="All programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All programs</SelectItem>
                    {(cat?.programs ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sectionFilter}
                  onValueChange={(v) => {
                    setSectionFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All sections</SelectItem>
                    {(cat?.sections ?? []).map((sec) => {
                      const cls = cat?.classes.find((c) => c.id === sec.class_id);
                      return (
                        <SelectItem key={sec.id} value={sec.id}>
                          {cls?.name ?? 'Class'} — {sec.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {studentsQuery.isLoading ? (
                <LoadingState label="Loading students…" />
              ) : studentsQuery.error ? (
                <ErrorState
                  title="Could not load student roster"
                  description={
                    studentsQuery.error instanceof Error
                      ? studentsQuery.error.message
                      : 'Unknown error'
                  }
                  onRetry={() => {
                    void studentsQuery.refetch();
                  }}
                />
              ) : !res || res.items.length === 0 ? (
                <EmptyState
                  title="No students found"
                  description="Add students individually or import a CSV roster."
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student code</TableHead>
                          <TableHead>Name & email</TableHead>
                          <TableHead>Enrollments</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {res.items.map((st) => (
                          <TableRow key={st.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {st.student_code}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{st.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {st.email ?? 'No email'}
                                {st.phone ? ` · ${st.phone}` : ''}
                              </p>
                            </TableCell>
                            <TableCell>
                              {st.enrollments.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Not enrolled</span>
                              ) : (
                                <div className="space-y-1">
                                  {st.enrollments.map((enr) => (
                                    <div key={enr.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                                      <StatusPill
                                        tone={
                                          enr.status === 'enrolled'
                                            ? 'success'
                                            : enr.status === 'completed'
                                              ? 'info'
                                              : 'neutral'
                                        }
                                      >
                                        {enr.className} ({enr.sectionName})
                                      </StatusPill>
                                      <span className="text-muted-foreground">{enr.sessionName}</span>
                                      {isAdmin && (
                                        <Select
                                          value={enr.status}
                                          onValueChange={(v) => {
                                            if (!activeInstitutionId) return;
                                            void updateEnrollmentStatusFn({
                                              data: {
                                                institutionId: activeInstitutionId,
                                                enrollmentId: enr.id,
                                                status: v as EnrollmentStatus,
                                              },
                                              headers: authHeaders(),
                                            }).then(() => {
                                              void refreshAll();
                                              toast.success('Enrollment updated');
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="h-6 w-[100px] text-[11px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="enrolled">enrolled</SelectItem>
                                            <SelectItem value="completed">completed</SelectItem>
                                            <SelectItem value="dropped">dropped</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusPill
                                tone={st.status === 'active' ? 'success' : 'warning'}
                              >
                                {st.status}
                              </StatusPill>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  aria-label="Delete student"
                                  onClick={() => {
                                    if (!activeInstitutionId) return;
                                    void deleteStudentFn({
                                      data: {
                                        institutionId: activeInstitutionId,
                                        studentId: st.id,
                                      },
                                      headers: authHeaders(),
                                    }).then(() => {
                                      void refreshAll();
                                      toast.success('Student deleted');
                                    });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                    <span>
                      Page {res.page} of {res.totalPages} ({res.total} total)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={res.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={res.page >= res.totalPages}
                        onClick={() => setPage((p) => Math.min(res.totalPages, p + 1))}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. ADD STUDENT & ENROLLMENT */}
        {isAdmin && (
          <TabsContent value="add" className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Add student (with optional enrollment)</CardTitle>
                <CardDescription>
                  If the student already accepted an ExamFlow invitation with this email, their account links automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onCreateStudent} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="st-code">Student code / roll no</Label>
                      <Input
                        id="st-code"
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        placeholder="STU-2026-001"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="st-name">Full name</Label>
                      <Input
                        id="st-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Amina Tariq"
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="st-email">Email (optional)</Label>
                      <Input
                        id="st-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="amina@university.edu"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="st-phone">Phone (optional)</Label>
                      <Input
                        id="st-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="st-sess">Enroll in session (optional)</Label>
                      <Select value={enrollSessionId} onValueChange={setEnrollSessionId}>
                        <SelectTrigger id="st-sess" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Do not enroll yet</SelectItem>
                          {(cat?.sessions ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="st-sec">Enroll in section (optional)</Label>
                      <Select value={enrollSectionId} onValueChange={setEnrollSectionId}>
                        <SelectTrigger id="st-sec" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Select section</SelectItem>
                          {(cat?.sections ?? []).map((sec) => {
                            const cls = cat?.classes.find((c) => c.id === sec.class_id);
                            return (
                              <SelectItem key={sec.id} value={sec.id}>
                                {cls?.name ?? 'Class'} — {sec.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={busy || !studentCode.trim() || !fullName.trim()}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create student
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Enroll existing student into a section</CardTitle>
                <CardDescription>
                  Composite tenant foreign keys ensure the student, session, and section belong to this institution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onEnrollExisting} className="space-y-3">
                  <div>
                    <Label htmlFor="enr-st">Student</Label>
                    <Select
                      value={enrollTargetStudentId}
                      onValueChange={setEnrollTargetStudentId}
                    >
                      <SelectTrigger id="enr-st" className="mt-1">
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Select student…</SelectItem>
                        {(res?.items ?? []).map((st) => (
                          <SelectItem key={st.id} value={st.id}>
                            {st.student_code} — {st.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="enr-sess">Academic session</Label>
                    <Select
                      value={existingEnrSessionId}
                      onValueChange={setExistingEnrSessionId}
                    >
                      <SelectTrigger id="enr-sess" className="mt-1">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Select session…</SelectItem>
                        {(cat?.sessions ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="enr-sec">Class section</Label>
                    <Select
                      value={existingEnrSectionId}
                      onValueChange={setExistingEnrSectionId}
                    >
                      <SelectTrigger id="enr-sec" className="mt-1">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Select section…</SelectItem>
                        {(cat?.sections ?? []).map((sec) => {
                          const cls = cat?.classes.find((c) => c.id === sec.class_id);
                          return (
                            <SelectItem key={sec.id} value={sec.id}>
                              {cls?.name ?? 'Class'} — {sec.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      enrollTargetStudentId === NONE ||
                      existingEnrSessionId === NONE ||
                      existingEnrSectionId === NONE
                    }
                  >
                    Enroll student
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 3. CSV IMPORT WITH VALIDATION & ERROR REPORTING */}
        {isAdmin && (
          <TabsContent value="csv" className="space-y-6">
            <Card className="shadow-none">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    CSV student import
                  </CardTitle>
                  <CardDescription>
                    Required columns: student_code, full_name. Optional: email, phone, status, class_code, section_name, session_code.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={downloadSampleCsv}>
                  <Download className="h-4 w-4" />
                  Download sample CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="csv-file">Upload CSV file</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={onFileSelected}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="csv-def-sess">Default session (optional)</Label>
                    <Select
                      value={csvDefaultSessionId}
                      onValueChange={setCsvDefaultSessionId}
                    >
                      <SelectTrigger id="csv-def-sess" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Use CSV session_code only</SelectItem>
                        {(cat?.sessions ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="csv-def-sec">Default section (optional)</Label>
                    <Select
                      value={csvDefaultSectionId}
                      onValueChange={setCsvDefaultSectionId}
                    >
                      <SelectTrigger id="csv-def-sec" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Use CSV class_code/section_name</SelectItem>
                        {(cat?.sections ?? []).map((sec) => {
                          const cls = cat?.classes.find((c) => c.id === sec.class_id);
                          return (
                            <SelectItem key={sec.id} value={sec.id}>
                              {cls?.name ?? 'Class'} — {sec.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="csv-text">Or paste CSV data</Label>
                  <Textarea
                    id="csv-text"
                    rows={6}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      setImportResult(null);
                    }}
                    placeholder={SAMPLE_STUDENT_CSV}
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                {csvPreview && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                    <span>
                      Parsed rows: <strong>{csvPreview.totalRows}</strong>
                    </span>
                    <StatusPill tone="success">
                      {csvPreview.validRows.length} valid
                    </StatusPill>
                    {csvPreview.errors.length > 0 && (
                      <StatusPill tone="danger">
                        {csvPreview.errors.length} client validation issue(s)
                      </StatusPill>
                    )}
                  </div>
                )}

                <Button
                  disabled={importing || !csvText.trim()}
                  onClick={() => void onRunCsvImport()}
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Validate & import students
                </Button>

                {/* Validation / Server Error Report */}
                {(importResult || (csvPreview && csvPreview.errors.length > 0)) && (
                  <div className="space-y-3 rounded-xl border p-4">
                    {importResult && (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span>
                          Imported <strong>{importResult.importedCount}</strong> of{' '}
                          <strong>{importResult.totalRows}</strong> rows (
                          <strong>{importResult.enrolledCount}</strong> enrolled,{' '}
                          <strong>{importResult.errorCount}</strong> error(s)).
                        </span>
                      </div>
                    )}

                    {(importResult?.errors ?? csvPreview?.errors ?? []).length > 0 && (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          Row-level validation errors
                        </p>
                        <div className="max-h-60 overflow-y-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20">Row</TableHead>
                                <TableHead>Student code</TableHead>
                                <TableHead>Field</TableHead>
                                <TableHead>Error</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(importResult?.errors ?? csvPreview?.errors ?? []).map((err, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-xs">{err.row}</TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {err.studentCode ?? '—'}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {err.field ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-xs text-destructive">
                                    {err.message}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Recent CSV import jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {(importJobsQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No CSV imports recorded yet.</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    {importJobsQuery.data?.map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{job.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill tone="success">
                            {job.imported_count}/{job.total_rows} imported
                          </StatusPill>
                          {job.error_count > 0 && (
                            <StatusPill tone="danger">{job.error_count} errors</StatusPill>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </RoleGuard>
  );
}
