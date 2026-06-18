/**
 * Agent avatar image mapping.
 * Local PNG assets replace the old emoji-based avatars.
 * Free avatars from DiceBear (https://dicebear.com, open source, no API key).
 */

// Local avatar assets
const AVATAR_IMAGES: Record<string, any> = {
  'teacher': require('../../assets/avatars/teacher-1.png'),
  'teacher-2': require('../../assets/avatars/teacher-2.png'),
  'assistant': require('../../assets/avatars/assistant-1.png'),
  'assist': require('../../assets/avatars/assistant-1.png'),
  'assistant-2': require('../../assets/avatars/assistant-2.png'),
  'assist-2': require('../../assets/avatars/assistant-2.png'),
  'curious': require('../../assets/avatars/curious-1.png'),
  'curious-2': require('../../assets/avatars/curious-2.png'),
  'thinker': require('../../assets/avatars/thinker-1.png'),
  'thinker-2': require('../../assets/avatars/thinker-2.png'),
  'note-taker': require('../../assets/avatars/note-taker-1.png'),
  'note-taker-2': require('../../assets/avatars/note-taker-2.png'),
  'student': require('../../assets/avatars/student-1.png'),
  'student-1': require('../../assets/avatars/student-1.png'),
  'student-2': require('../../assets/avatars/student-2.png'),
};

/**
 * Normalize an avatar string from the backend into a lookup key.
 * Accepts formats like:
 *   "/avatars/teacher.png", "teacher.png", "teacher", "teacher-2"
 */
function normalizeAvatarKey(avatar?: string | null): string {
  if (!avatar) return '';
  // Strip path prefix and extension
  let key = avatar.replace(/^\/?avatars?\//, '').replace(/\.png$/, '');
  // student1 -> student-1, student2 -> student-2
  key = key.replace(/^student(\d)$/, 'student-$1');
  return key;
}

/**
 * Get local image source for an avatar string.
 * Returns null if no matching avatar asset exists.
 */
export function getAvatarImage(avatar?: string | null): any | null {
  const key = normalizeAvatarKey(avatar);
  return AVATAR_IMAGES[key] ?? null;
}

/**
 * All available avatar paths for backend agent generation.
 * Matches the keys in AVATAR_IMAGES.
 */
export const AVAILABLE_AVATAR_PATHS = Object.keys(AVATAR_IMAGES).map(
  (key) => `/avatars/${key}.png`
);
