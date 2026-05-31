/**
 * HTML/SSML Stripper - Remove HTML and SSML tags from text
 *
 * Used to clean TTS text before sending to speech API
 */

/**
 * SSML tags that should be removed from TTS text
 * Includes: break, speak, p, s, phoneme, emphasis, prosody, say-as, sub, voice
 */
const SSML_TAG_PATTERN = /<(break|speak|p|s|phoneme|emphasis|prosody|say-as|sub|voice)[^>]*>|<\/(speak|p|s|phoneme|emphasis|prosody|say-as|sub|voice)>/gi;

/**
 * General HTML tag pattern
 */
const HTML_TAG_PATTERN = /<[^>]+>/g;

/**
 * Strip HTML and SSML tags from text
 *
 * @param text - Input text that may contain HTML/SSML tags
 * @returns Cleaned text with all tags removed
 *
 * @example
 * stripHtmlAndSSML('Hello <break time="500ms"/>world!')
 * // Returns: 'Hello world!'
 *
 * stripHtmlAndSSML('<p>Hello</p> <b>world</b>!')
 * // Returns: 'Hello world!'
 */
export function stripHtmlAndSSML(text: string): string {
  if (!text) return '';

  // First remove SSML tags (they may have attributes)
  let cleaned = text.replace(SSML_TAG_PATTERN, '');

  // Then remove any remaining HTML tags
  cleaned = cleaned.replace(HTML_TAG_PATTERN, '');

  // Clean up whitespace: multiple spaces -> single space
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Check if text contains SSML tags
 *
 * @param text - Input text
 * @returns true if SSML tags are present
 */
export function containsSSML(text: string): boolean {
  return SSML_TAG_PATTERN.test(text);
}

/**
 * Check if text contains HTML tags
 *
 * @param text - Input text
 * @returns true if HTML tags are present
 */
export function containsHtml(text: string): boolean {
  return HTML_TAG_PATTERN.test(text);
}
