import { useMemo, useState, type ChangeEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
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
import { QuestionEditorDialog } from '@/components/app/question-editor-dialog';
import { QuestionSelectionTray } from '@/components/app/question-selector-drawer';
import { RoleGuard } from '@/components/app/role-guard';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/states';
import { useAuth } from '@/lib/auth';
import type {
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '@/integrations/supabase/types';
import {
  deleteQuestionFn,
  deleteQuestionSetFn,
  duplicateQuestionFn,
  getQuestionBankCatalogFn,
  importQuestionsCsvFn,
  listQuestionImportJobsFn,
  listQuestionsFn,
  listQuestionSetsFn,
  removeQuestionFromSetFn,
  setQuestionStatusFn,
} from '@/lib/question-bank.functions';
import type {
  EducatorQuestionItem,
  QuestionCsvImportSummary,
} from '@/lib/question-bank.server';
import { parseAndValidateQuestionCsv, SAMPLE_QUESTION_CSV } from '@/lib/question-csv';

export const Route = createFileRoute('/app/question-bank')({
  head: () => ({
    meta: [
      { title: 'Question Bank — ExamFlow' },
      {
        name: 'description',
        content:
          'Author, filter, import, duplicate, archive, and organize institution-owned exam questions.',
      },
    ],
  }),
  component: QuestionBankPage,
});

const ALL = '__all__';
const NONE = '__none__';

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq_single: 'MCQ (Single)',
  mcq_multi: 'MCQ (Multi)',
  descriptive: 'Descriptive',
  long_answer: 'Long Answer',
};

const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const STATUS_LABELS: Record<QuestionStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
};

function QuestionBankPage() {
  const { user, activeInstitutionId, activeMembership, authHeaders, workspace } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin =
    workspace?.isSuperAdmin || activeMembership?.role === 'institution_admin';

  // Search & filters
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState(ALL);
  const [topicFilter, setTopicFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | QuestionDifficulty>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | QuestionType>('all');
  const [statusFilter, setStatusFilter] = useState<'non_archived' | QuestionStatus>('non_archived');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Editor modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<EducatorQuestionItem | null>(null);

  // Reusable exam selection cart
  const [selectedMap, setSelectedMap] = useState<Record<string, EducatorQuestionItem>>({});

  // CSV Import
  const [csvFileName, setCsvFileName] = useState('questions.csv');
  const [csvText, setCsvText] = useState('');
  const [csvDefaultCourseId, setCsvDefaultCourseId] = useState(NONE);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<QuestionCsvImportSummary | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['qb-catalog', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return getQuestionBankCatalogFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  const questionsQuery = useQuery({
    queryKey: [
      'qb-list',
      activeInstitutionId,
      user?.id,
      search,
      courseFilter,
      topicFilter,
      categoryFilter,
      difficultyFilter,
      typeFilter,
      statusFilter,
      page,
    ],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return listQuestionsFn({
        data: {
          institutionId: activeInstitutionId,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(courseFilter !== ALL ? { courseId: courseFilter } : {}),
          ...(topicFilter !== ALL ? { topic: topicFilter } : {}),
          ...(categoryFilter !== ALL ? { category: categoryFilter } : {}),
          ...(difficultyFilter !== 'all' ? { difficulty: difficultyFilter } : {}),
          ...(typeFilter !== 'all' ? { questionType: typeFilter } : {}),
          ...(statusFilter !== 'non_archived' ? { status: statusFilter } : { includeArchived: false }),
          page,
          pageSize,
        },
        headers: authHeaders(),
      });
    },
  });

  const setsQuery = useQuery({
    queryKey: ['qb-sets', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return listQuestionSetsFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  const importJobsQuery = useQuery({
    queryKey: ['qb-import-jobs', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return listQuestionImportJobsFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['qb-catalog', activeInstitutionId, user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['qb-list', activeInstitutionId, user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['qb-sets', activeInstitutionId, user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['qb-import-jobs', activeInstitutionId, user?.id] }),
    ]);
  }

  const csvPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    return parseAndValidateQuestionCsv(csvText);
  }, [csvText]);

  const selectedQuestions = useMemo(() => Object.values(selectedMap), [selectedMap]);

  function toggleSelection(q: EducatorQuestionItem, checked: boolean) {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (checked) {
        next[q.id] = q;
      } else {
        delete next[q.id];
      }
      return next;
    });
  }

  function togglePageSelection(items: EducatorQuestionItem[], checked: boolean) {
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (checked) {
          next[item.id] = item;
        } else {
          delete next[item.id];
        }
      }
      return next;
    });
  }

  async function handleDuplicate(questionId: string) {
    if (!activeInstitutionId) return;
    try {
      await duplicateQuestionFn({
        data: { institutionId: activeInstitutionId, questionId },
        headers: authHeaders(),
      });
      toast.success('Question duplicated as Draft');
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate question');
    }
  }

  async function handleSetStatus(questionId: string, nextStatus: QuestionStatus) {
    if (!activeInstitutionId) return;
    try {
      await setQuestionStatusFn({
        data: { institutionId: activeInstitutionId, questionId, status: nextStatus },
        headers: authHeaders(),
      });
      toast.success(
        nextStatus === 'archived'
          ? 'Question archived'
          : nextStatus === 'active'
            ? 'Question restored to Active'
            : 'Question moved to Draft',
      );
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleDelete(questionId: string) {
    if (!activeInstitutionId) return;
    try {
      await deleteQuestionFn({
        data: { institutionId: activeInstitutionId, questionId },
        headers: authHeaders(),
      });
      setSelectedMap((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      toast.success('Question permanently deleted');
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete question');
    }
  }

  function handleCsvFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
      setImportResult(null);
    };
    reader.readAsText(file);
  }

  function downloadSampleCsv() {
    const blob = new Blob([SAMPLE_QUESTION_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'examflow-question-bank-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportCsv() {
    if (!activeInstitutionId || !csvText.trim()) return;
    setImporting(true);
    try {
      const summary = await importQuestionsCsvFn({
        data: {
          institutionId: activeInstitutionId,
          fileName: csvFileName || 'questions.csv',
          csvText,
          defaultCourseId: csvDefaultCourseId === NONE ? null : csvDefaultCourseId,
        },
        headers: authHeaders(),
      });
      setImportResult(summary);
      toast.success(
        `Imported ${summary.importedCount} of ${summary.totalRows} question(s)`,
      );
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleRemoveSetItem(itemId: string) {
    if (!activeInstitutionId) return;
    try {
      await removeQuestionFromSetFn({
        data: { institutionId: activeInstitutionId, itemId },
        headers: authHeaders(),
      });
      toast.success('Removed question from set');
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update set');
    }
  }

  async function handleDeleteSet(setId: string) {
    if (!activeInstitutionId) return;
    try {
      await deleteQuestionSetFn({
        data: { institutionId: activeInstitutionId, questionSetId: setId },
        headers: authHeaders(),
      });
      toast.success('Question set deleted');
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete set');
    }
  }

  const catalog = catalogQuery.data;
  const pageItems = questionsQuery.data?.items ?? [];
  const allOnPageSelected =
    pageItems.length > 0 && pageItems.every((item) => Boolean(selectedMap[item.id]));

  return (
    <RoleGuard allowedRoles={['institution', 'teacher']}>
      <div className="space-y-6">
        <PageHeader
          title="Question Bank"
          description="Author MCQ and written questions, attach files, import from CSV, and assemble reusable exam sets. Answer keys remain private to educators."
          actions={
            <Button
              type="button"
              onClick={() => {
                setEditingQuestion(null);
                setEditorOpen(true);
              }}
              className="whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              New question
            </Button>
          }
        />

        {/* Compact Summary Row */}
        {catalog ? (
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="shadow-none">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Total Questions</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{catalog.stats.total}</p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Active Ready</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{catalog.stats.active}</p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">MCQ / Written</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {catalog.stats.mcqCount} / {catalog.stats.writtenCount}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Drafts · Archived</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {catalog.stats.draft} · {catalog.stats.archived}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Tabs defaultValue="bank" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bank">Question Bank</TabsTrigger>
            <TabsTrigger value="import">CSV Import</TabsTrigger>
            <TabsTrigger value="sets">
              Reusable Exam Sets ({setsQuery.data?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SEARCH, FILTER, CRUD & EXAM SELECTION */}
          <TabsContent value="bank" className="space-y-4">
            <Card className="shadow-none">
              <CardContent className="grid gap-3 pt-5 md:grid-cols-4 lg:grid-cols-7">
                <div className="relative md:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search title, stem, topic, tags…"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={courseFilter}
                  onValueChange={(v) => {
                    setCourseFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All subjects</SelectItem>
                    {(catalog?.courses ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={topicFilter}
                  onValueChange={(v) => {
                    setTopicFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All topics</SelectItem>
                    {(catalog?.topics ?? []).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={categoryFilter}
                  onValueChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {(catalog?.categories ?? []).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={difficultyFilter}
                  onValueChange={(v) => {
                    setDifficultyFilter(v as 'all' | QuestionDifficulty);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => {
                      setTypeFilter(v as 'all' | QuestionType);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="mcq_single">MCQ Single</SelectItem>
                      <SelectItem value="mcq_multi">MCQ Multi</SelectItem>
                      <SelectItem value="descriptive">Descriptive</SelectItem>
                      <SelectItem value="long_answer">Long Answer</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v as 'non_archived' | QuestionStatus);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non_archived">Active & Draft</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="draft">Drafts only</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {activeInstitutionId ? (
              <QuestionSelectionTray
                institutionId={activeInstitutionId}
                authHeaders={authHeaders}
                selectedQuestions={selectedQuestions}
                courses={catalog?.courses ?? []}
                existingSets={setsQuery.data ?? []}
                onClearSelection={() => setSelectedMap({})}
                onSetsChanged={refreshAll}
              />
            ) : null}

            <Card className="shadow-none">
              <CardContent className="pt-5">
                {questionsQuery.isLoading ? (
                  <LoadingState label="Loading question bank…" />
                ) : questionsQuery.isError ? (
                  <ErrorState
                    title="Could not load questions"
                    description={
                      questionsQuery.error instanceof Error
                        ? questionsQuery.error.message
                        : 'Unexpected error'
                    }
                    onRetry={() => {
                      void questionsQuery.refetch();
                    }}
                  />
                ) : pageItems.length === 0 ? (
                  <EmptyState
                    title="No matching questions"
                    description="Create a new MCQ or descriptive question, import via CSV, or clear active filters."
                    action={
                      <Button
                        type="button"
                        onClick={() => {
                          setEditingQuestion(null);
                          setEditorOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Create first question
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={allOnPageSelected}
                                onCheckedChange={(val) =>
                                  togglePageSelection(pageItems, Boolean(val))
                                }
                                aria-label="Select all questions on page"
                              />
                            </TableHead>
                            <TableHead>Question & Metadata</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Difficulty</TableHead>
                            <TableHead className="text-right">Marks</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageItems.map((q) => {
                            const checked = Boolean(selectedMap[q.id]);
                            return (
                              <TableRow key={q.id}>
                                <TableCell className="align-top pt-3.5">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(val) =>
                                      toggleSelection(q, Boolean(val))
                                    }
                                    aria-label={`Select ${q.title}`}
                                  />
                                </TableCell>

                                <TableCell className="max-w-xl align-top">
                                  <div className="space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingQuestion(q);
                                        setEditorOpen(true);
                                      }}
                                      className="text-left font-medium hover:underline"
                                    >
                                      {q.title}
                                    </button>
                                    <p className="line-clamp-2 text-xs text-muted-foreground">
                                      {q.prompt}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span>{q.courseCode ?? 'General'}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{q.topic}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{q.category}</span>
                                      {q.attachments.length > 0 ? (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="inline-flex items-center gap-1 tabular-nums">
                                            <Paperclip className="h-3 w-3" />
                                            {q.attachments.length}
                                          </span>
                                        </>
                                      ) : null}
                                      {q.answerKey.correct_option_keys.length > 0 ? (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-mono text-emerald-700 dark:text-emerald-400">
                                            Key: {q.answerKey.correct_option_keys.join(', ')}
                                          </span>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell className="whitespace-nowrap align-top text-xs">
                                  {TYPE_LABELS[q.question_type]}
                                </TableCell>

                                <TableCell className="whitespace-nowrap align-top text-xs">
                                  {DIFFICULTY_LABELS[q.difficulty]}
                                </TableCell>

                                <TableCell className="whitespace-nowrap align-top text-right font-mono text-xs tabular-nums">
                                  +{q.marks}
                                  {q.negative_marks > 0 ? ` / -${q.negative_marks}` : ''}
                                </TableCell>

                                <TableCell className="whitespace-nowrap align-top text-xs">
                                  {STATUS_LABELS[q.status]}
                                </TableCell>

                                <TableCell className="whitespace-nowrap align-top text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEditingQuestion(q);
                                        setEditorOpen(true);
                                      }}
                                      title="Edit question"
                                      aria-label={`Edit ${q.title}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDuplicate(q.id)}
                                      title="Duplicate as draft"
                                      aria-label={`Duplicate ${q.title}`}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>

                                    {q.status === 'archived' ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleSetStatus(q.id, 'active')}
                                        title="Restore to active"
                                        aria-label={`Restore ${q.title}`}
                                      >
                                        <ArchiveRestore className="h-4 w-4" />
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleSetStatus(q.id, 'archived')}
                                        title="Archive question"
                                        aria-label={`Archive ${q.title}`}
                                      >
                                        <Archive className="h-4 w-4" />
                                      </Button>
                                    )}

                                    {isAdmin ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(q.id)}
                                        title="Delete permanently"
                                        aria-label={`Delete ${q.title}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        Showing page {questionsQuery.data?.page ?? 1} of{' '}
                        {questionsQuery.data?.totalPages ?? 1} ({questionsQuery.data?.total ?? 0}{' '}
                        total)
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={page >= (questionsQuery.data?.totalPages ?? 1)}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: CSV IMPORT */}
          <TabsContent value="import" className="space-y-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Questions from Validated CSV Template
                </CardTitle>
                <CardDescription>
                  Supports `mcq_single`, `mcq_multi`, `descriptive`, and `long_answer`. Use
                  pipe-separated `options` (e.g. `A_text|B_text|C_text|D_text`) and
                  `correct_options` (`B` or `A;C`). Matching `subject_code` links directly to
                  existing institution courses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted whitespace-nowrap">
                      <Upload className="h-3.5 w-3.5" />
                      Choose CSV file
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCsvFileUpload}
                        className="hidden"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadSampleCsv}
                      className="whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download template CSV
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Fallback course:</Label>
                    <Select value={csvDefaultCourseId} onValueChange={setCsvDefaultCourseId}>
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None (use CSV subject_code)</SelectItem>
                        {(catalog?.courses ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} · {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="qb-csv-text">CSV content ({csvFileName})</Label>
                  <Textarea
                    id="qb-csv-text"
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      setImportResult(null);
                    }}
                    rows={8}
                    className="font-mono text-xs"
                    placeholder={SAMPLE_QUESTION_CSV}
                  />
                </div>

                {csvPreview ? (
                  <div className="rounded-md border p-3 text-xs space-y-2">
                    <div className="flex flex-wrap items-center gap-3 tabular-nums">
                      <span className="font-medium">Pre-flight validation:</span>
                      <span>{csvPreview.totalRows} total rows</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {csvPreview.validRows.length} valid
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={csvPreview.errors.length > 0 ? 'text-destructive' : ''}>
                        {csvPreview.errors.length} client errors
                      </span>
                    </div>
                    {csvPreview.errors.length > 0 ? (
                      <ul className="space-y-1 text-destructive">
                        {csvPreview.errors.slice(0, 6).map((err, i) => (
                          <li key={i} className="tabular-nums">
                            Row {err.row}
                            {err.field ? ` (${err.field})` : ''}: {err.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={!csvText.trim() || importing}
                    onClick={handleImportCsv}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Import valid questions
                  </Button>
                </div>

                {importResult ? (
                  <div className="space-y-3 rounded-md border p-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm tabular-nums">
                      {importResult.importedCount > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      <span>
                        Imported {importResult.importedCount} of {importResult.totalRows} row(s);{' '}
                        {importResult.errorCount} error(s).
                      </span>
                    </div>

                    {importResult.errors.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResult.errors.map((err, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="tabular-nums text-xs">{err.row}</TableCell>
                              <TableCell className="text-xs">{err.title ?? '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{err.field ?? 'row'}</TableCell>
                              <TableCell className="text-xs text-destructive">{err.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {(importJobsQuery.data?.length ?? 0) > 0 ? (
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm">Recent Question Import Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Imported</TableHead>
                        <TableHead className="text-right">Errors</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(importJobsQuery.data ?? []).map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="text-xs font-medium">{job.file_name}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {job.total_rows}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {job.imported_count}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {job.error_count}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {new Date(job.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {/* TAB 3: REUSABLE EXAM QUESTION SETS */}
          <TabsContent value="sets" className="space-y-4">
            {setsQuery.isLoading ? (
              <LoadingState label="Loading reusable question sets…" />
            ) : (setsQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No reusable exam sets yet"
                description="Check one or more questions in the Question Bank tab and click 'Save to exam set' to build reusable question pools for future exams."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {(setsQuery.data ?? []).map((set) => (
                  <Card key={set.id} className="shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Layers className="h-4 w-4 text-primary" />
                          {set.title}
                        </CardTitle>
                        <CardDescription>
                          {set.courseCode ? `${set.courseCode} · ` : ''}
                          <span className="tabular-nums">{set.items.length} questions</span>
                          {' · '}
                          <span className="tabular-nums">{set.totalMarks} total marks</span>
                        </CardDescription>
                        {set.description ? (
                          <p className="text-xs text-muted-foreground">{set.description}</p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSet(set.id)}
                        aria-label={`Delete set ${set.title}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {set.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No questions in this set.</p>
                      ) : (
                        <ul className="divide-y text-xs">
                          {set.items.map((it, idx) => (
                            <li
                              key={it.id}
                              className="flex items-center justify-between gap-2 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  <span className="mr-1.5 text-muted-foreground tabular-nums">
                                    {idx + 1}.
                                  </span>
                                  {it.question?.title ?? 'Removed question'}
                                </p>
                                {it.question ? (
                                  <p className="text-muted-foreground tabular-nums">
                                    {TYPE_LABELS[it.question.question_type]} ·{' '}
                                    {DIFFICULTY_LABELS[it.question.difficulty]} ·{' '}
                                    {it.marks_override ?? it.question.marks} marks
                                  </p>
                                ) : null}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveSetItem(it.id)}
                                aria-label="Remove item from set"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {activeInstitutionId ? (
          <QuestionEditorDialog
            open={editorOpen}
            onOpenChange={setEditorOpen}
            institutionId={activeInstitutionId}
            authHeaders={authHeaders}
            courses={catalog?.courses ?? []}
            editingQuestion={editingQuestion}
            onSaved={refreshAll}
          />
        ) : null}
      </div>
    </RoleGuard>
  );
}
