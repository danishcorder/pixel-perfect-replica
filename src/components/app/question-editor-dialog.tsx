import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CheckSquare,
  CircleDot,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type {
  CourseStatus,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '@/integrations/supabase/types';
import {
  attachQuestionFileFn,
  createQuestionFn,
  deleteQuestionAttachmentFn,
  updateQuestionFn,
} from '@/lib/question-bank.functions';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  QUESTION_ATTACHMENT_BUCKET,
} from '@/lib/question-attachments';
import type {
  EducatorQuestionItem,
  QuestionAttachmentWithUrl,
} from '@/lib/question-bank.server';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const NONE = '__none__';

type OptionDraft = {
  optionKey: string;
  optionText: string;
};

type QueuedFile = {
  id: string;
  file: File;
  previewUrl: string | null;
};

export function QuestionEditorDialog({
  open,
  onOpenChange,
  institutionId,
  authHeaders,
  courses,
  editingQuestion,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  institutionId: string;
  authHeaders: () => Record<string, string>;
  courses: Array<{ id: string; code: string; title: string; status: CourseStatus }>;
  editingQuestion: EducatorQuestionItem | null;
  onSaved: () => Promise<void> | void;
}) {
  const [questionType, setQuestionType] = useState<QuestionType>('mcq_single');
  const [courseId, setCourseId] = useState<string>(NONE);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('Conceptual');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [status, setStatus] = useState<QuestionStatus>('active');
  const [marks, setMarks] = useState('2');
  const [negativeMarks, setNegativeMarks] = useState('0');
  const [expectedWordCount, setExpectedWordCount] = useState('');
  const [tagsText, setTagsText] = useState('');

  const [options, setOptions] = useState<OptionDraft[]>([
    { optionKey: 'A', optionText: '' },
    { optionKey: 'B', optionText: '' },
    { optionKey: 'C', optionText: '' },
    { optionKey: 'D', optionText: '' },
  ]);
  const [correctKeys, setCorrectKeys] = useState<string[]>(['A']);
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [gradingRubric, setGradingRubric] = useState('');
  const [explanation, setExplanation] = useState('');

  const [existingAttachments, setExistingAttachments] = useState<QuestionAttachmentWithUrl[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingQuestion) {
      setQuestionType(editingQuestion.question_type);
      setCourseId(editingQuestion.course_id ?? NONE);
      setTitle(editingQuestion.title);
      setPrompt(editingQuestion.prompt);
      setTopic(editingQuestion.topic);
      setCategory(editingQuestion.category);
      setDifficulty(editingQuestion.difficulty);
      setStatus(editingQuestion.status);
      setMarks(String(editingQuestion.marks));
      setNegativeMarks(String(editingQuestion.negative_marks));
      setExpectedWordCount(
        editingQuestion.expected_word_count !== null
          ? String(editingQuestion.expected_word_count)
          : '',
      );
      setTagsText((editingQuestion.tags ?? []).join(', '));
      setOptions(
        editingQuestion.options.length > 0
          ? editingQuestion.options.map((o) => ({
              optionKey: o.option_key,
              optionText: o.option_text,
            }))
          : [
              { optionKey: 'A', optionText: '' },
              { optionKey: 'B', optionText: '' },
              { optionKey: 'C', optionText: '' },
              { optionKey: 'D', optionText: '' },
            ],
      );
      setCorrectKeys(editingQuestion.answerKey.correct_option_keys ?? []);
      setSampleAnswer(editingQuestion.answerKey.sample_answer ?? '');
      setGradingRubric(editingQuestion.answerKey.grading_rubric ?? '');
      setExplanation(editingQuestion.answerKey.explanation ?? '');
      setExistingAttachments(editingQuestion.attachments ?? []);
      setQueuedFiles([]);
    } else {
      setQuestionType('mcq_single');
      setCourseId(courses[0]?.id ?? NONE);
      setTitle('');
      setPrompt('');
      setTopic('');
      setCategory('Conceptual');
      setDifficulty('medium');
      setStatus('active');
      setMarks('2');
      setNegativeMarks('0');
      setExpectedWordCount('');
      setTagsText('');
      setOptions([
        { optionKey: 'A', optionText: '' },
        { optionKey: 'B', optionText: '' },
        { optionKey: 'C', optionText: '' },
        { optionKey: 'D', optionText: '' },
      ]);
      setCorrectKeys(['A']);
      setSampleAnswer('');
      setGradingRubric('');
      setExplanation('');
      setExistingAttachments([]);
      setQueuedFiles([]);
    }
  }, [open, editingQuestion, courses]);

  const isMcq = questionType === 'mcq_single' || questionType === 'mcq_multi';

  function handleQuestionTypeChange(next: QuestionType) {
    setQuestionType(next);
    if (next === 'mcq_single' && correctKeys.length > 1) {
      setCorrectKeys(correctKeys[0] ? [correctKeys[0]] : ['A']);
    }
  }

  function addOption() {
    if (options.length >= OPTION_KEYS.length) return;
    const nextKey = OPTION_KEYS[options.length] ?? String(options.length + 1);
    setOptions((prev) => [...prev, { optionKey: nextKey, optionText: '' }]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) {
      toast.error('MCQs require at least 2 options');
      return;
    }
    const nextRaw = options.filter((_, i) => i !== idx);
    const reindexed = nextRaw.map((o, i) => ({
      optionKey: OPTION_KEYS[i] ?? o.optionKey,
      optionText: o.optionText,
    }));
    const validKeySet = new Set(reindexed.map((o) => o.optionKey));
    setOptions(reindexed);
    setCorrectKeys((prev) => prev.filter((k) => validKeySet.has(k)));
  }

  function toggleCorrectOption(key: string) {
    if (questionType === 'mcq_single') {
      setCorrectKeys([key]);
    } else {
      setCorrectKeys((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      );
    }
  }

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const added: QueuedFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
        toast.error(`Unsupported file type "${file.name}". Allowed: PNG, JPG, WebP, GIF, PDF, TXT, DOCX.`);
        continue;
      }
      if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`"${file.name}" exceeds the 10 MB attachment limit.`);
        continue;
      }
      const isImg = file.type.startsWith('image/');
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: isImg ? URL.createObjectURL(file) : null,
      });
    }
    setQueuedFiles((prev) => [...prev, ...added]);
    e.target.value = '';
  }

  function removeQueuedFile(id: string) {
    setQueuedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function handleDeleteExistingAttachment(attId: string) {
    try {
      await deleteQuestionAttachmentFn({
        data: { institutionId, attachmentId: attId },
        headers: authHeaders(),
      });
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attId));
      toast.success('Attachment removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete attachment');
    }
  }

  async function uploadQueuedFiles(questionId: string) {
    if (queuedFiles.length === 0) return;
    for (const qf of queuedFiles) {
      const safeName = qf.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${institutionId}/${questionId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from(QUESTION_ATTACHMENT_BUCKET)
        .upload(storagePath, qf.file, {
          contentType: qf.file.type,
          upsert: false,
        });

      if (uploadErr) {
        throw new Error(`Storage upload failed for "${qf.file.name}": ${uploadErr.message}`);
      }

      await attachQuestionFileFn({
        data: {
          institutionId,
          questionId,
          fileName: qf.file.name,
          storagePath,
          mimeType: qf.file.type,
          fileSizeBytes: qf.file.size,
        },
        headers: authHeaders(),
      });
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const marksNum = Number(marks);
    const negNum = Number(negativeMarks || 0);
    const wordNum = expectedWordCount.trim() ? Number(expectedWordCount) : null;

    if (!Number.isFinite(marksNum) || marksNum <= 0) {
      toast.error('Marks must be a positive number');
      return;
    }
    if (!Number.isFinite(negNum) || negNum < 0) {
      toast.error('Negative marks cannot be negative');
      return;
    }

    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      institutionId,
      courseId: courseId === NONE ? null : courseId,
      questionType,
      title: title.trim(),
      prompt: prompt.trim(),
      topic: topic.trim() || 'General',
      category: category.trim() || 'Conceptual',
      difficulty,
      marks: marksNum,
      negativeMarks: negNum,
      expectedWordCount: isMcq ? null : wordNum,
      tags,
      status,
      options: isMcq
        ? options.map((o, idx) => ({
            optionKey: o.optionKey,
            optionText: o.optionText.trim(),
            sortOrder: idx,
          }))
        : [],
      correctOptionKeys: isMcq ? correctKeys : [],
      sampleAnswer: sampleAnswer.trim() || null,
      gradingRubric: gradingRubric.trim() || null,
      explanation: explanation.trim() || null,
    };

    setSaving(true);
    try {
      const saved = editingQuestion
        ? await updateQuestionFn({
            data: { ...payload, questionId: editingQuestion.id },
            headers: authHeaders(),
          })
        : await createQuestionFn({
            data: payload,
            headers: authHeaders(),
          });

      if (queuedFiles.length > 0) {
        await uploadQueuedFiles(saved.id);
      }

      toast.success(editingQuestion ? 'Question updated' : 'Question added to bank');
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingQuestion ? 'Edit Question' : 'Create Question'}
          </DialogTitle>
          <DialogDescription>
            Answer keys, grading rubrics, and explanations are stored in private educator tables
            and never exposed to student APIs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Metadata row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Question type</Label>
              <Select
                value={questionType}
                onValueChange={(v) => handleQuestionTypeChange(v as QuestionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq_single">MCQ (Single correct)</SelectItem>
                  <SelectItem value="mcq_multi">MCQ (Multiple correct)</SelectItem>
                  <SelectItem value="descriptive">Descriptive (Short answer)</SelectItem>
                  <SelectItem value="long_answer">Long answer / Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Subject / Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>General / Unassigned</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} · {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as QuestionDifficulty)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="qb-topic">Topic</Label>
              <Input
                id="qb-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Graph Traversal"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qb-category">Category</Label>
              <Input
                id="qb-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Conceptual, Numerical"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as QuestionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Ready for exams)</SelectItem>
                  <SelectItem value="draft">Draft (In review)</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title & Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="qb-title">Question title</Label>
            <Input
              id="qb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short reference title shown in bank tables"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qb-prompt">Question prompt</Label>
            <Textarea
              id="qb-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Write the full question stem presented to students..."
              required
            />
          </div>

          {/* Scoring & Word Limit */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="qb-marks">Marks</Label>
              <Input
                id="qb-marks"
                type="number"
                step="0.25"
                min="0.25"
                max="1000"
                className="tabular-nums"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qb-neg-marks">Negative marks</Label>
              <Input
                id="qb-neg-marks"
                type="number"
                step="0.25"
                min="0"
                max="1000"
                className="tabular-nums"
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(e.target.value)}
              />
            </div>
            {!isMcq ? (
              <div className="space-y-1.5">
                <Label htmlFor="qb-words">Target words (opt.)</Label>
                <Input
                  id="qb-words"
                  type="number"
                  min="10"
                  max="20000"
                  className="tabular-nums"
                  value={expectedWordCount}
                  onChange={(e) => setExpectedWordCount(e.target.value)}
                  placeholder="e.g. 250"
                />
              </div>
            ) : null}
            <div className={isMcq ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
              <Label htmlFor="qb-tags">Tags (comma-separated)</Label>
              <Input
                id="qb-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="midterm, trees, chapter-4"
              />
            </div>
          </div>

          <Separator />

          {/* Answer Options OR Descriptive Rubric */}
          {isMcq ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">
                    Answer Options & Correct Answer Key
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {questionType === 'mcq_single'
                      ? 'Select exactly one correct option.'
                      : 'Select one or more correct options.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  disabled={options.length >= OPTION_KEYS.length}
                  className="whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add option
                </Button>
              </div>

              <div className="space-y-2">
                {options.map((opt, idx) => {
                  const isCorrect = correctKeys.includes(opt.optionKey);
                  return (
                    <div
                      key={opt.optionKey}
                      className={`flex items-center gap-2 rounded-md border p-2 ${
                        isCorrect ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-border'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCorrectOption(opt.optionKey)}
                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                          isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                        title={isCorrect ? 'Marked as correct answer' : 'Mark as correct answer'}
                      >
                        {questionType === 'mcq_single' ? (
                          <CircleDot className="h-3.5 w-3.5" />
                        ) : (
                          <CheckSquare className="h-3.5 w-3.5" />
                        )}
                        {opt.optionKey}
                      </button>

                      <Input
                        value={opt.optionText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOptions((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, optionText: val } : item,
                            ),
                          );
                        }}
                        placeholder={`Option ${opt.optionKey} text...`}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(idx)}
                        disabled={options.length <= 2}
                        aria-label={`Remove option ${opt.optionKey}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Private Educator Grading Key & Model Answer (never sent to students)
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qb-sample-answer">Model / Sample answer (optional)</Label>
                <Textarea
                  id="qb-sample-answer"
                  value={sampleAnswer}
                  onChange={(e) => setSampleAnswer(e.target.value)}
                  rows={3}
                  placeholder="Reference solution for markers and automated rubric review..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qb-rubric">Grading rubric / mark breakdown (optional)</Label>
                <Textarea
                  id="qb-rubric"
                  value={gradingRubric}
                  onChange={(e) => setGradingRubric(e.target.value)}
                  rows={3}
                  placeholder="e.g. 2 marks for algorithm complexity proof, 3 marks for edge-case analysis..."
                />
              </div>
            </div>
          )}

          {/* Explanation (always private during exam delivery) */}
          <div className="space-y-1.5">
            <Label htmlFor="qb-explanation">
              Solution explanation (optional, private educator key)
            </Label>
            <Textarea
              id="qb-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="Why the correct answer is right or common student pitfalls..."
            />
          </div>

          <Separator />

          {/* Supabase Storage Attachments */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-medium">Attachments (Images & Documents)</h4>
                <p className="text-xs text-muted-foreground">
                  Stored privately in Supabase Storage ({QUESTION_ATTACHMENT_BUCKET}). Allowed:
                  PNG, JPG, WebP, GIF, PDF, TXT, DOCX (max 10 MB).
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted whitespace-nowrap shrink-0">
                <Upload className="h-3.5 w-3.5" />
                Add file
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
                  onChange={handleFilePick}
                  className="hidden"
                />
              </label>
            </div>

            {(existingAttachments.length > 0 || queuedFiles.length > 0) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {existingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {att.attachment_kind === 'image' && att.signedUrl ? (
                        <img
                          src={att.signedUrl}
                          alt={att.file_name}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 shrink-0 rounded object-cover"
                        />
                      ) : att.attachment_kind === 'image' ? (
                        <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{att.file_name}</p>
                        <p className="text-muted-foreground tabular-nums">
                          {Math.max(1, Math.round(att.file_size_bytes / 1024))} KB
                          {att.signedUrl ? (
                            <>
                              {' · '}
                              <a
                                href={att.signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-foreground"
                              >
                                Preview
                              </a>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExistingAttachment(att.id)}
                      aria-label={`Delete ${att.file_name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {queuedFiles.map((qf) => (
                  <div
                    key={qf.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-dashed p-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {qf.previewUrl ? (
                        <img
                          src={qf.previewUrl}
                          alt={qf.file.name}
                          className="h-9 w-9 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{qf.file.name}</p>
                        <p className="text-muted-foreground tabular-nums">
                          {Math.max(1, Math.round(qf.file.size / 1024))} KB · Pending upload
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQueuedFile(qf.id)}
                      aria-label={`Remove ${qf.file.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingQuestion ? 'Save changes' : 'Create question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
