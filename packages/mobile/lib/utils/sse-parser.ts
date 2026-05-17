/**
 * SSE 响应内容分段解析器
 * 将 Agent 回复中的不同内容段分离：
 * - 核心文本：主要教学内容 + 核心要点 + 场景举例
 * - 白板内容：📝 **白板图示** 后的代码块
 * - 引导思考：💡 **引导思考** 用于触发讨论
 */

export interface ParsedContent {
  /** 核心教学内容（包含要点和举例） */
  coreText: string;
  /** 白板图示内容（包含图表、家谱等） */
  whiteboardContent: string | null;
  /** 引导思考内容（用于触发讨论） */
  thinkingPrompt: string | null;
  /** 是否包含白板 */
  hasWhiteboard: boolean;
  /** 是否包含引导思考 */
  hasThinkingPrompt: boolean;
}

/**
 * 解析 SSE text_delta 内容，分段提取
 * 核心文本保留教学要点和场景举例，只分离白板和引导思考
 */
export function parseSSEContent(fullText: string): ParsedContent {
  let whiteboardContent: string | null = null;
  let thinkingPrompt: string | null = null;

  // 白板图示：匹配 📝 **白板图示...** 和后面的代码块
  // 支持：📝 **白板图示（关键结构）** 或 📝 **白板图示**
  const whiteboardRegex = /(?:📝|🖊️)\s*\*\*白板图示[^*]*\*\*\s*\n```[\s\S]*?```/;
  const whiteboardMatch = fullText.match(whiteboardRegex);
  if (whiteboardMatch) {
    whiteboardContent = whiteboardMatch[0];
    fullText = fullText.replace(whiteboardMatch[0], '[白板内容已显示]');
  }

  // 引导思考：匹配 💡 **引导思考** 直到结尾或下一个标记
  const thinkingRegex = /(?:💡|🤔)\s*\*\*引导思考[^*]*\*\*[\s\S]*$/;
  const thinkingMatch = fullText.match(thinkingRegex);
  if (thinkingMatch) {
    thinkingPrompt = thinkingMatch[0];
    fullText = fullText.replace(thinkingMatch[0], '[引导思考待参与]');
  }

  // 清理剩余文本（移除多余空行，保留核心要点和场景举例）
  const coreText = fullText
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    coreText,
    whiteboardContent,
    thinkingPrompt,
    hasWhiteboard: whiteboardContent !== null,
    hasThinkingPrompt: thinkingPrompt !== null,
  };
}

/**
 * 提取白板代码块内容（用于显示）
 */
export function extractWhiteboardText(whiteboardContent: string): string {
  if (!whiteboardContent) return '';
  // 提取代码块中的内容
  const codeBlockMatch = whiteboardContent.match(/```[\s\S]*?```/);
  if (!codeBlockMatch) return whiteboardContent;
  return codeBlockMatch[0]
    .replace(/```\w*\n?/, '')
    .replace(/```$/g, '')
    .trim();
}

/**
 * 从引导思考中提取讨论主题
 */
export function extractDiscussionTopic(thinkingPrompt: string): string {
  if (!thinkingPrompt) return '讨论话题';
  // 提取引导思考中的核心问题（去除emoji和标题）
  const lines = thinkingPrompt.split('\n').filter(l => l.trim());
  // 跳过标题行，找问题内容
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('💡') && !line.startsWith('🤔') && !line.startsWith('**')) {
      return line.replace(/^[：:]\s*/, '');
    }
  }
  return lines[0]?.replace(/(?:💡|🤔)\s*\*\*引导思考[^*]*\*\*[：:]?\s*/, '') || '讨论话题';
}