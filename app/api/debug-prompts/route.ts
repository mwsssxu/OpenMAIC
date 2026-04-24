/**
 * 提示词调试 API - 在服务运行时打印所有提示词模版内容
 *
 * 用法：访问 http://localhost:3000/api/debug-prompts
 * 参数：
 *   - id: 指定模版ID（可选，如 ?id=slide-content）
 *   - type: system | user | all（默认 all）
 */

import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { loadPrompt, loadSnippet, PROMPT_IDS, clearPromptCache } from '@/lib/generation/prompts';
import type { PromptId } from '@/lib/generation/prompts/types';

// 所有模版ID列表
const ALL_PROMPT_IDS = Object.values(PROMPT_IDS) as PromptId[];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const promptId = searchParams.get('id') as PromptId | null;
  const type = searchParams.get('type') || 'all';

  try {
    // 清除缓存确保读取最新内容
    clearPromptCache();

    // 如果指定了单个模版ID
    if (promptId) {
      if (!ALL_PROMPT_IDS.includes(promptId)) {
        return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, `Invalid prompt ID: ${promptId}`, `Valid IDs: ${ALL_PROMPT_IDS.join(', ')}`);
      }

      const prompt = loadPrompt(promptId);
      if (!prompt) {
        return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, `Prompt not found`, promptId);
      }

      const result: Record<string, string> = {};
      if (type === 'system' || type === 'all') {
        result.system = prompt.systemPrompt;
      }
      if (type === 'user' || type === 'all') {
        result.user = prompt.userPromptTemplate || '(无 user.md)';
      }

      return apiSuccess({
        id: promptId,
        ...result,
      });
    }

    // 返回所有模版
    const prompts: Record<string, { system: string; user: string }> = {};
    
    for (const id of ALL_PROMPT_IDS) {
      const prompt = loadPrompt(id);
      if (prompt) {
        prompts[id] = {
          system: type === 'system' ? prompt.systemPrompt : '(省略，请指定 type=system)',
          user: type === 'user' ? prompt.userPromptTemplate || '(无)' : '(省略，请指定 type=user)',
        };
        if (type === 'all') {
          prompts[id] = {
            system: prompt.systemPrompt,
            user: prompt.userPromptTemplate || '(无 user.md)',
          };
        }
      }
    }

    // 加载共用片段
    const snippets: Record<string, string> = {};
    try {
      snippets['json-output-rules'] = loadSnippet('json-output-rules' as any);
    } catch {
      snippets['json-output-rules'] = '(未找到)';
    }

    return apiSuccess({
      total: ALL_PROMPT_IDS.length,
      promptIds: ALL_PROMPT_IDS,
      prompts,
      snippets,
      usage: {
        getSingle: 'GET /api/debug-prompts?id=slide-content&type=system',
        getAll: 'GET /api/debug-prompts?type=all',
        types: ['system', 'user', 'all'],
      },
    });
  } catch (error) {
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Failed to load prompts', String(error));
  }
}