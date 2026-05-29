/**
 * Quiz 批改逻辑 - 移动端版本
 *
 * 支持选择题本地批改 + 简答题AI批改
 */

import type { QuizQuestion } from '../types/scene';

export interface QuestionResult {
  questionId: string;
  correct: boolean | null; // null = pending grading
  status: 'correct' | 'incorrect';
  earned: number;
  aiComment?: string;
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** 判断是否为简答题 */
export function isShortAnswer(q: QuizQuestion): boolean {
  return q.type === 'short_answer' || (!q.hasAnswer && (!q.answer || q.answer.length === 0));
}

/** 判断是否为多选题 */
export function isMultipleChoice(q: QuizQuestion): boolean {
  return q.type === 'multiple' || (Array.isArray(q.answer) && q.answer.length > 1);
}

/** 本地批改选择题（单选 + 多选） */
export function gradeChoiceQuestions(
  questions: QuizQuestion[],
  answers: Record<string, string | string[]>,
): QuestionResult[] {
  return questions
    .filter((q) => !isShortAnswer(q))
    .map((q) => {
      const pts = q.points ?? 1;
      const userAnswer = toArray(answers[q.id]);
      const correctAnswer = toArray(q.answer);
      const correct = arraysEqual(userAnswer, correctAnswer);
      return {
        questionId: q.id,
        correct,
        status: correct ? ('correct' as const) : ('incorrect' as const),
        earned: correct ? pts : 0,
      };
    });
}
