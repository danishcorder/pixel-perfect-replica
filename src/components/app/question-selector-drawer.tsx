import { useState, type FormEvent } from 'react';
import { FolderPlus, Layers, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import type { CourseStatus } from '@/integrations/supabase/types';
import { addQuestionsToSetFn, createQuestionSetFn } from '@/lib/question-bank.functions';
import type {
  EducatorQuestionItem,
  QuestionSetWithItems,
} from '@/lib/question-bank.server';

const NONE = '__none__';

/**
 * Reusable Exam Selection Bar & Question Set Builder.
 * Tracks selected Question Bank items for reuse in Question Sets and Phase 5 Exam Assembly.
 */
export function QuestionSelectionTray({
  institutionId,
  authHeaders,
  selectedQuestions,
  courses,
  existingSets,
  onClearSelection,
  onSetsChanged,
}: {
  institutionId: string;
  authHeaders: () => Record<string, string>;
  selectedQuestions: EducatorQuestionItem[];
  courses: Array<{ id: string; code: string; title: string; status: CourseStatus }>;
  existingSets: QuestionSetWithItems[];
  onClearSelection: () => void;
  onSetsChanged: () => Promise<void> | void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState(NONE);
  const [targetSetId, setTargetSetId] = useState('');
  const [busy, setBusy] = useState(false);

  if (selectedQuestions.length === 0) return null;

  const totalMarks = selectedQuestions.reduce((acc, q) => acc + Number(q.marks), 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ids = selectedQuestions.map((q) => q.id);
    setBusy(true);
    try {
      if (mode === 'new') {
        await createQuestionSetFn({
          data: {
            institutionId,
            title: title.trim(),
            description: description.trim() || null,
            courseId: courseId === NONE ? null : courseId,
            questionIds: ids,
          },
          headers: authHeaders(),
        });
        toast.success(`Saved ${ids.length} question(s) to new exam set "${title.trim()}"`);
      } else {
        if (!targetSetId) {
          toast.error('Select a target question set');
          setBusy(false);
          return;
        }
        const res = await addQuestionsToSetFn({
          data: {
            institutionId,
            questionSetId: targetSetId,
            questionIds: ids,
          },
          headers: authHeaders(),
        });
        toast.success(`Added ${res.added} new question(s) to set`);
      }
      setTitle('');
      setDescription('');
      setDialogOpen(false);
      onClearSelection();
      await onSetsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save question selection');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Layers className="h-4 w-4 text-primary" />
            <span className="tabular-nums">{selectedQuestions.length}</span> selected for exam reuse
          </div>
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <span className="text-muted-foreground tabular-nums">
            Total {totalMarks} marks
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="whitespace-nowrap shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setMode('new');
              setDialogOpen(true);
            }}
            className="whitespace-nowrap shrink-0"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Save to exam set
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save Reusable Exam Selection</DialogTitle>
            <DialogDescription>
              Group <span className="tabular-nums font-medium">{selectedQuestions.length}</span>{' '}
              selected questions (<span className="tabular-nums">{totalMarks}</span> marks) into a
              reusable Question Set for future exam papers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            {existingSets.length > 0 ? (
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'new'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Create new set
                </button>
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'existing'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Add to existing set
                </button>
              </div>
            ) : null}

            {mode === 'new' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="qs-title">Set title</Label>
                  <Input
                    id="qs-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. CS101 Midterm Pool A"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Course (optional)</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Cross-course / General</SelectItem>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} · {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qs-desc">Blueprint notes (optional)</Label>
                  <Textarea
                    id="qs-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Target exam blueprint notes or section instructions..."
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Target question set</Label>
                <Select value={targetSetId} onValueChange={setTargetSetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a saved question set" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingSets.map((set) => (
                      <SelectItem key={set.id} value={set.id}>
                        {set.title} ({set.items.length} q · {set.totalMarks} marks)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save selection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
