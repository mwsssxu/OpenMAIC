/**
 * 课程完成统计逻辑
 */

import type { Scene, SceneType } from '../types/scene';

export interface CompleteSummary {
  countsByType: Partial<Record<SceneType, number>>;
  quiz: { correct: number; total: number; pct: number } | null;
}

export interface QuizQuestion {
  id: string;
  correctAnswer?: string | string[];
}

export function summarizeScenes(
  scenes: Scene[],
  quizAnswers?: Record<string, Record<string, string | string[]>>,
  quizResults?: Record<string, Array<{ questionId: string; correct: boolean | null }>>,
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
    const questions = (quizContent.questions ?? []) as QuizQuestion[];
    const answers = quizAnswers?.[scene.id] ?? {};
    const results = quizResults?.[scene.id];

    for (const q of questions) {
      total += 1;
      const userAnswer = answers[q.id];

      if (!userAnswer) continue;

      // 优先使用已批改的结果
      if (results) {
        const result = results.find(r => r.questionId === q.id);
        if (result?.correct === true) {
          correct++;
        }
        continue;
      }

      // 否则检查答案是否匹配
      const correctAnswer = q.correctAnswer;
      if (correctAnswer === undefined) continue;

      // 单选题：字符串匹配
      if (typeof correctAnswer === 'string' && typeof userAnswer === 'string') {
        if (userAnswer === correctAnswer) {
          correct++;
        }
      }
      // 多选题：数组匹配
      else if (Array.isArray(correctAnswer) && Array.isArray(userAnswer)) {
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