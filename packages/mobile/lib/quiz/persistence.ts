/**
 * Quiz 状态持久化 - 移动端版本
 *
 * 使用 AsyncStorage 存储，支持断点续答
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const DRAFT_KEY_PREFIX = 'quizDraft:';
export const ANSWERS_KEY_PREFIX = 'quizAnswers:';
export const RESULTS_KEY_PREFIX = 'quizResults:';

export type QuizAnswers = Record<string, string | string[]>;

export interface QuestionResult {
  questionId: string;
  correct: boolean | null; // null = pending grading
  feedback?: string;
}

export type SubmittedState =
  | { kind: 'reviewing'; answers: QuizAnswers; results: QuestionResult[] }
  | { kind: 'answering'; answers: QuizAnswers }
  | null;

export function draftKey(sceneId: string): string {
  return DRAFT_KEY_PREFIX + sceneId;
}

export function answersKey(sceneId: string): string {
  return ANSWERS_KEY_PREFIX + sceneId;
}

export function resultsKey(sceneId: string): string {
  return RESULTS_KEY_PREFIX + sceneId;
}

/** 读取草稿答案 */
export async function readDraft(sceneId: string): Promise<QuizAnswers> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(sceneId));
    if (raw) {
      return JSON.parse(raw) as QuizAnswers;
    }
  } catch {
    // ignore
  }
  return {};
}

/** 写入草稿答案 */
export async function writeDraft(sceneId: string, answers: QuizAnswers): Promise<void> {
  try {
    await AsyncStorage.setItem(draftKey(sceneId), JSON.stringify(answers));
  } catch {
    // ignore quota / disabled storage
  }
}

/** 清除草稿答案 */
export async function clearDraft(sceneId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(draftKey(sceneId));
  } catch {
    // ignore
  }
}

/** 读取提交后的状态 */
export async function readSubmittedState(sceneId: string): Promise<SubmittedState> {
  try {
    const rawA = await AsyncStorage.getItem(answersKey(sceneId));
    if (!rawA) return null;

    const answers = JSON.parse(rawA) as QuizAnswers;
    const rawR = await AsyncStorage.getItem(resultsKey(sceneId));

    if (rawR) {
      const results = JSON.parse(rawR) as QuestionResult[];
      if (Array.isArray(results) && results.length > 0) {
        return { kind: 'reviewing', answers, results };
      }
    }
    return { kind: 'answering', answers };
  } catch {
    return null;
  }
}

/** 读取用于汇总的答案（优先提交答案，fallback 到草稿） */
export async function readAnswersForSummary(sceneId: string): Promise<QuizAnswers> {
  try {
    const rawA = await AsyncStorage.getItem(answersKey(sceneId));
    if (rawA) {
      return JSON.parse(rawA) as QuizAnswers;
    }
    const rawD = await AsyncStorage.getItem(draftKey(sceneId));
    if (rawD) {
      return JSON.parse(rawD) as QuizAnswers;
    }
  } catch {
    // ignore
  }
  return {};
}

/** 提交时写入答案 */
export async function writeSubmittedAnswers(sceneId: string, answers: QuizAnswers): Promise<void> {
  try {
    await AsyncStorage.setItem(answersKey(sceneId), JSON.stringify(answers));
    // 清除草稿
    await AsyncStorage.removeItem(draftKey(sceneId));
  } catch {
    // ignore
  }
}

/** 批改后写入结果 */
export async function writeSubmittedResults(sceneId: string, results: QuestionResult[]): Promise<void> {
  try {
    await AsyncStorage.setItem(resultsKey(sceneId), JSON.stringify(results));
  } catch {
    // ignore
  }
}

/** 重试时清除提交状态 */
export async function clearSubmitted(sceneId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(answersKey(sceneId));
    await AsyncStorage.removeItem(resultsKey(sceneId));
  } catch {
    // ignore
  }
}

/** 删除场景时清除所有相关数据 */
export async function clearAllForScene(sceneId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      draftKey(sceneId),
      answersKey(sceneId),
      resultsKey(sceneId),
    ]);
  } catch {
    // ignore
  }
}

/** 批量读取多个场景的答案 */
export async function readAllAnswersForSummary(sceneIds: string[]): Promise<Record<string, QuizAnswers>> {
  const result: Record<string, QuizAnswers> = {};
  for (const sceneId of sceneIds) {
    result[sceneId] = await readAnswersForSummary(sceneId);
  }
  return result;
}