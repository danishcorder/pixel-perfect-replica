import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Lock,
  Plus,
  Search,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { ExamBuilderEditor } from '@/components/app/exam-builder-editor';
import { ExamPreviewDialog } from '@/components/app/exam-preview-dialog';
import { PageHeader } from '@/components/app/page-header';
import { RoleGuard } from '@/components/app/role-guard';
import { StatCard } from '@/components/app/stat-card';
import { StatusPill } from '@/components/app/status-pill';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/states';
import type { ExamStatus } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import {
  createExamDraftFn,
  getExamBuilderCatalogFn,
  getExamDetailFn,
  listExamsFn,
} from '@/lib/exams.functions';
import type { ExamDetail } from '@/lib/exams.server';

export const Route = createFileRoute('/app/exams')({
  head: () => ({
    meta: [
      { title: 'Exam Builder — ExamFlow' },
      {
        name: 'description',
        content:
          'Design, schedule, configure marking & randomization, assign cohorts, preview, and publish immutable exam versions.',
      },
    ],
  }),
  component: ExamBuilderPage,
});

const ALL = '__all__';
const NONE = '__none__';

function ExamBuilderPage() {
  const { user, activeInstitutionId, authHeaders } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExamStatus>('all');
  const [courseFilter, setCourseFilter] = useState(ALL);

  // Selected exam being edited
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ExamDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Preview dialog
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);

  // New exam draft dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState(NONE);
  const [newDuration, setNewDuration] = useState('60');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ['exam-builder-catalog', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return getExamBuilderCatalogFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  const examsQuery = useQuery({
    queryKey: [
      'exams-list',
      activeInstitutionId,
      user?.id,
      search,
      statusFilter,
      courseFilter,
    ],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return listExamsFn({
        data: {
          institutionId: activeInstitutionId,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(courseFilter !== ALL ? { courseId: courseFilter } : {}),
        },
        headers: authHeaders(),
      });
    },
  });

  const stats = useMemo(() => {
    const items = examsQuery.data ?? [];
    return {
      total: items.length,
      drafts: items.filter((e) => e.status === 'draft').length,
      published: items.filter((e) => e.status === 'published').length,
      closed: items.filter((e) => e.status === 'closed').length,
    };
  }, [examsQuery.data]);

  async function refreshList() {
    await queryClient.invalidateQueries({
      queryKey: ['exams-list', activeInstitutionId, user?.id],
    });
  }

  async function openExamEditor(examId: string) {
    if (!activeInstitutionId) return;
    setActiveExamId(examId);
    setLoadingDetail(true);
    try {
      const detail = await getExamDetailFn({
        data: { institutionId: activeInstitutionId, examId },
        headers: authHeaders(),
      });
      setActiveDetail(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load exam');
      setActiveExamId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreateDraft() {
    if (!activeInstitutionId) return;
    if (newTitle.trim().length < 2) {
      toast.error('Exam title must be at least 2 characters');
      return;
    }
    setCreating(true);
    try {
      const created = await createExamDraftFn({
        data: {
          institutionId: activeInstitutionId,
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          courseId: newCourseId === NONE ? null : newCourseId,
          durationMinutes: Number(newDuration) || 60,
          negativeMarkingEnabled: false,
          defaultNegativeMarks: 0,
          shuffleQuestions: false,
          shuffleOptions: false,
        },
        headers: authHeaders(),
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewDuration('60');
      setActiveExamId(created.exam.id);
      setActiveDetail(created);
      await refreshList();
      toast.success('Exam draft created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create exam draft');
    } finally {
      setCreating(false);
    }
  }

  return (
    <RoleGuard allowedRoles={['institution', 'teacher']}>
      {!activeInstitutionId ? (
        <EmptyState
          title="No active institution selected"
          description="Select or create an institution workspace to build exams."
        />
      ) : activeExamId ? (
        loadingDetail || !activeDetail || !catalogQuery.data ? (
          <LoadingState label="Loading Exam Builder studio…" />
        ) : (
          <ExamBuilderEditor
            institutionId={activeInstitutionId}
            detail={activeDetail}
            catalog={catalogQuery.data}
            authHeaders={authHeaders}
            onBack={() => {
              setActiveExamId(null);
              setActiveDetail(null);
              void refreshList();
            }}
            onDetailUpdated={(next) => {
              setActiveDetail(next);
              setActiveExamId(next.exam.id);
              void refreshList();
            }}
            onOpenPreview={() => setPreviewExamId(activeDetail.exam.id)}
            onDeleted={() => {
              setActiveExamId(null);
              setActiveDetail(null);
              void refreshList();
            }}
          />
        )
      ) : (
        <>
          <PageHeader
            title="Exam Builder"
            description="Assemble MCQ & descriptive sections, schedule windows, configure passing & negative marking rules, assign cohorts, preview, and publish immutable exam versions."
            actions={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New Exam Draft
              </Button>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total exams"
              value={String(stats.total)}
              icon={FileText}
              hint="Institution-scoped catalog"
            />
            <StatCard
              label="Active drafts"
              value={String(stats.drafts)}
              icon={Clock}
              hint="Editable before publishing"
            />
            <StatCard
              label="Published exams"
              value={String(stats.published)}
              icon={Send}
              hint="Frozen version snapshots"
            />
            <StatCard
              label="Closed exams"
              value={String(stats.closed)}
              icon={CheckCircle2}
              hint="Archived for audit integrity"
            />
          </div>

          <Card className="shadow-none">
            <CardHeader className="border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Institution Exams</CardTitle>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-60">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search exam title or course…"
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as 'all' | ExamStatus)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All subjects</SelectItem>
                      {(catalogQuery.data?.courses ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {examsQuery.isLoading ? (
                <div className="p-6">
                  <LoadingState label="Loading exams…" />
                </div>
              ) : examsQuery.error ? (
                <div className="p-6">
                  <ErrorState
                    title="Could not load exams"
                    description={
                      examsQuery.error instanceof Error
                        ? examsQuery.error.message
                        : 'Unexpected error'
                    }
                    onRetry={() => {
                      void examsQuery.refetch();
                    }}
                  />
                </div>
              ) : (examsQuery.data ?? []).length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    title="No exams created yet"
                    description="Create your first exam draft to add MCQ and descriptive sections, configure marking & randomization, and assign student cohorts."
                    action={
                      <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Create First Exam Draft
                      </Button>
                    }
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam</TableHead>
                      <TableHead>Schedule & Duration</TableHead>
                      <TableHead className="text-right">Structure</TableHead>
                      <TableHead className="text-right">Marks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(examsQuery.data ?? []).map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell className="max-w-xs">
                          <button
                            type="button"
                            onClick={() => {
                              void openExamEditor(ex.id);
                            }}
                            className="text-left font-medium text-foreground hover:underline"
                          >
                            {ex.title}
                          </button>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {ex.courseCode
                              ? `${ex.courseCode} — ${ex.courseTitle}`
                              : 'General / Unlinked'}
                            {ex.current_version_number > 0
                              ? ` · Published v${ex.current_version_number}`
                              : ''}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          <p>{ex.duration_minutes} min</p>
                          <p>
                            {ex.starts_at
                              ? new Date(ex.starts_at).toLocaleDateString()
                              : 'Unscheduled'}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {ex.sectionCount} sec · {ex.questionCount} Q · {ex.assignmentCount} cohorts
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          <span className="font-medium text-foreground">{ex.total_marks} pts</span>
                          {ex.passing_marks != null && (
                            <p className="text-muted-foreground">Pass {ex.passing_marks}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusPill
                              tone={
                                ex.status === 'published'
                                  ? 'success'
                                  : ex.status === 'closed'
                                    ? 'neutral'
                                    : 'warning'
                              }
                            >
                              {ex.status}
                            </StatusPill>
                            {ex.isLockedByAttempts && (
                              <Lock
                                className="h-3.5 w-3.5 text-amber-600"
                                aria-label="Locked after attempts"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPreviewExamId(ex.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void openExamEditor(ex.id);
                              }}
                            >
                              {ex.status === 'draft' ? 'Edit Builder' : 'Inspect'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Create Draft Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Exam Draft</DialogTitle>
                <DialogDescription>
                  Start a draft exam to add MCQ and descriptive sections, configure marking &
                  randomization, and assign cohorts.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-ex-title">Exam title</Label>
                  <Input
                    id="new-ex-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. CS101 Midterm Assessment"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Subject / Course</Label>
                    <Select value={newCourseId} onValueChange={setNewCourseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No specific subject</SelectItem>
                        {(catalogQuery.data?.courses ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-ex-duration">Duration (minutes)</Label>
                    <Input
                      id="new-ex-duration"
                      type="number"
                      min="1"
                      max="1440"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      className="font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-ex-desc">Description (optional)</Label>
                  <Textarea
                    id="new-ex-desc"
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief overview for faculty and candidates"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleCreateDraft();
                  }}
                  disabled={creating}
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Draft & Open Studio
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Preview Modal */}
      {activeInstitutionId && (
        <ExamPreviewDialog
          open={Boolean(previewExamId)}
          onOpenChange={(next) => {
            if (!next) setPreviewExamId(null);
          }}
          institutionId={activeInstitutionId}
          examId={previewExamId}
          authHeaders={authHeaders}
        />
      )}
    </RoleGuard>
  );
}
