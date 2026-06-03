import type { QuizLevel } from './types';

export const QUIZ_LEVEL_CONFIG: Record<QuizLevel, {
  color: string;
  bgColor: string;
  title: string;
  subtitle: string;
  emoji: string;
}> = {
  perfect: {
    color: '#fbbf24',
    bgColor: '#fffbeb',
    title: '完美通关！',
    subtitle: '太厉害了！全部答对！',
    emoji: '🎉',
  },
  great: {
    color: '#22c55e',
    bgColor: '#f0fdf4',
    title: '表现出色！',
    subtitle: '继续保持，你很棒！',
    emoji: '👏',
  },
  good: {
    color: '#3b82f6',
    bgColor: '#eff6ff',
    title: '不错哦！',
    subtitle: '再接再厉，争取更好！',
    emoji: '👍',
  },
  retry: {
    color: '#f97316',
    bgColor: '#fff7ed',
    title: '别灰心！',
    subtitle: '每一次尝试都是进步，再来一次吧！',
    emoji: '🌱',
  },
};
