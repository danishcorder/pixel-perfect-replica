import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  KeyRound,
  Loader2,
  Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { previewExamFn } from '@/lib/exams.functions';

export function ExamPreviewDialog({
  open,
  onOpenChange,
  institutionId,
  examId,
  authHeaders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
  examId: string | null;
  authHeaders: () => Record<string, string>;
}) {
  const [mode, setMode] = useState<'student' | 'educator'>('student');

  const previewQuery = useQuery({
    queryKey: ['exam-preview', institutionId, examId, mode, open],
    enabled: open && Boolean(institutionId && examId),
    queryFn: async () => {
      if (!examId) throw new Error('Missing exam ID');
      return previewExamFn({
        data: { institutionId, examId, mode },
        headers: authHeaders(),
      });
    },
  });

  const data = previewQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Exam Preview
              </DialogTitle>
              <DialogDescription>
                Inspect timing, instructions, section layout, and randomization before publishing.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode('student')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'student'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Student View (Keys Hidden)
              </button>
              <button
                type="button"
                onClick={() => setMode('educator')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'educator'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Educator Key View
              </button>
            </div>
          </div>
        </DialogHeader>

        {previewQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating exam preview…
          </div>
        ) : previewQuery.error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {previewQuery.error instanceof Error
              ? previewQuery.error.message
              : 'Failed to generate preview'}
          </div>
        ) : data ? (
          <div className="space-y-5">
            {data.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Pre-publish checklist notices
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {data.title}
                  </h3>
                  {data.courseLabel && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{data.courseLabel}</p>
                  )}
                  {data.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{data.description}</p>
                  )}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  <p className="text-sm font-semibold text-foreground">{data.totalMarks} total pts</p>
                  <p>{data.durationMinutes} min duration</p>
                  {data.passingMarks != null && <p>Pass mark: {data.passingMarks} pts</p>}
                  {data.passingPercentage != null && <p>Pass threshold: {data.passingPercentage}%</p>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {data.startsAt && data.endsAt
                    ? `${new Date(data.startsAt).toLocaleString()} — ${new Date(data.endsAt).toLocaleString()}`
                    : 'Schedule window not yet set'}
                </span>
                <span>·</span>
                <span>
                  {data.negativeMarkingEnabled
                    ? `Negative marking enabled (default -${data.defaultNegativeMarks})`
                    : 'No negative marking'}
                </span>
                {(data.shuffleQuestions || data.shuffleOptions) && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Shuffle className="h-3.5 w-3.5" />
                      {[
                        data.shuffleQuestions ? 'Questions shuffled' : null,
                        data.shuffleOptions ? 'Options shuffled' : null,
                      ]
                        .filter(Boolean)
                        .join(' & ')}
                    </span>
                  </>
                )}
              </div>

              {data.instructions && (
                <div className="mt-4 rounded-md border bg-muted/30 p-3.5 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Candidate Instructions
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{data.instructions}</p>
                </div>
              )}
            </div>

            {data.sections.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                No sections have been added to this exam yet.
              </div>
            ) : (
              <div className="space-y-5">
                {data.sections.map((sec, sIdx) => (
                  <div key={sec.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5">
                      <div>
                        <h4 className="font-semibold text-foreground">
                          Section {sIdx + 1}: {sec.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {sec.section_type.toUpperCase()} section
                          {' · '}
                          <span className="tabular-nums">{sec.questions.length}</span> questions
                          {sec.shuffle_questions ? ' · Section shuffle enabled' : ''}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground">
                        {sec.questions.reduce((s, q) => s + q.effectiveMarks, 0)} pts
                      </span>
                    </div>

                    {sec.description && (
                      <p className="text-xs text-muted-foreground">{sec.description}</p>
                    )}

                    <div className="space-y-3">
                      {sec.questions.map((item, qIdx) => {
                        const q = item.question;
                        const isMcq =
                          q.question_type === 'mcq_single' || q.question_type === 'mcq_multi';
                        const correctSet = new Set(
                          item.educatorAnswerKey?.correct_option_keys ?? [],
                        );

                        return (
                          <div key={q.id} className="rounded-md border bg-background p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">
                                <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                                  Q{qIdx + 1}.
                                </span>
                                {q.prompt}
                              </p>
                              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                +{item.effectiveMarks}
                                {item.effectiveNegativeMarks > 0
                                  ? ` / -${item.effectiveNegativeMarks}`
                                  : ''}
                              </span>
                            </div>

                            {isMcq ? (
                              <div className="mt-3 space-y-1.5">
                                {q.options.map((opt) => {
                                  const isCorrect =
                                    mode === 'educator' && correctSet.has(opt.option_key);
                                  return (
                                    <div
                                      key={opt.id}
                                      className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs ${
                                        isCorrect
                                          ? 'border-emerald-500/40 bg-emerald-500/5 text-foreground'
                                          : 'border-border/70 text-muted-foreground'
                                      }`}
                                    >
                                      <span className="font-mono font-semibold text-foreground">
                                        {opt.option_key}.
                                      </span>
                                      <span className="flex-1 text-foreground">
                                        {opt.option_text}
                                      </span>
                                      {isCorrect && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                                Candidate long-form response field
                                {q.expected_word_count
                                  ? ` (target ~${q.expected_word_count} words)`
                                  : ''}
                              </div>
                            )}

                            {mode === 'educator' && item.educatorAnswerKey && (
                              <div className="mt-3 space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
                                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                                  Private Grading Reference (Hidden from Students)
                                </p>
                                {item.educatorAnswerKey.sample_answer && (
                                  <p className="text-muted-foreground">
                                    <strong className="text-foreground">Model answer:</strong>{' '}
                                    {item.educatorAnswerKey.sample_answer}
                                  </p>
                                )}
                                {item.educatorAnswerKey.grading_rubric && (
                                  <p className="text-muted-foreground">
                                    <strong className="text-foreground">Rubric:</strong>{' '}
                                    {item.educatorAnswerKey.grading_rubric}
                                  </p>
                                )}
                                {item.educatorAnswerKey.explanation && (
                                  <p className="text-muted-foreground">
                                    <strong className="text-foreground">Explanation:</strong>{' '}
                                    {item.educatorAnswerKey.explanation}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
