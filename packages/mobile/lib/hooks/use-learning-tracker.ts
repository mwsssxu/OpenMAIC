/**
 * 学习时长追踪 Hook
 *
 * 功能：
 * 1. 进入课堂时记录开始学习
 * 2. 定期更新学习时长（每60秒）
 * 3. 课程完成时保存最终记录
 * 4. 页面卸载时保存当前时长
 */

import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api-client';
import { useAuth } from '../auth/auth-context';

interface LearningTrackerOptions {
  courseId: string;
  totalScenes: number;
  onComplete?: (data: any) => void;
}

export function useLearningTracker(options: LearningTrackerOptions) {
  const { courseId, totalScenes, onComplete } = options;
  const { isAuthenticated } = useAuth();

  // 学习时长（分钟）
  const learningMinutesRef = useRef(0);
  // 已完成场景数
  const scenesCompletedRef = useRef(0);
  // 开始时间
  const startTimeRef = useRef<Date | null>(null);
  // 定时器ID
  const intervalRef = useRef<number | null>(null);
  // 是否已开始
  const startedRef = useRef(false);
  // 是否已完成
  const completedRef = useRef(false);

  // 开始学习
  const startLearning = useCallback(async () => {
    if (!isAuthenticated || startedRef.current || completedRef.current) return;

    try {
      startTimeRef.current = new Date();
      startedRef.current = true;

      // 调用API记录开始学习
      await apiClient.startLearning(courseId);

      // 启动定时器，每60秒更新一次时长
      intervalRef.current = setInterval(async () => {
        if (!startedRef.current || completedRef.current) return;

        learningMinutesRef.current += 1;

        // 调用API更新时长
        try {
          await apiClient.updateLearningTime(
            courseId,
            learningMinutesRef.current,
            scenesCompletedRef.current
          );
        } catch (err) {
          console.error('Update learning time error:', err);
        }
      }, 60000); // 60秒
    } catch (err) {
      console.error('Start learning error:', err);
    }
  }, [courseId, isAuthenticated]);

  // 更新已完成场景数
  const updateScenesCompleted = useCallback((count: number) => {
    scenesCompletedRef.current = count;
  }, []);

  // 完成学习
  const completeLearning = useCallback(async (quizScore?: number) => {
    if (!isAuthenticated || !startedRef.current || completedRef.current) return;

    try {
      completedRef.current = true;

      // 停止定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // 计算总时长（分钟）
      const totalMinutes = learningMinutesRef.current;

      // 调用API完成学习
      const result = await apiClient.completeLearning(courseId, {
        total_minutes: totalMinutes,
        scenes_completed: scenesCompletedRef.current,
        total_scenes: totalScenes,
        quiz_score: quizScore,
      });

      // 自动打卡
      try {
        await apiClient.dailyCheckin();
      } catch (err) {
        console.error('Daily checkin error:', err);
      }

      // 回调
      if (onComplete) {
        onComplete(result);
      }
    } catch (err) {
      console.error('Complete learning error:', err);
    }
  }, [courseId, isAuthenticated, totalScenes, onComplete]);

  // 保存当前进度（用于页面卸载时）
  const saveProgress = useCallback(async () => {
    if (!isAuthenticated || !startedRef.current || completedRef.current) return;

    try {
      await apiClient.updateLearningTime(
        courseId,
        learningMinutesRef.current,
        scenesCompletedRef.current
      );
    } catch (err) {
      console.error('Save progress error:', err);
    }
  }, [courseId, isAuthenticated]);

  // 初始化：开始学习
  useEffect(() => {
    startLearning();

    // 清理：页面卸载时保存进度
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      saveProgress();
    };
  }, [startLearning, saveProgress]);

  return {
    learningMinutes: learningMinutesRef.current,
    scenesCompleted: scenesCompletedRef.current,
    updateScenesCompleted,
    completeLearning,
  };
}