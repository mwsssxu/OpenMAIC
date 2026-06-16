/**
 * 课程完成统计逻辑
 */

import type { Scene, SceneType } from '../types/scene';

export interface CompleteSummary {
  countsByType: Partial<Record<SceneType, number>>;
  quiz: { correct: number; total: number; pct: number } | null;
}

export function summarizeScenes(
  scenes: Scene[],
  quizAnswers?: Record<string, Record<string, string | string[]>>,
): CompleteSummary {
  const countsByType: Partial<Record<SceneType, number>> = {};

  for (const scene of scenes) {
    countsByType[scene.type] = (countsByType[scene.type] ?? 0) + 1;
  }

  let correct = 0;
  let total = 0;

  for (const scene of scenes) {
    if (scene.type !== 'quiz') continue;
    const quizContent = scene.content as import('@/lib/types/scene').QuizContent;
    const questions = (quizContent.questions ?? []);
    const answers = quizAnswers?.[scene.id] ?? {};

    for (const q of questions) {
      total += 1;
      const userAnswer = answers[q.id];

      if (!userAnswer) continue;

      // 正确答案：scene.ts 中字段名为 answer（string[]）
      const correctAnswer = q.answer;
      if (!correctAnswer || correctAnswer.length === 0) continue;

      // 单选题：用户答案是 string，正确答案是 string[]
      if (typeof userAnswer === 'string' && correctAnswer.length > 0) {
        if (correctAnswer.includes(userAnswer)) {
          correct++;
        }
      }
      // 多选题：用户答案是 string[]，正确答案是 string[]
      else if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
        if (
          correctAnswer.length === userAnswer.length &&
          correctAnswer.every(c => userAnswer.includes(c))
        ) {
          correct++;
        }
      }
    }
  }

  // 如果有测验数据，计算百分比
  const quiz = total > 0 ? { correct, total, pct: Math.round((correct / total) * 100) } : null;

  return { countsByType, quiz };
}

export function encouragementKey(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 90) return 'high';
  if (pct >= 70) return 'mid';
  return 'low';
}
