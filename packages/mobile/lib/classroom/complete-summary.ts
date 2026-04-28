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
    const questions = scene.content?.questions ?? [];
    const answers = quizAnswers?.[scene.id] ?? {};

    for (const q of questions) {
      total += 1;
      const userAnswer = answers[q.id];

      if (!userAnswer) continue;

      // 单选题：检查是否匹配正确答案
      if (q.options?.length === 1) {
        // 暂时假设所有选项都可能是正确答案，需要从后端获取
        // 这里简化处理，用户选择了答案就视为已作答
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