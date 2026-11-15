import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  History,
  Loader2,
  Lock,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  Unlock,
  XCircle,
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { ExamSectionType } from '@/integrations/supabase/types';
import {
  addExamSectionFn,
  addQuestionsToExamSectionFn,
  cloneExamFn,
  closeExamFn,
  createDraftRevisionFn,
  deleteExamDraftFn,
  deleteExamSectionFn,
  importQuestionSetToExamSectionFn,
  publishExamFn,
  removeExamQuestionFn,
  setExamAssignmentsFn,
  updateExamDraftFn,
  updateExamQuestionConfigFn,
} from '@/lib/exams.functions';
import type { ExamBuilderCatalog, ExamDetail } from '@/lib/exams.server';
import { ExamQuestionPickerDialog } from './exam-question-picker-dialog';
import { StatusPill } from './status-pill';

const NONE = '__none__';

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(localVal: string): string | null {
  if (!localVal.trim()) return null;
  const d = new Date(localVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function ExamBuilderEditor({
  institutionId,
  detail,
  catalog,
  authHeaders,
  onBack,
  onDetailUpdated,
  onOpenPreview,
  onDeleted,
}: {
  institutionId: string;
  detail: ExamDetail;
  catalog: ExamBuilderCatalog;
  authHeaders: () => Record<string, string>;
  onBack: () => void;
  onDetailUpdated: (next: ExamDetail) => void;
  onOpenPreview: () => void;
  onDeleted: () => void;
}) {
  const { exam, sections, assignments, versions } = detail;
  const isDraft = exam.status === 'draft' && !exam.isLockedByAttempts;

  // Settings form state
  const [title, setTitle] = useState(exam.title);
  const [description, setDescription] = useState(exam.description ?? '');
  const [courseId, setCourseId] = useState(exam.course_id ?? NONE);
  const [sessionId, setSessionId] = useState(exam.academic_session_id ?? NONE);
  const [termId, setTermId] = useState(exam.academic_term_id ?? NONE);
  const [instructions, setInstructions] = useState(exam.instructions ?? '');
  const [startsAtLocal, setStartsAtLocal] = useState(toLocalDateTimeInput(exam.starts_at));
  const [endsAtLocal, setEndsAtLocal] = useState(toLocalDateTimeInput(exam.ends_at));
  const [durationMinutes, setDurationMinutes] = useState(String(exam.duration_minutes));
  const [passingMarks, setPassingMarks] = useState(
    exam.passing_marks != null ? String(exam.passing_marks) : '',
  );
  const [passingPercentage, setPassingPercentage] = useState(
    exam.passing_percentage != null ? String(exam.passing_percentage) : '',
  );
  const [negativeEnabled, setNegativeEnabled] = useState(exam.negative_marking_enabled);
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState(
    String(exam.default_negative_marks),
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(exam.shuffle_questions);
  const [shuffleOptions, setShuffleOptions] = useState(exam.shuffle_options);

  // New Section form state
  const [newSecTitle, setNewSecTitle] = useState('');
  const [newSecType, setNewSecType] = useState<ExamSectionType>('mcq');
  const [newSecShuffle, setNewSecShuffle] = useState(false);

  // Per-question inline marks buffer
  const [marksDrafts, setMarksDrafts] = useState<
    Record<string, { marks: string; neg: string }>
  >({});

  // Picker modal state
  const [pickerSection, setPickerSection] = useState<{
    id: string;
    title: string;
    section_type: ExamSectionType;
  } | null>(null);

  // Assignment form state
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(
    assignments.filter((a) => a.target_type === 'class' && a.class_id).map((a) => a.class_id!),
  );
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(
    assignments
      .filter((a) => a.target_type === 'section' && a.class_section_id)
      .map((a) => a.class_section_id!),
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    assignments
      .filter((a) => a.target_type === 'student' && a.student_id)
      .map((a) => a.student_id!),
  );
  const [studentSearch, setStudentSearch] = useState('');

  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    setTitle(exam.title);
    setDescription(exam.description ?? '');
    setCourseId(exam.course_id ?? NONE);
    setSessionId(exam.academic_session_id ?? NONE);
    setTermId(exam.academic_term_id ?? NONE);
    setInstructions(exam.instructions ?? '');
    setStartsAtLocal(toLocalDateTimeInput(exam.starts_at));
    setEndsAtLocal(toLocalDateTimeInput(exam.ends_at));
    setDurationMinutes(String(exam.duration_minutes));
    setPassingMarks(exam.passing_marks != null ? String(exam.passing_marks) : '');
    setPassingPercentage(
      exam.passing_percentage != null ? String(exam.passing_percentage) : '',
    );
    setNegativeEnabled(exam.negative_marking_enabled);
    setDefaultNegativeMarks(String(exam.default_negative_marks));
    setShuffleQuestions(exam.shuffle_questions);
    setShuffleOptions(exam.shuffle_options);

    const nextDrafts: Record<string, { marks: string; neg: string }> = {};
    for (const sec of sections) {
      for (const q of sec.questions) {
        nextDrafts[q.id] = {
          marks: String(q.marks),
          neg: String(q.negative_marks),
        };
      }
    }
    setMarksDrafts(nextDrafts);

    setSelectedClassIds(
      assignments.filter((a) => a.target_type === 'class' && a.class_id).map((a) => a.class_id!),
    );
    setSelectedSectionIds(
      assignments
        .filter((a) => a.target_type === 'section' && a.class_section_id)
        .map((a) => a.class_section_id!),
    );
    setSelectedStudentIds(
      assignments
        .filter((a) => a.target_type === 'student' && a.student_id)
        .map((a) => a.student_id!),
    );
  }, [detail]);

  const existingQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sec of sections) {
      for (const item of sec.questions) ids.add(item.question_id);
    }
    return ids;
  }, [sections]);

  const filteredTerms = useMemo(() => {
    if (sessionId === NONE) return catalog.terms;
    return catalog.terms.filter((t) => t.session_id === sessionId);
  }, [catalog.terms, sessionId]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return catalog.students;
    return catalog.students.filter((st) =>
      [st.full_name, st.student_code, st.email ?? ''].join(' ').toLowerCase().includes(q),
    );
  }, [catalog.students, studentSearch]);

  const classMap = useMemo(
    () => new Map(catalog.classes.map((c) => [c.id, c])),
    [catalog.classes],
  );

  async function handleSaveSettings() {
    setBusyAction('save');
    try {
      const updated = await updateExamDraftFn({
        data: {
          institutionId,
          examId: exam.id,
          title: title.trim(),
          description: description.trim() || null,
          courseId: courseId === NONE ? null : courseId,
          academicSessionId: sessionId === NONE ? null : sessionId,
          academicTermId: termId === NONE ? null : termId,
          instructions: instructions.trim() || null,
          startsAt: fromLocalDateTimeInput(startsAtLocal),
          endsAt: fromLocalDateTimeInput(endsAtLocal),
          durationMinutes: Number(durationMinutes) || 60,
          passingMarks: passingMarks.trim() ? Number(passingMarks) : null,
          passingPercentage: passingPercentage.trim() ? Number(passingPercentage) : null,
          negativeMarkingEnabled: negativeEnabled,
          defaultNegativeMarks: negativeEnabled ? Number(defaultNegativeMarks) || 0 : 0,
          shuffleQuestions,
          shuffleOptions,
        },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success('Exam draft configuration saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save exam configuration');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAddSection() {
    if (!newSecTitle.trim()) {
      toast.error('Enter a section title');
      return;
    }
    setBusyAction('add-section');
    try {
      const updated = await addExamSectionFn({
        data: {
          institutionId,
          examId: exam.id,
          title: newSecTitle.trim(),
          sectionType: newSecType,
          shuffleQuestions: newSecShuffle,
        },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      setNewSecTitle('');
      toast.success('Section added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add section');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    setBusyAction(`del-sec-${sectionId}`);
    try {
      const updated = await deleteExamSectionFn({
        data: { institutionId, examId: exam.id, sectionId },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success('Section removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove section');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveQuestionMarks(sqId: string) {
    const buf = marksDrafts[sqId];
    if (!buf) return;
    setBusyAction(`q-${sqId}`);
    try {
      const updated = await updateExamQuestionConfigFn({
        data: {
          institutionId,
          examId: exam.id,
          sectionQuestionId: sqId,
          marks: Number(buf.marks),
          negativeMarks: Number(buf.neg) || 0,
        },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success('Question marks updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid marks');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRemoveQuestion(sqId: string) {
    setBusyAction(`rm-${sqId}`);
    try {
      const updated = await removeExamQuestionFn({
        data: { institutionId, examId: exam.id, sectionQuestionId: sqId },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success('Question removed from section');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove question');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveAssignments() {
    setBusyAction('assign');
    try {
      const updated = await setExamAssignmentsFn({
        data: {
          institutionId,
          examId: exam.id,
          classIds: selectedClassIds,
          sectionIds: selectedSectionIds,
          studentIds: selectedStudentIds,
        },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success('Exam cohort assignments saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePublish() {
    setBusyAction('publish');
    try {
      const updated = await publishExamFn({
        data: { institutionId, examId: exam.id },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success(`Published immutable version v${updated.exam.current_version_number}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cannot publish exam');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUnlockRevision() {
    setBusyAction('revision');
    try {
      const updated = await createDraftRevisionFn({
        data: { institutionId, examId: exam.id },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success('Opened draft revision — published snapshots remain immutable');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cannot unlock revision');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCloseExam() {
    setBusyAction('close');
    try {
      const updated = await closeExamFn({
        data: { institutionId, examId: exam.id },
        headers: authHeaders(),
      });
      onDetailUpdated(updated);
      toast.success('Exam closed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close exam');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCloneExam() {
    setBusyAction('clone');
    try {
      const cloned = await cloneExamFn({
        data: { institutionId, examId: exam.id },
        headers: authHeaders(),
      });
      onDetailUpdated(cloned);
      toast.success('Cloned into a new editable draft exam');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clone exam');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteDraft() {
    setBusyAction('delete');
    try {
      await deleteExamDraftFn({
        data: { institutionId, examId: exam.id },
        headers: authHeaders(),
      });
      toast.success('Exam draft deleted');
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete draft');
    } finally {
      setBusyAction(null);
    }
  }

  const statusTone =
    exam.status === 'published'
      ? 'success'
      : exam.status === 'closed'
        ? 'neutral'
        : 'warning';

  return (
    <div className="space-y-6">
      {/* Contextual Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
              <ArrowLeft className="h-4 w-4" />
              All exams
            </Button>
            <StatusPill tone={statusTone}>{exam.status}</StatusPill>
            {exam.current_version_number > 0 && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                v{exam.current_version_number}
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {exam.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {exam.courseCode ? `${exam.courseCode} — ${exam.courseTitle}` : 'No subject assigned'}
            {' · '}
            <span className="tabular-nums">{exam.sectionCount}</span> sections
            {' · '}
            <span className="tabular-nums">{exam.questionCount}</span> questions
            {' · '}
            <span className="tabular-nums">{exam.total_marks}</span> total marks
            {' · '}
            <span className="tabular-nums">{exam.assignmentCount}</span> cohorts assigned
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenPreview}>
            <Eye className="h-4 w-4" />
            Preview Exam
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busyAction !== null}
            onClick={() => {
              void handleCloneExam();
            }}
          >
            <Copy className="h-4 w-4" />
            Clone
          </Button>

          {isDraft && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busyAction !== null}
                onClick={() => {
                  void handleSaveSettings();
                }}
              >
                {busyAction === 'save' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </Button>
              <Button
                size="sm"
                disabled={busyAction !== null}
                onClick={() => {
                  void handlePublish();
                }}
              >
                {busyAction === 'publish' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish v{exam.current_version_number + 1}
              </Button>
            </>
          )}

          {exam.status === 'published' && (
            <>
              {!exam.isLockedByAttempts && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyAction !== null}
                  onClick={() => {
                    void handleUnlockRevision();
                  }}
                >
                  <Unlock className="h-4 w-4" />
                  Prepare v{exam.current_version_number + 1} Revision
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                disabled={busyAction !== null}
                onClick={() => {
                  void handleCloseExam();
                }}
              >
                <XCircle className="h-4 w-4" />
                Close Exam
              </Button>
            </>
          )}

          {isDraft && exam.current_version_number === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={busyAction !== null}
              onClick={() => {
                void handleDeleteDraft();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Draft
            </Button>
          )}
        </div>
      </div>

      {/* Immutability / Lock Banners */}
      {exam.isLockedByAttempts && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-foreground">
              Content locked after student attempts started ({exam.totalAttempts} attempts recorded)
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Published version v{exam.current_version_number} cannot be edited or reverted to draft.
              You can close this exam or clone it into a new draft exam.
            </p>
          </div>
        </div>
      )}

      {!isDraft && !exam.isLockedByAttempts && (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">
              Published snapshot v{exam.current_version_number} is immutable
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {exam.status === 'published'
                ? 'While published, live content is read-only. Click "Prepare Revision" to edit in draft and publish a new version while preserving v1 history.'
                : 'Closed exams are read-only for audit integrity. Use "Clone" to create a fresh draft.'}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="sections">
        <TabsList>
          <TabsTrigger value="sections">Sections & Questions ({exam.questionCount})</TabsTrigger>
          <TabsTrigger value="settings">Schedule, Marks & Rules</TabsTrigger>
          <TabsTrigger value="assignments">Cohort Assignments ({exam.assignmentCount})</TabsTrigger>
          <TabsTrigger value="versions">Published Versions ({versions.length})</TabsTrigger>
        </TabsList>

        {/* TAB 1: SECTIONS & QUESTIONS */}
        <TabsContent value="sections" className="mt-5 space-y-5">
          {isDraft && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add Exam Section</CardTitle>
                <CardDescription>
                  Create dedicated MCQ, Descriptive, or Mixed sections and attach questions from the
                  Question Bank.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                  <div className="space-y-1.5 sm:col-span-5">
                    <Label htmlFor="sec-title">Section title</Label>
                    <Input
                      id="sec-title"
                      value={newSecTitle}
                      onChange={(e) => setNewSecTitle(e.target.value)}
                      placeholder="e.g. Part A — Multiple Choice"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label>Section type</Label>
                    <Select
                      value={newSecType}
                      onValueChange={(v) => setNewSecType(v as ExamSectionType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">MCQ Only</SelectItem>
                        <SelectItem value="descriptive">Descriptive / Long Answer</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pb-2 sm:col-span-2">
                    <Switch
                      id="sec-shuffle"
                      checked={newSecShuffle}
                      onCheckedChange={setNewSecShuffle}
                    />
                    <Label htmlFor="sec-shuffle" className="text-xs">
                      Shuffle section
                    </Label>
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      className="w-full"
                      disabled={busyAction !== null}
                      onClick={() => {
                        void handleAddSection();
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Section
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {sections.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No sections yet. Add an MCQ or Descriptive section above to begin assembling
                questions.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sections.map((sec, idx) => (
                <Card key={sec.id} className="shadow-none">
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b pb-4">
                    <div>
                      <CardTitle className="text-base">
                        Section {idx + 1}: {sec.title}
                      </CardTitle>
                      <CardDescription>
                        {sec.section_type.toUpperCase()} ·{' '}
                        <span className="tabular-nums">{sec.questions.length}</span> questions ·{' '}
                        <span className="tabular-nums">{sec.sectionTotalMarks}</span> marks
                        {sec.shuffle_questions ? ' · Shuffled' : ''}
                      </CardDescription>
                    </div>
                    {isDraft && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPickerSection({
                              id: sec.id,
                              title: sec.title,
                              section_type: sec.section_type,
                            })
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Select from Question Bank
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busyAction !== null}
                          onClick={() => {
                            void handleDeleteSection(sec.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4">
                    {sec.questions.length === 0 ? (
                      <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                        No questions selected in this section yet.
                      </div>
                    ) : (
                      <div className="divide-y rounded-md border">
                        {sec.questions.map((item, qIdx) => {
                          const buf = marksDrafts[item.id] ?? {
                            marks: String(item.marks),
                            neg: String(item.negative_marks),
                          };
                          return (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">
                                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                                    #{qIdx + 1}
                                  </span>
                                  {item.question.title}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                  {item.question.prompt}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.question.question_type}
                                  {' · '}
                                  {item.question.difficulty}
                                  {' · '}
                                  {item.question.topic}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Label className="text-xs text-muted-foreground">Marks</Label>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    disabled={!isDraft}
                                    value={buf.marks}
                                    onChange={(e) =>
                                      setMarksDrafts((prev) => ({
                                        ...prev,
                                        [item.id]: { marks: e.target.value, neg: buf.neg },
                                      }))
                                    }
                                    className="h-8 w-20 font-mono text-xs tabular-nums"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Label className="text-xs text-muted-foreground">Neg</Label>
                                  <Input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    disabled={!isDraft || !exam.negative_marking_enabled}
                                    value={buf.neg}
                                    onChange={(e) =>
                                      setMarksDrafts((prev) => ({
                                        ...prev,
                                        [item.id]: { marks: buf.marks, neg: e.target.value },
                                      }))
                                    }
                                    className="h-8 w-20 font-mono text-xs tabular-nums"
                                  />
                                </div>
                                {isDraft && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2.5 text-xs"
                                      disabled={busyAction !== null}
                                      onClick={() => {
                                        void handleSaveQuestionMarks(item.id);
                                      }}
                                    >
                                      Apply
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-destructive hover:text-destructive"
                                      disabled={busyAction !== null}
                                      onClick={() => {
                                        void handleRemoveQuestion(item.id);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: SCHEDULE, MARKS & RANDOMIZATION */}
        <TabsContent value="settings" className="mt-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">General & Instructions</CardTitle>
                <CardDescription>
                  Subject metadata and candidate instructions shown before starting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ex-title">Exam title</Label>
                  <Input
                    id="ex-title"
                    disabled={!isDraft}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ex-desc">Description</Label>
                  <Textarea
                    id="ex-desc"
                    rows={2}
                    disabled={!isDraft}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Scope, syllabus coverage, and examination purpose"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Subject / Course</Label>
                    <Select disabled={!isDraft} value={courseId} onValueChange={setCourseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No specific subject</SelectItem>
                        {catalog.courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Academic Session</Label>
                    <Select disabled={!isDraft} value={sessionId} onValueChange={setSessionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {catalog.sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Term</Label>
                    <Select disabled={!isDraft} value={termId} onValueChange={setTermId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {filteredTerms.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ex-instructions">Candidate instructions</Label>
                  <Textarea
                    id="ex-instructions"
                    rows={4}
                    disabled={!isDraft}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Read every question carefully. Calculators permitted only where stated…"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Schedule, Passing & Randomization</CardTitle>
                <CardDescription>
                  Server validates window length, duration, passing criteria, and randomization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-starts">Start date & time</Label>
                    <Input
                      id="ex-starts"
                      type="datetime-local"
                      disabled={!isDraft}
                      value={startsAtLocal}
                      onChange={(e) => setStartsAtLocal(e.target.value)}
                      className="font-mono text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-ends">End date & time</Label>
                    <Input
                      id="ex-ends"
                      type="datetime-local"
                      disabled={!isDraft}
                      value={endsAtLocal}
                      onChange={(e) => setEndsAtLocal(e.target.value)}
                      className="font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-duration">Duration (min)</Label>
                    <Input
                      id="ex-duration"
                      type="number"
                      min="1"
                      max="1440"
                      disabled={!isDraft}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      className="font-mono tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-pass-marks">
                      Passing marks (of {exam.total_marks})
                    </Label>
                    <Input
                      id="ex-pass-marks"
                      type="number"
                      min="0"
                      step="0.5"
                      disabled={!isDraft}
                      value={passingMarks}
                      onChange={(e) => setPassingMarks(e.target.value)}
                      placeholder="Optional"
                      className="font-mono tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-pass-pct">Passing %</Label>
                    <Input
                      id="ex-pass-pct"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      disabled={!isDraft}
                      value={passingPercentage}
                      onChange={(e) => setPassingPercentage(e.target.value)}
                      placeholder="e.g. 50"
                      className="font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="ex-neg-toggle" className="font-medium">
                        Negative marking
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Apply per-question penalties on incorrect MCQ responses.
                      </p>
                    </div>
                    <Switch
                      id="ex-neg-toggle"
                      disabled={!isDraft}
                      checked={negativeEnabled}
                      onCheckedChange={setNegativeEnabled}
                    />
                  </div>

                  {negativeEnabled && (
                    <div className="space-y-1.5">
                      <Label htmlFor="ex-default-neg">Default negative marks</Label>
                      <Input
                        id="ex-default-neg"
                        type="number"
                        min="0"
                        step="0.25"
                        disabled={!isDraft}
                        value={defaultNegativeMarks}
                        onChange={(e) => setDefaultNegativeMarks(e.target.value)}
                        className="w-40 font-mono tabular-nums"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div>
                      <Label htmlFor="ex-shuffle-q" className="font-medium">
                        Randomize question order
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Shuffle question ordering within sections for each candidate.
                      </p>
                    </div>
                    <Switch
                      id="ex-shuffle-q"
                      disabled={!isDraft}
                      checked={shuffleQuestions}
                      onCheckedChange={setShuffleQuestions}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="ex-shuffle-o" className="font-medium">
                        Randomize MCQ options
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Permute answer choice order per candidate attempt.
                      </p>
                    </div>
                    <Switch
                      id="ex-shuffle-o"
                      disabled={!isDraft}
                      checked={shuffleOptions}
                      onCheckedChange={setShuffleOptions}
                    />
                  </div>
                </div>

                {isDraft && (
                  <div className="flex justify-end border-t pt-4">
                    <Button
                      disabled={busyAction !== null}
                      onClick={() => {
                        void handleSaveSettings();
                      }}
                    >
                      {busyAction === 'save' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: ASSIGNMENTS */}
        <TabsContent value="assignments" className="mt-5 space-y-5">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">
                  Classes ({selectedClassIds.length})
                </CardTitle>
                <CardDescription>Assign entire academic classes.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-72 space-y-2 overflow-y-auto">
                {catalog.classes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No classes created yet.</p>
                ) : (
                  catalog.classes.map((cls) => {
                    const checked = selectedClassIds.includes(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                      >
                        <Checkbox
                          disabled={!isDraft}
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSelectedClassIds((prev) =>
                              v ? [...prev, cls.id] : prev.filter((id) => id !== cls.id),
                            )
                          }
                        />
                        <span className="truncate">
                          {cls.code} — {cls.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">
                  Sections ({selectedSectionIds.length})
                </CardTitle>
                <CardDescription>Target specific class sections or batches.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-72 space-y-2 overflow-y-auto">
                {catalog.sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No class sections created yet.</p>
                ) : (
                  catalog.sections.map((sec) => {
                    const cls = classMap.get(sec.class_id);
                    const checked = selectedSectionIds.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                      >
                        <Checkbox
                          disabled={!isDraft}
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSelectedSectionIds((prev) =>
                              v ? [...prev, sec.id] : prev.filter((id) => id !== sec.id),
                            )
                          }
                        />
                        <span className="truncate">
                          {cls ? `${cls.code} · ` : ''}
                          {sec.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">
                  Individual Students ({selectedStudentIds.length})
                </CardTitle>
                <CardDescription>Include specific students or make-up candidates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Filter student name or code…"
                />
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No matching active students.</p>
                  ) : (
                    filteredStudents.map((st) => {
                      const checked = selectedStudentIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                        >
                          <Checkbox
                            disabled={!isDraft}
                            checked={checked}
                            onCheckedChange={(v) =>
                              setSelectedStudentIds((prev) =>
                                v ? [...prev, st.id] : prev.filter((id) => id !== st.id),
                              )
                            }
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{st.full_name}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {st.student_code}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {isDraft && (
            <div className="flex justify-end">
              <Button
                disabled={busyAction !== null}
                onClick={() => {
                  void handleSaveAssignments();
                }}
              >
                {busyAction === 'assign' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save Cohort Assignments
              </Button>
            </div>
          )}
        </TabsContent>

        {/* TAB 4: IMMUTABLE VERSION HISTORY */}
        <TabsContent value="versions" className="mt-5">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" />
                Immutable Published Exam Versions
              </CardTitle>
              <CardDescription>
                Every publication freezes an append-only snapshot of questions, marks, schedule,
                and private grading keys.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                  No versions published yet. Configure sections, questions, schedule, and cohort
                  assignments, then click “Publish”.
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {versions.map((ver) => (
                    <div
                      key={ver.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 text-sm"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">
                            v{ver.version_number}
                          </span>
                          <span className="font-medium text-foreground">{ver.title}</span>
                          {ver.attempt_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                              <Lock className="h-3 w-3" />
                              {ver.attempt_count} attempts
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Published {new Date(ver.published_at).toLocaleString()}
                          {' · '}
                          <span className="tabular-nums">
                            {ver.snapshot_payload.sections?.length ?? 0}
                          </span>{' '}
                          sections
                          {' · '}
                          <span className="tabular-nums">{ver.total_marks}</span> total marks
                          {' · '}
                          <span className="tabular-nums">{ver.duration_minutes}</span> min
                        </p>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        Immutable snapshot
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Question Picker Modal */}
      {pickerSection && (
        <ExamQuestionPickerDialog
          open={Boolean(pickerSection)}
          onOpenChange={(next) => {
            if (!next) setPickerSection(null);
          }}
          institutionId={institutionId}
          authHeaders={authHeaders}
          sectionTitle={pickerSection.title}
          sectionType={pickerSection.section_type}
          existingQuestionIds={existingQuestionIds}
          courses={catalog.courses}
          questionSets={catalog.questionSets}
          defaultCourseId={exam.course_id}
          onAddQuestions={async (questionIds) => {
            const updated = await addQuestionsToExamSectionFn({
              data: {
                institutionId,
                examId: exam.id,
                sectionId: pickerSection.id,
                questionIds,
              },
              headers: authHeaders(),
            });
            onDetailUpdated(updated);
            toast.success(`Added ${questionIds.length} question(s) to section`);
          }}
          onImportQuestionSet={async (questionSetId) => {
            const res = await importQuestionSetToExamSectionFn({
              data: {
                institutionId,
                examId: exam.id,
                sectionId: pickerSection.id,
                questionSetId,
              },
              headers: authHeaders(),
            });
            onDetailUpdated(res.detail);
            toast.success(
              `Imported ${res.addedCount} question(s)${res.skippedCount > 0 ? ` (${res.skippedCount} skipped)` : ''}`,
            );
          }}
        />
      )}
    </div>
  );
}
