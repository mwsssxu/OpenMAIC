/**
 * 提示词加载器 - 从 Markdown 文件加载 AI 提示模板
 *
 * 核心职责：
 * - 从 templates/{promptId}/ 目录加载提示模板
 * - 支持 {{snippet:name}} 语法引用代码片段
 * - 支持 {{variable}} 语法进行变量插值
 * - 内置缓存机制提升性能
 *
 * 目录结构：
 *   lib/generation/prompts/
 *   ├── templates/
 *   │   └── {promptId}/
 *   │       ├── system.md    # 系统提示（必需）
 *   │       └── user.md      # 用户提示模板（可选）
 *   └── snippets/
 *       └── {snippetId}.md   # 可复用的代码片段
 *
 * 使用示例：
 *   const prompts = buildPrompt('requirements-to-outlines', { language: 'zh-CN' });
 *   // prompts.system: 系统提示（变量已插值）
 *   // prompts.user: 用户提示（变量已插值）
 */

import fs from 'fs';
import path from 'path';
import type { PromptId, LoadedPrompt, SnippetId } from './types';
import { createLogger } from '@/lib/logger';
const log = createLogger('PromptLoader');

// 提示模板和代码片段的缓存
const promptCache = new Map<string, LoadedPrompt>();
const snippetCache = new Map<string, string>();

/**
 * 获取 prompts 目录的路径
 *
 * 在 Next.js 环境中，使用 process.cwd() 获取项目根目录
 *
 * @returns prompts 目录的绝对路径
 */
function getPromptsDir(): string {
  // 在 Next.js 中，使用 process.cwd() 获取项目根目录
  return path.join(process.cwd(), 'lib', 'generation', 'prompts');
}

/**
 * 根据 ID 加载代码片段
 *
 * 从 snippets/{snippetId}.md 文件加载可复用的提示片段。
 * 结果会被缓存，后续调用直接返回缓存内容。
 *
 * @param snippetId - 代码片段 ID（对应 snippets/{snippetId}.md 文件）
 * @returns 片段内容；如果文件不存在，返回原始占位符 {{snippet:snippetId}}
 */
export function loadSnippet(snippetId: SnippetId): string {
  const cached = snippetCache.get(snippetId);
  if (cached) return cached;

  const snippetPath = path.join(getPromptsDir(), 'snippets', `${snippetId}.md`);

  try {
    const content = fs.readFileSync(snippetPath, 'utf-8').trim();
    snippetCache.set(snippetId, content);
    return content;
  } catch {
    log.warn(`Snippet not found: ${snippetId}`);
    return `{{snippet:${snippetId}}}`;
  }
}

/**
 * 处理模板中的代码片段引用
 *
 * 将模板中的 {{snippet:name}} 替换为实际的片段内容。
 * 支持嵌套引用（片段中可以引用其他片段）。
 *
 * @param template - 原始模板字符串
 * @returns 替换片段引用后的模板字符串
 */
function processSnippets(template: string): string {
  return template.replace(/\{\{snippet:(\w[\w-]*)\}\}/g, (_, snippetId) => {
    return loadSnippet(snippetId as SnippetId);
  });
}

/**
 * 根据 ID 加载提示模板
 *
 * 从 templates/{promptId}/ 目录加载完整的提示模板：
 * - system.md：系统提示（必需），定义 AI 的角色和行为规范
 * - user.md：用户提示模板（可选），包含具体的任务描述
 *
 * 加载后会处理所有代码片段引用，并将结果缓存。
 *
 * @param promptId - 提示模板 ID
 * @returns 加载的提示模板对象；加载失败返回 null
 */
export function loadPrompt(promptId: PromptId): LoadedPrompt | null {
  const cached = promptCache.get(promptId);
  if (cached) return cached;

  const promptDir = path.join(getPromptsDir(), 'templates', promptId);

  try {
    // 加载 system.md（系统提示）
    const systemPath = path.join(promptDir, 'system.md');
    let systemPrompt = fs.readFileSync(systemPath, 'utf-8').trim();
    systemPrompt = processSnippets(systemPrompt);

    // 加载 user.md（用户提示模板，可选）
    const userPath = path.join(promptDir, 'user.md');
    let userPromptTemplate = '';
    try {
      userPromptTemplate = fs.readFileSync(userPath, 'utf-8').trim();
      userPromptTemplate = processSnippets(userPromptTemplate);
    } catch {
      // user.md 是可选的，不存在时使用空字符串
    }

    const loaded: LoadedPrompt = {
      id: promptId,
      systemPrompt,
      userPromptTemplate,
    };

    promptCache.set(promptId, loaded);
    return loaded;
  } catch (error) {
    log.error(`Failed to load prompt ${promptId}:`, error);
    return null;
  }
}

/**
 * 在模板中进行变量插值
 *
 * 将模板中的 {{variable}} 替换为变量对象中对应的值：
 * - 字符串/数字：直接替换
 * - 对象：转换为格式化的 JSON 字符串
 * - undefined：保留原始占位符
 *
 * @param template - 原始模板字符串
 * @param variables - 变量键值对
 * @returns 插值后的模板字符串
 */
export function interpolateVariables(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) return match;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });
}

/**
 * 构建完整的提示（带变量插值）
 *
 * 这是主要的对外接口，完成以下工作：
 * 1. 根据 promptId 加载提示模板
 * 2. 使用提供的变量进行插值
 * 3. 返回可用于 AI 调用的 system 和 user 提示
 *
 * @param promptId - 提示模板 ID
 * @param variables - 模板变量键值对
 * @returns 包含 system 和 user 提示的对象；模板不存在时返回 null
 *
 * @example
 * const prompts = buildPrompt('requirements-to-outlines', {
 *   requirement: '学习 Python 基础',
 *   language: 'zh-CN',
 *   pdfContent: '...',
 * });
 */
export function buildPrompt(
  promptId: PromptId,
  variables: Record<string, unknown>,
): { system: string; user: string } | null {
  const prompt = loadPrompt(promptId);
  if (!prompt) return null;

  return {
    system: interpolateVariables(prompt.systemPrompt, variables),
    user: interpolateVariables(prompt.userPromptTemplate, variables),
  };
}

/**
 * 清除所有缓存
 *
 * 用于开发/测试场景，强制重新加载模板文件。
 * 生产环境通常不需要调用此函数。
 */
export function clearPromptCache(): void {
  promptCache.clear();
  snippetCache.clear();
}
