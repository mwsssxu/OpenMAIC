/**
 * Simplified prompt system type definitions
 */

/**
 * Prompt template identifier
 */
export type PromptId =
  | 'requirements-to-outlines'
  | 'web-search-query-rewrite'
  | 'slide-content'
  | 'report-content'
  | 'slide-actions'
  | 'interactive-scientific-model'
  | 'interactive-html'
  | 'interactive-actions';

/**
 * Snippet identifier
 */
export type SnippetId = 'json-output-rules' | 'element-types' | 'action-types';

/**
 * Loaded prompt template
 */
export interface LoadedPrompt {
  id: PromptId;
  systemPrompt: string;
  userPromptTemplate: string;
}
