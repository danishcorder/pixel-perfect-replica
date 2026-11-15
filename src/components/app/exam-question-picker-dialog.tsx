import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Layers, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  ExamSectionType,
  QuestionDifficulty,
  QuestionType,
} from '@/integrations/supabase/types';
import { listQuestionsFn } from '@/lib/question-bank.functions';
import type { QuestionSetWithItems } from '@/lib/question-bank.server';

const ALL = '__all__';

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq_single: 'MCQ Single',
  mcq_multi: 'MCQ Multi',
  descriptive: 'Descriptive',
  long_answer: 'Long Answer',
};

function isCompatible(sectionType: ExamSectionType, qType: QuestionType): boolean {
  if (sectionType === 'mixed') return true;
  if (sectionType === 'mcq') return qType === 'mcq_single' || qType === 'mcq_multi';
  return qType === 'descriptive' || qType === 'long_answer';
}

export function ExamQuestionPickerDialog({
  open,
  onOpenChange,
  institutionId,
  authHeaders,
  sectionTitle,
  sectionType,
  existingQuestionIds,
  courses,
  questionSets,
  defaultCourseId,
  onAddQuestions,
  onImportQuestionSet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
  authHeaders: () => Record<string, string>;
  sectionTitle: string;
  sectionType: ExamSectionType;
  existingQuestionIds: Set<string>;
  courses: Array<{ id: string; code: string; title: string }>;
  questionSets: QuestionSetWithItems[];
  defaultCourseId?: string | null;
  onAddQuestions: (questionIds: string[]) => Promise<void>;
  onImportQuestionSet: (questionSetId: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState(defaultCourseId || ALL);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | QuestionDifficulty>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const questionsQuery = useQuery({
    queryKey: [
      'exam-picker-questions',
      institutionId,
      open,
      search,
      courseFilter,
      difficultyFilter,
    ],
    enabled: open && Boolean(institutionId),
    queryFn: async () =>
      listQuestionsFn({
        data: {
          institutionId,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(courseFilter !== ALL ? { courseId: courseFilter } : {}),
          ...(difficultyFilter !== 'all' ? { difficulty: difficultyFilter } : {}),
          status: 'active',
          page: 1,
          pageSize: 60,
        },
        headers: authHeaders(),
      }),
  });

  const compatibleItems = useMemo(() => {
    const raw = questionsQuery.data?.items ?? [];
    return raw.filter((q) => isCompatible(sectionType, q.question_type));
  }, [questionsQuery.data?.items, sectionType]);

  function toggleId(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
    );
  }

  async function handleAddSelected() {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      await onAddQuestions(selectedIds);
      setSelectedIds([]);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImportSet(setId: string) {
    setSubmitting(true);
    try {
      await onImportQuestionSet(setId);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedIds([]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select questions for “{sectionTitle}”</DialogTitle>
          <DialogDescription>
            Showing active{' '}
            {sectionType === 'mcq'
              ? 'MCQ (Single & Multi)'
              : sectionType === 'descriptive'
                ? 'Descriptive & Long Answer'
                : 'all'}{' '}
            questions from your institution Question Bank.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="bank" className="mt-2">
          <TabsList>
            <TabsTrigger value="bank">Question Bank</TabsTrigger>
            <TabsTrigger value="sets">Reusable Question Sets ({questionSets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="bank" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, topic, tag…"
                  className="pl-9"
                />
              </div>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All subjects</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={difficultyFilter}
                onValueChange={(v) => setDifficultyFilter(v as 'all' | QuestionDifficulty)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All difficulties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {questionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Question Bank…
              </div>
            ) : compatibleItems.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                No matching active {sectionType !== 'mixed' ? `${sectionType} ` : ''}questions
                found. Create questions in the Question Bank or adjust filters.
              </div>
            ) : (
              <div className="max-h-[360px] divide-y overflow-y-auto rounded-lg border">
                {compatibleItems.map((q) => {
                  const alreadyAdded = existingQuestionIds.has(q.id);
                  const checked = selectedIds.includes(q.id);

                  return (
                    <label
                      key={q.id}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3 text-sm transition-colors ${
                        alreadyAdded ? 'bg-muted/40 opacity-60' : 'hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        checked={alreadyAdded || checked}
                        disabled={alreadyAdded || submitting}
                        onCheckedChange={(val) => toggleId(q.id, Boolean(val))}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-medium text-foreground">{q.title}</span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {q.marks} pts
                            {q.negative_marks > 0 ? ` · -${q.negative_marks}` : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {q.prompt}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {TYPE_LABELS[q.question_type]}
                          {' · '}
                          {q.difficulty}
                          {' · '}
                          {q.topic}
                          {q.courseCode ? ` · ${q.courseCode}` : ''}
                          {alreadyAdded ? ' · Already in exam' : ''}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sets" className="mt-4 space-y-3">
            {questionSets.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                No reusable Question Sets saved yet. Select questions inside Question Bank to create
                sets.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {questionSets.map((set) => {
                  const compatibleCount = set.items.filter(
                    (it) =>
                      it.question &&
                      it.question.status !== 'archived' &&
                      !existingQuestionIds.has(it.question_id) &&
                      isCompatible(sectionType, it.question.question_type),
                  ).length;

                  return (
                    <div
                      key={set.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{set.title}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span className="tabular-nums">{set.items.length}</span> total items
                          {' · '}
                          <span className="tabular-nums">{compatibleCount}</span> eligible for this
                          section
                          {' · '}
                          <span className="tabular-nums">{set.totalMarks}</span> pts
                          {set.courseCode ? ` · ${set.courseCode}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={compatibleCount === 0 || submitting}
                        onClick={() => {
                          void handleImportSet(set.id);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Import {compatibleCount} questions
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleAddSelected();
            }}
            disabled={selectedIds.length === 0 || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add {selectedIds.length > 0 ? `${selectedIds.length} ` : ''}Selected Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
