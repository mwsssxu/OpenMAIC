/**
 * Mobile App Agent Constants
 *
 * Shared constants for agent profile generation in mobile app.
 * Keeps colors and avatars synchronized with backend.
 */

/** Color palette cycled for generated agents */
export const AGENT_COLOR_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#e11d48',
  '#6366f1',
  '#84cc16',
  '#a855f7',
] as const;

/**
 * Default avatar paths cycled for generated agents.
 *
 * These correspond to local PNG assets in assets/avatars/.
 */
export const AGENT_DEFAULT_AVATARS = [
  'teacher-1',
  'assistant-1',
  'curious-1',
  'thinker-1',
  'note-taker-1',
  'teacher-2',
  'assistant-2',
  'curious-2',
  'thinker-2',
  'note-taker-2',
] as const;

/**
 * Avatar emoji mapping for display
 * Maps avatar paths to emoji characters for UI display
 */
export const AVATAR_EMOJI_MAP: Record<string, string> = {
  'teacher': '👨‍🏫',
  'teacher-2': '👩‍🏫',
  'assist': '👨‍💼',
  'assist-2': '👩‍💼',
  'curious': '🧐',
  'curious-2': '👀',
  'thinker': '🤔',
  'thinker-2': '💭',
  'note-taker': '📝',
  'note-taker-2': '📓',
};

/**
 * Get emoji for avatar path
 */
export function getAvatarEmoji(avatarPath: string): string {
  const key = avatarPath.replace('/avatars/', '').replace('.png', '');
  return AVATAR_EMOJI_MAP[key] || '🧑';
}

/**
 * Avatar descriptions for smart matching
 * Used when generating agents to help LLM pick appropriate avatars
 */
export const AVATAR_DESCRIPTIONS = [
  { path: 'teacher-1', desc: '专业的教师形象，适合主讲老师角色' },
  { path: 'assistant-1', desc: '温和的助教形象，适合辅助教学角色' },
  { path: 'curious-1', desc: '好奇的学生形象，适合积极参与的学生角色' },
  { path: 'thinker-1', desc: '思考型学生形象，适合深度思考的学生角色' },
  { path: 'note-taker-1', desc: '记录型学生形象，适合认真笔记的学生角色' },
  { path: 'teacher-2', desc: '亲切的女教师形象，适合主讲老师角色' },
  { path: 'assistant-2', desc: '专业的助教形象，适合辅助教学角色' },
  { path: 'curious-2', desc: '活泼的学生形象，适合积极互动的学生角色' },
  { path: 'thinker-2', desc: '沉思型学生形象，适合深度分析的学生角色' },
  { path: 'note-taker-2', desc: '细致的学生形象，适合记录整理的学生角色' },
] as const;